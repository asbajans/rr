import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { OrderStatusHistory } from '../../models/OrderStatusHistory.model.js';
import { Product } from '../../models/Product.model.js';
import { ProductMarketplaceListing } from '../../models/ProductMarketplaceListing.model.js';
import { MarketplaceIntegration } from '../../models/MarketplaceIntegration.model.js';
import { Store } from '../../models/Store.model.js';
import { IntegrationLog } from '../../models/LogModels.js';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import { createSplitOrder } from '../order/orderSplit.js';
import { importMarketplaceOrders } from './orderImport.js';
import { notifyStore } from '../notification/service.js';
import { Op } from 'sequelize';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/env.js';

export const integrationRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

const MP_LABELS: Record<string, string> = {
  trendyol: 'Trendyol', hepsiburada: 'Hepsiburada', pazarama: 'Pazarama',
  n11: 'N11', amazon: 'Amazon', etsy: 'Etsy',
};

async function importNotify(order: any, storeId: number, marketplace: string) {
  try {
    await notifyStore({
      storeId,
      type: 'new_order',
      title: `Yeni ${MP_LABELS[marketplace] || marketplace} siparişi`,
      body: `#${order.orderNumber} alındı`,
      data: { marketplace, orderId: Number(order.id), orderNumber: order.orderNumber },
    });
  } catch (err) {
    logger.warn({ err }, 'Webhook order notification failed (non-fatal)');
  }
}

