import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { OrderStatusHistory } from '../../models/OrderStatusHistory.model.js';
import { Product } from '../../models/Product.model.js';
import { ProductMarketplaceListing } from '../../models/ProductMarketplaceListing.model.js';
import { Store } from '../../models/Store.model.js';
import { IntegrationLog } from '../../models/LogModels.js';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import { createSplitOrder } from '../order/orderSplit.js';
import { Op } from 'sequelize';
import { logger } from '../../utils/logger.js';

export const integrationRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

integrationRoutes.post('/webhook/order', [
  body('marketplace').isIn(['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy']),
  body('payload').isObject(),
], validate, async (req: Request, res: Response) => {
  try {
    const { marketplace, payload } = req.body;

    const store = await Store.findOne({
      where: { id: payload.storeId },
    });

    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const orderNumber = payload.orderNumber || payload.order_id || payload.id || `ORD-${Date.now()}`;
    const existing = await DropshippingOrder.findOne({
      where: { marketplaceOrderId: payload.id.toString(), marketplace },
    });

    if (existing) {
      return res.json({ order: existing, created: false });
    }

    const items = payload.items || payload.products || [];
    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

    const { mainOrder, subOrders } = await createSplitOrder(
      store.id, marketplace, payload.id.toString(),
      items, totalAmount, orderNumber,
      payload.currency || 'TRY',
      payload.shipping_address || payload.address,
      payload,
      payload.order_number,
    );

    logger.info(`Webhook order created: ${mainOrder.id} from ${marketplace}${subOrders.length > 0 ? ` with ${subOrders.length} sub-order(s)` : ''}`);

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