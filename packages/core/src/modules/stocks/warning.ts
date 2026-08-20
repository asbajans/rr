import { Op } from 'sequelize';
import { Store } from '../../models/Store.model.js';
import { Product } from '../../models/Product.model.js';
import { StoreNotification } from '../../models/StoreNotification.model.js';
import { logger } from '../../utils/logger.js';

/**
 * Stock review/warning system.
 *
 * Every store has a `lowStockThreshold` (default 5). Products whose `quantity`
 * drops to (or below) that threshold are flagged and the store is notified.
 * Notifications are deduplicated per product so a product crossing the
 * threshold only fires once until it is restocked back above the threshold.
 */

export async function getLowStockProducts(storeId: number, limit = 50): Promise<Product[]> {
  const store = await Store.findByPk(storeId);
  const threshold = store?.lowStockThreshold ?? 5;
  return Product.findAll({
    where: { storeId, isActive: true, quantity: { [Op.lte]: threshold } },
    order: [['quantity', 'ASC']],
    limit,
  });
}

export async function getLowStockCount(storeId: number): Promise<number> {
  const store = await Store.findByPk(storeId);
  const threshold = store?.lowStockThreshold ?? 5;
  return Product.count({ where: { storeId, isActive: true, quantity: { [Op.lte]: threshold } } });
}

/**
 * Scan one store's catalog and create low-stock notifications for products that
 * have crossed the threshold since their last notification (or were never
 * notified). A product is "notified" once; it becomes eligible again only after
 * stock rises back above the threshold.
 */
export async function checkStoreLowStock(storeId: number): Promise<number> {
  const store = await Store.findByPk(storeId);
  if (!store) return 0;
  const threshold = store.lowStockThreshold ?? 5;
  const products = await Product.findAll({
    where: { storeId, isActive: true, quantity: { [Op.lte]: threshold } },
    attributes: ['id', 'title', 'sku', 'quantity'],
  });
  if (products.length === 0) return 0;

  const productIds = products.map((p) => p.id);
  // Notifications we have already sent for these products (dedupe). data.productId
  // carries the product reference; created within the last 7 days is considered active.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const existing = await StoreNotification.findAll({
    where: {
      storeId,
      type: 'low_stock',
      createdAt: { [Op.gte]: since },
    },
  });
  const notified = new Set<number>();
  for (const n of existing) {
    const pid = (n.data as any)?.productId;
    if (pid != null) notified.add(Number(pid));
  }

  let created = 0;
  for (const p of products) {
    if (notified.has(Number(p.id))) continue;
    const title = String(p.title || p.sku || `Ürün #${p.id}`);
    await StoreNotification.create({
      storeId,
      userId: null,
      type: 'low_stock',
      title: 'Düşük Stok Uyarısı',
      body: `"${title}" stok seviyesi kritik eşiğe düştü (${p.quantity} adet).`,
      data: { productId: Number(p.id), sku: p.sku, quantity: p.quantity, threshold },
    });
    created++;
  }
  return created;
}

/**
 * Scan all stores and notify owners about products below their threshold.
 * Fire-and-forget; never throws. Called periodically from the server.
 */
export async function checkAllStoresLowStock(): Promise<number> {
  try {
    const stores = await Store.findAll({ where: { isActive: true }, attributes: ['id'] });
    let total = 0;
    for (const store of stores) {
      try {
        total += await checkStoreLowStock(Number(store.id));
      } catch (err) {
        logger.warn({ err, storeId: store.id }, 'Low-stock check failed for store');
      }
    }
    return total;
  } catch (err) {
    logger.error({ err }, 'checkAllStoresLowStock failed');
    return 0;
  }
}