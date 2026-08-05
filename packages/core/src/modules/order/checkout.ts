import crypto from 'crypto';
import { sequelize } from '../../config/database.js';
import { config } from '../../config/env.js';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { OrderStatusHistory } from '../../models/OrderStatusHistory.model.js';
import { Product } from '../../models/Product.model.js';
import { CustomerAddress } from '../../models/CustomerAddress.model.js';
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
import type { Store } from '../../models/Store.model.js';

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
  image?: string | null;
}

/**
 * Server-side order total calculation. The client never supplies prices.
 * Pure function — unit-testable.
 */
export function calculateTotals(items: { quantity: number; unitPrice: number }[], store: Pick<Store, 'taxSettings' | 'shippingSettings'>): CheckoutTotals {
  const subtotal = round2(items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0));

  const shippingSettings = (store.shippingSettings as any) || {};
  const shippingEnabled = Boolean(shippingSettings.enabled);
  const shippingCost = Number(shippingSettings.cost ?? 0) || 0;
  const freeAbove = shippingSettings.freeAbove != null && shippingSettings.freeAbove !== '' ? Number(shippingSettings.freeAbove) : null;
  const shippingAmount =
    shippingEnabled && !(freeAbove != null && subtotal >= freeAbove) ? shippingCost : 0;

  const taxSettings = (store.taxSettings as any) || {};
  const taxRate = Number(taxSettings.rate ?? 0) || 0;
  const taxMode: CheckoutTotals['taxMode'] =
    taxRate > 0 ? (taxSettings.mode === 'included' ? 'included' : 'excluded') : 'none';

  let taxAmount = 0;
  if (taxMode === 'excluded') taxAmount = round2((subtotal * taxRate) / 100);
  else if (taxMode === 'included') taxAmount = round2((subtotal * taxRate) / (100 + taxRate));

  const totalAmount = round2(subtotal + shippingAmount + (taxMode === 'excluded' ? taxAmount : 0));

  return { subtotal, shippingAmount, taxAmount, totalAmount, taxMode, taxRate };
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
  payload: CheckoutPayload
): Promise<{
  order: DropshippingOrder;
  orderToken: string;
  totals: CheckoutTotals;
  requiresGateway: boolean;
  paymentStatus: 'pending' | 'awaiting';
}> {
  const { items, shipping_address, customer, payment_method, address_id, note, website } = payload;

  if (website && website.trim().length > 0) {
    throw new CheckoutError(400, 'Spam detected');
  }

  let addr = CheckoutShippingAddressSchema.parse(shipping_address);
  let cust = CheckoutCustomerSchema.parse(customer ?? {});

  // Resolve a previously saved address book entry when the client references one
  if (address_id) {
    const saved = await CustomerAddress.findOne({ where: { id: address_id, storeId: store.id } });
    if (saved) {
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
  }

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
        image: (product.images && product.images[0]) || null,
      });
    }

    const totals = calculateTotals(pricedItems, store);
    const orderNumber = `ORD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const order = await DropshippingOrder.create(
      {
        storeId: store.id,
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
        note: note || null,
      },
      { transaction }
    );

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

    await transaction.commit();

    logger.info(
      `Checkout: order ${order.id} (${orderNumber}), method=${payment_method}, total=${totals.totalAmount} ${store.currency || 'TRY'}`
    );
    return { order, orderToken, totals, requiresGateway, paymentStatus };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
