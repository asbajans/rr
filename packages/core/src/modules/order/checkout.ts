import crypto from 'crypto';
import { Op } from 'sequelize';
import { sequelize } from '../../config/database.js';
import { config } from '../../config/env.js';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { OrderStatusHistory } from '../../models/OrderStatusHistory.model.js';
import { Product } from '../../models/Product.model.js';
import { CustomerAddress } from '../../models/CustomerAddress.model.js';
import { Coupon } from '../../models/Coupon.model.js';
import { logger } from '../../utils/logger.js';
import {
  CheckoutPayloadSchema,
  CheckoutShippingAddressSchema,
  CheckoutCustomerSchema,
  REQUIRES_GATEWAY,
  type CheckoutPayload,
  type CheckoutTotals,
  type CheckoutItem,
} from '@rahatio/shared';
import { detectVendors, createVendorSubOrders } from './orderSplit.js';
import type { Store } from '../../models/Store.model.js';
import { notifyCustomer, buildOrderEmail } from '../customer/notifications.js';
import { Customer } from '../../models/Customer.model.js';
import { findOrCreateCustomer } from './customerHelper.js';

export class CheckoutError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface PricedOrderItem extends CheckoutItem {
  productId: number;
  name: string;
  unitPrice: number;
  price: number;
  cost?: number;
  image?: string | null;
}

/**
 * Server-side order total calculation. The client never supplies prices.
 * Pure function — unit-testable.
 */
export function calculateTotals(items: { quantity: number; unitPrice: number }[], store: Pick<Store, 'taxSettings' | 'shippingSettings'>, discountAmount = 0): CheckoutTotals {
  const subtotal = round2(items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0));

  const shippingSettings = (store.shippingSettings as any) || {};
  const shippingEnabled = Boolean(shippingSettings.enabled ?? shippingSettings.is_active);
  const shippingCost = Number(shippingSettings.cost ?? shippingSettings.flat_rate ?? 0) || 0;
  const freeAboveRaw = shippingSettings.freeAbove ?? shippingSettings.free_shipping_threshold;
  const freeAbove = freeAboveRaw != null && freeAboveRaw !== '' ? Number(freeAboveRaw) : null;
  const shippingAmount =
    shippingEnabled && !(freeAbove != null && subtotal >= freeAbove) ? shippingCost : 0;

  const taxSettings = (store.taxSettings as any) || {};
  const taxRate = Number(taxSettings.rate ?? 0) || 0;
  const taxMode: CheckoutTotals['taxMode'] =
    taxRate > 0 ? (taxSettings.mode === 'included' ? 'included' : 'excluded') : 'none';

  let taxAmount = 0;
  if (taxMode === 'excluded') taxAmount = round2((subtotal * taxRate) / 100);
  else if (taxMode === 'included') taxAmount = round2((subtotal * taxRate) / (100 + taxRate));

  const safeDiscount = round2(Math.min(Math.max(0, discountAmount), subtotal + shippingAmount));
  const totalAmount = round2(Math.max(0, subtotal - safeDiscount + shippingAmount + (taxMode === 'excluded' ? taxAmount : 0)));

  return { subtotal, shippingAmount, taxAmount, totalAmount, taxMode, taxRate, discountAmount: safeDiscount };
}

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Short-lived, signed order token handed to the customer after checkout. */
export function issueOrderToken(orderId: number, orderNumber: string): string {
  const payload = Buffer.from(
    JSON.stringify({ id: orderId, n: orderNumber, exp: Date.now() + TOKEN_TTL_MS })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', config.apiKey.internalKey).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function hashOrderToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyOrderToken(token: string): { id: number; n: string } | null {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', config.apiKey.internalKey).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.id || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return { id: data.id, n: data.n };
  } catch {
    return null;
  }
}

export const parseCheckoutPayload = (raw: unknown): CheckoutPayload => {
  const parsed = CheckoutPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CheckoutError(400, parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '));
  }
  return parsed.data;
};

export const normalizeShippingAddress = (addr: unknown) =>
  CheckoutShippingAddressSchema.parse(addr ?? {});
export const normalizeCustomer = (cust: unknown) => CheckoutCustomerSchema.parse(cust ?? {});

/**
 * Creates a storefront order inside a transaction:
 *  - locks product rows (SELECT ... FOR UPDATE),
 *  - validates availability (quantity - reservedQuantity),
 *  - reserves stock,
 *  - computes totals server-side,
 *  - returns a signed order token for guest tracking.
 */
