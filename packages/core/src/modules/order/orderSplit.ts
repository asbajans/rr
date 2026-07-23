import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { OrderStatusHistory } from '../../models/OrderStatusHistory.model.js';
import { Product } from '../../models/Product.model.js';
import { B2BListedProduct } from '../../models/B2BModels.js';
import { logger } from '../../utils/logger.js';
import { Op } from 'sequelize';

interface OrderItem {
  sku?: string;
  productId?: number;
  name?: string;
  quantity: number;
  unitPrice?: number;
  price?: number;
  [key: string]: any;
}

interface SplitResult {
  mainStoreId: number;
  itemsByStore: Map<number, { items: OrderItem[]; totalAmount: number }>;
}

async function detectVendors(items: OrderItem[]): Promise<SplitResult> {
  const result: SplitResult = { mainStoreId: 0, itemsByStore: new Map() };
  const selfItems: OrderItem[] = [];
  let selfTotal = 0;

  for (const item of items) {
    const price = item.price || item.unitPrice || 0;
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
    existing.totalAmount += price * qty;
    result.itemsByStore.set(storeId, existing);
  }

  return result;
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
): Promise<{ mainOrder: DropshippingOrder; subOrders: DropshippingOrder[] }> {
  const { itemsByStore } = await detectVendors(items);

  // The main store's items are keyed by 0 (no vendor)
  const mainItems = itemsByStore.get(0)?.items || [];
  const mainTotal = itemsByStore.get(0)?.totalAmount || totalAmount;

  // Create main order for the receiving store
  const mainOrder = await DropshippingOrder.create({
    storeId,
    orderNumber,
    marketplace,
    marketplaceOrderId,
    marketplaceOrderNumber: marketplaceOrderNumber || payload?.order_number,
    status: 'pending',
    totalAmount: mainTotal,
    currency: currency || 'TRY',
    shippingAddress: shippingAddress || payload?.shipping_address || payload?.address,
    items: mainItems,
  });

  await OrderStatusHistory.create({
    dropshippingOrderId: mainOrder.id,
    fromStatus: null,
    toStatus: 'pending',
    note: `Order received from ${marketplace}`,
  });

  // Create sub-orders for vendor stores
  const subOrders: DropshippingOrder[] = [];
  for (const [vendorStoreId, vendorData] of itemsByStore) {
    if (vendorStoreId === 0) continue;

    const subOrder = await DropshippingOrder.create({
      storeId: vendorStoreId,
      orderNumber: `${orderNumber}-S${subOrders.length + 1}`,
      marketplace,
      marketplaceOrderId: `${marketplaceOrderId}-S${subOrders.length + 1}`,
      marketplaceOrderNumber: marketplaceOrderNumber || payload?.order_number,
      parentOrderId: mainOrder.id,
      status: 'pending',
      totalAmount: vendorData.totalAmount,
      currency: currency || 'TRY',
      shippingAddress: shippingAddress || payload?.shipping_address || payload?.address,
      items: vendorData.items,
    });

    await OrderStatusHistory.create({
      dropshippingOrderId: subOrder.id,
      fromStatus: null,
      toStatus: 'pending',
      note: `Sub-order for vendor store ${vendorStoreId} from ${marketplace} (parent: ${mainOrder.id})`,
    });

    subOrders.push(subOrder);
  }

  if (subOrders.length > 0) {
    logger.info(`Order split: main=${mainOrder.id}, sub-orders=${subOrders.length} (IDs: ${subOrders.map(s => s.id).join(',')})`);
  }

  return { mainOrder, subOrders };
}