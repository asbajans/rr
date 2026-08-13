import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { OrderStatusHistory } from '../../models/OrderStatusHistory.model.js';
import { Product } from '../../models/Product.model.js';
import { B2BListedProduct } from '../../models/B2BModels.js';
import { Supplier } from '../../models/Supplier.model.js';
import { logger } from '../../utils/logger.js';
import { Op } from 'sequelize';
import { Transaction } from 'sequelize';

interface OrderItem {
  sku?: string;
  productId?: number;
  name?: string;
  quantity: number;
  unitPrice?: number;
  price?: number;
  cost?: number;
  [key: string]: any;
}

interface SplitOptions {
  status?: string;
  trackingNumber?: string;
  carrier?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  note?: string;
  orderDate?: Date | null;
  transaction?: Transaction;
}

interface SplitResult {
  mainStoreId: number;
  itemsByStore: Map<number, { items: OrderItem[]; totalAmount: number }>;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export async function detectVendors(items: OrderItem[]): Promise<SplitResult> {
  const result: SplitResult = { mainStoreId: 0, itemsByStore: new Map() };
  const selfItems: OrderItem[] = [];
  let selfTotal = 0;

  for (const item of items) {
    const qty = item.quantity || 1;
    let vendorStoreId: number | null = null;

    if (item.productId) {
      const product = await Product.findByPk(item.productId, { attributes: ['storeId', 'originalStoreId'] });
      if (product && product.originalStoreId) {
        vendorStoreId = product.originalStoreId;
      }
    }

    if (item.sku) {
      const productBySku = await Product.findOne({
        where: { sku: item.sku },
        attributes: ['storeId', 'originalStoreId'],
      });
      if (productBySku && productBySku.originalStoreId) {
        vendorStoreId = productBySku.originalStoreId;
      }
    }

    const storeId = vendorStoreId || 0;
    const existing = result.itemsByStore.get(storeId) || { items: [], totalAmount: 0 };
    existing.items.push(item);
    result.itemsByStore.set(storeId, existing);
  }

  return result;
}

/**
 * Unit cost paid to the supplier for a line item. Falls back to the sale price
 * when no cost was recorded on the product.
 */
function lineUnitCost(item: OrderItem): number {
  if (item.cost != null && Number(item.cost) > 0) return Number(item.cost);
  return Number(item.price || item.unitPrice || 0);
}

export async function createSplitOrder(
  storeId: number,
  marketplace: string,
  marketplaceOrderId: string,
  items: OrderItem[],
  totalAmount: number,
  orderNumber: string,
  currency: string,
  shippingAddress: any,
  payload: any,
  marketplaceOrderNumber?: string,
  customerName?: string,
  customerEmail?: string,
  customerPhone?: string,
  options: SplitOptions = {},
): Promise<{ mainOrder: DropshippingOrder; subOrders: DropshippingOrder[] }> {
  const { itemsByStore } = await detectVendors(items);
  const tx = options.transaction;

  // The main store's items are keyed by 0 (no vendor)
  const mainItems = itemsByStore.get(0)?.items || [];
  const mainTotal = itemsByStore.get(0)?.totalAmount || totalAmount;

  const addr = shippingAddress || payload?.shipping_address || payload?.address || {};
  const fullName = customerName || payload?.customerName || payload?.customer_name || addr?.name || addr?.fullName || addr?.full_name;
  const email = customerEmail || payload?.customerEmail || payload?.customer_email || addr?.email;
  const phone = customerPhone || payload?.customerPhone || payload?.customer_phone || addr?.phone || addr?.phoneNumber;

  const status = options.status || 'pending';

  // Create main order for the receiving store
  const mainOrder = await DropshippingOrder.create(
    {
      storeId,
      orderNumber,
      marketplace,
      marketplaceOrderId,
      marketplaceOrderNumber: marketplaceOrderNumber || payload?.order_number,
      status,
      totalAmount: mainTotal,
      currency: currency || 'TRY',
      shippingAddress: {
        ...(typeof addr === 'object' ? addr : {}),
        name: fullName,
        email,
        phone,
      },
      items: mainItems,
      customerName: fullName,
      customerEmail: email,
      customerPhone: phone,
      trackingNumber: options.trackingNumber || null,
      carrier: options.carrier || null,
      paymentMethod: options.paymentMethod || null,
      paymentStatus: options.paymentStatus || 'pending',
      note: options.note || null,
      orderDate: options.orderDate || null,
    },
    { transaction: tx }
  );

  await OrderStatusHistory.create(
    {
      dropshippingOrderId: mainOrder.id,
      fromStatus: null,
      toStatus: status,
      note: `Order received from ${marketplace}`,
    },
    { transaction: tx }
  );

  // Create sub-orders for vendor stores
  const subOrders: DropshippingOrder[] = [];
  const vendorStoreIds = [...itemsByStore.keys()].filter((id) => id !== 0);

  if (vendorStoreIds.length > 0) {
    const created = await createVendorSubOrders(mainOrder, itemsByStore, vendorStoreIds, tx, {
      status,
      paymentMethod: options.paymentMethod,
      paymentStatus: options.paymentStatus,
      note: options.note,
      orderDate: options.orderDate,
    });
    subOrders.push(...created);
  }

  if (subOrders.length > 0) {
    logger.info(`Order split: main=${mainOrder.id}, sub-orders=${subOrders.length} (IDs: ${subOrders.map(s => s.id).join(',')})`);
  }

  return { mainOrder, subOrders };
}

interface VendorSubOrderOptions {
  status?: string;
  paymentMethod?: string;
  paymentProvider?: string;
  paymentStatus?: string;
  note?: string;
  orderDate?: Date | null;
}

/**
 * Platform commission + supplier net earnings for a sub-order, based on the
 * supplier cost total and the supplier's commission rate (percent).
 * Pure function — unit-testable.
 */
export function computeSettlement(costTotal: number, commissionRate: number): { commissionAmount: number; supplierEarnings: number } {
  const commissionAmount = round2((costTotal * (Number(commissionRate) || 0)) / 100);
  const supplierEarnings = round2(costTotal - commissionAmount);
  return { commissionAmount, supplierEarnings };
}

/**
 * Creates one sub-order per vendor for an already-created main order. Used by
 * both the split flow and the storefront checkout so every vendor item is
 * routed to its supplier and priced at cost.
 */
export async function createVendorSubOrders(
  mainOrder: DropshippingOrder,
  itemsByStore: Map<number, { items: OrderItem[]; totalAmount: number }>,
  vendorStoreIds: number[],
  tx?: Transaction,
  opts: VendorSubOrderOptions = {},
): Promise<DropshippingOrder[]> {
  const suppliers = vendorStoreIds.length > 0
    ? await Supplier.findAll({ where: { storeId: { [Op.in]: vendorStoreIds } } })
    : [];

  const subOrders: DropshippingOrder[] = [];
  let n = 0;

  for (const vendorStoreId of vendorStoreIds) {
    const vendorData = itemsByStore.get(vendorStoreId)!;

    const costTotal = round2(
      vendorData.items.reduce((sum, item) => sum + lineUnitCost(item) * (item.quantity || 1), 0)
    );

    const supplier = suppliers.find((s) => s.storeId === vendorStoreId);
    const commissionRate = Number(supplier?.commissionRate || 0);
    const { commissionAmount, supplierEarnings } = computeSettlement(costTotal, commissionRate);

    const subOrder = await DropshippingOrder.create(
      {
        storeId: vendorStoreId,
        orderNumber: `${mainOrder.orderNumber}-S${n + 1}`,
        marketplace: mainOrder.marketplace,
        marketplaceOrderId: mainOrder.marketplaceOrderId,
        marketplaceOrderNumber: mainOrder.marketplaceOrderNumber,
        parentOrderId: mainOrder.id,
        status: opts.status || mainOrder.status || 'pending',
        supplierStatus: 'pending',
        totalAmount: costTotal,
        commissionRate,
        commissionAmount,
        supplierEarnings,
        currency: mainOrder.currency || 'TRY',
        shippingAddress: mainOrder.shippingAddress,
        items: vendorData.items,
        customerName: mainOrder.customerName,
        customerEmail: mainOrder.customerEmail,
        customerPhone: mainOrder.customerPhone,
        paymentMethod: opts.paymentMethod || mainOrder.paymentMethod || null,
        paymentProvider: opts.paymentProvider || mainOrder.paymentProvider || null,
        paymentStatus: opts.paymentStatus || mainOrder.paymentStatus || 'pending',
        note: opts.note || null,
        orderDate: opts.orderDate || mainOrder.orderDate || null,
      },
      { transaction: tx }
    );

    await OrderStatusHistory.create(
      {
        dropshippingOrderId: subOrder.id,
        fromStatus: null,
        toStatus: opts.status || mainOrder.status || 'pending',
        note: `Sub-order for vendor store ${vendorStoreId} (parent: ${mainOrder.id})`,
      },
      { transaction: tx }
    );

    n++;
    subOrders.push(subOrder);
  }

  return subOrders;
}