integrationRoutes.post('/webhook/order', [
  body('marketplace').isIn(['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy']),
  body('payload').isObject(),
], validate, async (req: Request, res: Response) => {
  const internalKey = req.headers['x-internal-key'] as string;
  if (internalKey !== config.apiKey.internalKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { marketplace, payload, storeId: topLevelStoreId } = req.body;
    const storeId = payload?.storeId || topLevelStoreId;

    if (!storeId) {
      return res.status(400).json({ error: 'storeId is required' });
    }

    const store = await Store.findOne({
      where: { id: storeId },
    });

    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const marketplaceOrderId = payload.marketplaceOrderId || payload.id?.toString() || payload.orderId?.toString() || `${marketplace}_${Date.now()}`;
    const orderNumber = payload.orderNumber || payload.order_id || marketplaceOrderId || `ORD-${Date.now()}`;

    const items = payload.items || payload.products || [];
    const totalAmount = payload.totalAmount || items.reduce((sum: number, item: any) => sum + ((item.price || item.unitPrice || 0) * (item.quantity || 1)), 0);

    const shippingAddress = payload.shippingAddress || payload.shipping_address || payload.address || {};
    const payloadStatus = payload.status || 'pending';

    const existing = await DropshippingOrder.findOne({
      where: { marketplaceOrderId, marketplace },
    });

    if (existing) {
      if (existing.status !== payloadStatus) {
        const oldStatus = existing.status;
        await existing.update({ status: payloadStatus, items, shippingAddress, totalAmount });
        await OrderStatusHistory.create({
          dropshippingOrderId: existing.id,
          fromStatus: oldStatus,
          toStatus: payloadStatus,
          note: `Status synced from ${marketplace} webhook: ${oldStatus} -> ${payloadStatus}`,
        });
        logger.info(`Webhook order ${existing.id} status updated: ${oldStatus} -> ${payloadStatus}`);
      }
      return res.json({ order: existing, created: false });
    }

    const { mainOrder, subOrders } = await createSplitOrder(
      store.id, marketplace, marketplaceOrderId,
      items, totalAmount, orderNumber,
      payload.currency || 'TRY',
      shippingAddress,
      payload,
      payload.marketplaceOrderNumber || payload.order_number,
      payload.customerName || payload.customer_name,
      payload.customerEmail || payload.customer_email,
      payload.customerPhone || payload.customer_phone,
      {
        orderDate: payload.orderDate || payload.createdAt || payload.created_at || undefined,
      },
    );

    logger.info(`Webhook order created: ${mainOrder.id} from ${marketplace}${subOrders.length > 0 ? ` with ${subOrders.length} sub-order(s)` : ''}`);

    importNotify(mainOrder, store.id, marketplace);

    if (subOrders.length > 0) {
      const user = (req as any).user;
      await IntegrationLog.create({
        userId: user?.id || 0,
        storeId: store.id,
        platform: marketplace,
        endpoint: '/webhook/order',
        method: 'POST',
        isSuccess: true,
        requestPayload: { marketplace, itemCount: items.length },
        responsePayload: { mainOrderId: mainOrder.id, subOrderIds: subOrders.map(s => s.id) },
        errorMessage: null,
        createdAt: new Date(),
      });
    }

    return res.status(201).json({ order: mainOrder, subOrders, created: true });
  } catch (error) {
    logger.error({ err: error }, 'Webhook order error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

integrationRoutes.post('/webhook/stock', [
  body('marketplace').isIn(['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy']),
  body('productId').isString(),
  body('quantity').isInt({ min: 0 }),
], validate, async (req: Request, res: Response) => {
  try {
    const { marketplace, productId, quantity } = req.body;

    const listing = await ProductMarketplaceListing.findOne({
      where: { platform: marketplace, externalCode: productId, status: 'active' },
      include: [{ model: Product, as: 'product' }],
    });

    if (!listing || !listing.product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await listing.product.update({ quantity });
    await listing.update({ lastSyncedAt: new Date() });

    logger.info(`Stock updated via webhook: ${productId} = ${quantity} on ${marketplace}`);
    res.json({ success: true, quantity });
  } catch (error) {
    logger.error({ err: error }, 'Webhook stock error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

integrationRoutes.post('/webhook/price', [
  body('marketplace').isIn(['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy']),
  body('productId').isString(),
  body('price').isFloat({ min: 0 }),
], validate, async (req: Request, res: Response) => {
  try {
    const { marketplace, productId, price } = req.body;

    const listing = await ProductMarketplaceListing.findOne({
      where: { platform: marketplace, externalCode: productId, status: 'active' },
      include: [{ model: Product, as: 'product' }],
    });

    if (!listing || !listing.product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await listing.product.update({ priceTRY: price });
    await listing.update({ lastSyncedAt: new Date() });

    logger.info(`Price updated via webhook: ${productId} = ${price} on ${marketplace}`);
    res.json({ success: true, price });
  } catch (error) {
    logger.error({ err: error }, 'Webhook price error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

integrationRoutes.get('/logs', authMiddleware, requireStore, [
  query('marketplace').optional().isString(),
  query('isSuccess').optional().isBoolean(),
  query('endpoint').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('offset').optional().isInt({ min: 0 }),
], async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplace, isSuccess, endpoint, limit = 50, offset = 0 } = req.query;
    const where: any = { storeId: store.id };
    if (marketplace) where.platform = marketplace;
    if (isSuccess !== undefined) where.isSuccess = isSuccess === 'true';
    if (endpoint) where.endpoint = { [Op.like]: `%${endpoint}%` };
    const { rows, count } = await IntegrationLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: Number(offset),
    });
    res.json({ logs: rows, total: count });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Integration logs error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

integrationRoutes.post('/:marketplace/import-orders', authMiddleware, requireStore, [
  param('marketplace').isIn(['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy']),
  body('startDate').optional().isString(),
  body('endDate').optional().isString(),
  body('status').optional().isString(),
  body('maxPages').optional().isInt({ min: 1, max: 20 }),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplace } = req.params;
    const { startDate, endDate, status, maxPages } = req.body;

    const result = await importMarketplaceOrders({
      storeId: store.id,
      marketplace,
      startDate,
      endDate,
      status,
      maxPages: maxPages || 5,
      notify: true,
    });

    res.json({ imported: result.imported, orders: result.orders });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Import orders error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

integrationRoutes.post('/import-all', authMiddleware, requireStore, [
  body('maxPages').optional().isInt({ min: 1, max: 20 }),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const maxPages = req.body.maxPages || 3;

    const integrations = await MarketplaceIntegration.findAll({
      where: { storeId: store.id, isActive: true },
    });

    const results: { marketplace: string; imported: number; error?: string }[] = [];
    let totalImported = 0;

    for (const integration of integrations) {
      try {
        const result = await importMarketplaceOrders({
          storeId: store.id,
          marketplace: integration.marketplace,
          maxPages,
          notify: true,
        });
        totalImported += result.imported;
        results.push({ marketplace: integration.marketplace, imported: result.imported, error: result.error });
      } catch (mpErr) {
        logger.warn({ marketplace: integration.marketplace, err: mpErr }, 'Import-all failed for marketplace');
        results.push({ marketplace: integration.marketplace, imported: 0, error: String((mpErr as any)?.message || mpErr) });
      }
    }

    res.json({ imported: totalImported, results });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Import-all orders error');
    res.status(500).json({ error: 'Internal server error' });
  }
});