export async function createCheckoutOrder(
  store: Store,
  payload: CheckoutPayload,
  customerId: number | null = null
): Promise<{
  order: DropshippingOrder;
  orderToken: string;
  totals: CheckoutTotals;
  requiresGateway: boolean;
  paymentStatus: 'pending' | 'awaiting';
}> {
  const { items, shipping_address, customer, payment_method, address_id, address_owner_token, note, website, coupon_code, attribution } = payload as any;

  if (website && website.trim().length > 0) {
    throw new CheckoutError(400, 'Spam detected');
  }

  let addr = shipping_address ? CheckoutShippingAddressSchema.parse(shipping_address) : null;
  let cust = CheckoutCustomerSchema.parse(customer ?? {});

  // Resolve a previously saved address book entry when the client references one
  if (address_id) {
    let saved: CustomerAddress | null = null;
    if (customerId) {
      saved = await CustomerAddress.findOne({ where: { id: address_id, storeId: store.id, customerId } });
    } else {
      if (!address_owner_token) throw new CheckoutError(403, 'address_owner_token is required for a saved address');
      const ownerTokenHash = crypto.createHash('sha256').update(address_owner_token).digest('hex');
      saved = await CustomerAddress.findOne({ where: { id: address_id, storeId: store.id, ownerTokenHash } });
    }
    if (!saved) throw new CheckoutError(403, 'Saved address does not belong to this customer');
    addr = CheckoutShippingAddressSchema.parse({
        full_name: saved.fullName,
        phone: saved.phone || '',
        city: saved.city,
        district: saved.district || '',
        address: saved.addressLine,
        zip_code: saved.zip || '',
    });
    cust = CheckoutCustomerSchema.parse({
        email: saved.email || '',
        name: saved.fullName,
        phone: saved.phone || '',
    });
  }

  if (!addr) throw new CheckoutError(400, 'shipping_address or a valid address_id is required');

  const requiresGateway = REQUIRES_GATEWAY(payment_method);
  const paymentStatus = requiresGateway ? 'awaiting' : 'pending';

  const transaction = await sequelize.transaction();
  try {
    const pricedItems: PricedOrderItem[] = [];

    for (const item of items) {
      const where: Record<string, unknown> = { storeId: store.id };
      if (item.product_id) where.id = item.product_id;
      else if (item.sku) where.sku = item.sku;
      else throw new CheckoutError(400, 'Sipariş kaleminde product_id veya sku gereklidir');

      const product = await Product.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
      if (!product) throw new CheckoutError(400, `Ürün bulunamadı: ${item.sku || item.product_id}`);
      if (!product.isActive) throw new CheckoutError(400, `Ürün satışta değil: ${product.title}`);

      const unitPrice = product.discountedPrice != null ? Number(product.discountedPrice) : Number(product.priceTRY);
      if (!unitPrice || unitPrice <= 0) throw new CheckoutError(400, `Ürünün fiyatı geçersiz: ${product.title}`);

      const available = (product.quantity ?? 0) - (product.reservedQuantity ?? 0);
      if (available < item.quantity) {
        throw new CheckoutError(400, `Yetersiz stok: ${product.title} (kalan ${Math.max(0, available)})`);
      }

      await product.increment('reservedQuantity', { by: item.quantity, transaction });

      pricedItems.push({
        product_id: product.id,
        sku: product.sku,
        quantity: item.quantity,
        productId: product.id,
        name: product.title,
        unitPrice,
        price: unitPrice,
        cost: product.cost != null && Number(product.cost) > 0 ? Number(product.cost) : unitPrice,
        image: (product.images && product.images[0]) || null,
      });
    }

    let discountAmount = 0;
    let coupon: Coupon | null = null;
    if (coupon_code) {
      coupon = await Coupon.findOne({ where: { storeId: store.id, code: coupon_code.toUpperCase(), isActive: true }, transaction });
      const now = new Date();
      if (!coupon || (coupon.startsAt && coupon.startsAt > now) || (coupon.endsAt && coupon.endsAt < now) || (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) || pricedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) < Number(coupon?.minimumAmount || 0)) throw new CheckoutError(400, 'Coupon is invalid or expired');
      discountAmount = coupon.discountType === 'percent' ? pricedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * Number(coupon.discountValue) / 100 : Number(coupon.discountValue);
      if (coupon.maxDiscount != null) discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
    }
    const totals = calculateTotals(pricedItems, store, discountAmount);
    const orderNumber = `ORD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const order = await DropshippingOrder.create(
      {
        storeId: store.id,
        customerId,
        orderNumber,
        marketplace: 'storefront',
        marketplaceOrderId: `SF-${orderNumber}`,
        status: 'pending',
        paymentMethod: payment_method,
        paymentProvider: requiresGateway ? payment_method : null,
        paymentStatus,
        subtotal: totals.subtotal,
        shippingAmount: totals.shippingAmount,
        taxAmount: totals.taxAmount,
        discountAmount: totals.discountAmount,
        couponCode: coupon?.code || null,
        totalAmount: totals.totalAmount,
        currency: store.currency || 'TRY',
        shippingAddress: {
          ...addr,
          name: addr.full_name,
          email: cust.email || null,
          phone: addr.phone,
        },
        items: pricedItems,
        customerName: addr.full_name,
        customerEmail: cust.email || null,
        customerPhone: addr.phone,
        note: coupon ? `${note || ''}${note ? ' | ' : ''}Coupon: ${coupon.code}` : (note || null),
        attribution: attribution || null,
      } as any,
      { transaction }
    );

    if (coupon) await coupon.increment('usedCount', { by: 1, transaction });

    await OrderStatusHistory.create(
      {
        dropshippingOrderId: order.id,
        fromStatus: null,
        toStatus: 'pending',
        note: 'Storefront checkout',
      },
      { transaction }
    );

    const orderToken = issueOrderToken(order.id, order.orderNumber);
    await order.update({ orderTokenHash: hashOrderToken(orderToken) }, { transaction });

    // Route B2B-clone items to their suppliers as sub-orders (Faz 7)
    const { itemsByStore } = await detectVendors(pricedItems);
    const vendorStoreIds = [...itemsByStore.keys()].filter((id) => id !== 0);
    if (vendorStoreIds.length > 0) {
      await createVendorSubOrders(order, itemsByStore, vendorStoreIds, transaction, {
        status: 'pending',
        paymentMethod: payment_method || 'bank_transfer',
        paymentProvider: requiresGateway && payment_method ? payment_method : undefined,
        paymentStatus,
      });
    }

    await transaction.commit();

    // Ensure customer record exists
    let resolvedCustomerId = customerId;
    if (!resolvedCustomerId && cust.email) {
      const custRecord = await findOrCreateCustomer(store.id, {
        name: addr.full_name,
        email: cust.email,
        phone: addr.phone || undefined,
        source: 'storefront',
      });
      if (custRecord) {
        resolvedCustomerId = custRecord.id;
        await order.update({ customerId: custRecord.id });
      }
    }

    // Send order confirmation email (storefront only)
    if (cust.email) {
      try {
        const email = buildOrderEmail('order_created', {
          orderNumber,
          customerName: addr.full_name,
          status: 'pending',
          totalAmount: totals.totalAmount,
          items: pricedItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.unitPrice })),
          storeName: store.name,
        });
        const customer = resolvedCustomerId ? await Customer.findOne({ where: { id: resolvedCustomerId, storeId: store.id } }) : null;
        if (customer && customer.source === 'storefront') {
          await notifyCustomer(customer, { type: 'order_created', title: email.subject, body: email.html, metadata: { orderId: order.id } });
        } else if (customer?.email) {
          const { notificationProviders } = await import('../customer/notifications.js');
          const providers = notificationProviders(store.id);
          await providers.email.send(customer.email, email.subject, email.html);
        }
      } catch (err: any) {
        logger.error({ err: err.message, orderId: order.id }, 'Failed to send order confirmation email');
      }
    }

    logger.info(
      `Checkout: order ${order.id} (${orderNumber}), method=${payment_method}, total=${totals.totalAmount} ${store.currency || 'TRY'}`
    );
    return { order, orderToken, totals, requiresGateway, paymentStatus };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/** Releases reservations left behind by abandoned gateway checkouts. */
export async function releaseExpiredCheckoutReservations(maxAgeMinutes = 30): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const candidates = await DropshippingOrder.findAll({
    where: {
      marketplace: 'storefront',
      status: 'pending',
      paymentStatus: 'awaiting',
      createdAt: { [Op.lt]: cutoff },
    },
    attributes: ['id'],
  });
  let released = 0;
  for (const candidate of candidates) {
    await sequelize.transaction(async (transaction) => {
      const order = await DropshippingOrder.findOne({
        where: { id: candidate.id, status: 'pending', paymentStatus: 'awaiting' },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!order) return;
      for (const item of ((order.items as any[]) || [])) {
        const product = await Product.findOne({
          where: { id: Number(item.product_id), storeId: order.storeId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!product) continue;
        const amount = Math.min(Number(product.reservedQuantity) || 0, Number(item.quantity) || 0);
        if (amount > 0) await product.decrement('reservedQuantity', { by: amount, transaction });
      }
      await order.update({
        status: 'cancelled',
        paymentStatus: 'failed',
        note: 'Payment session expired; stock reservation released',
      }, { transaction });
      if (order.couponCode) {
        await Coupon.decrement('usedCount', { by: 1, where: { storeId: order.storeId, code: order.couponCode, usedCount: { [Op.gt]: 0 } }, transaction });
      }
      await OrderStatusHistory.create({
        dropshippingOrderId: order.id,
        fromStatus: 'pending',
        toStatus: 'cancelled',
        note: 'Payment session expired; stock reservation released',
      }, { transaction });
      released += 1;
    });
  }
  return released;
}
