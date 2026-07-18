import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { OrderStatusHistory } from '../../models/OrderStatusHistory.model.js';
import { Product } from '../../models/Product.model.js';
import { ProductMarketplaceListing } from '../../models/ProductMarketplaceListing.model.js';
import { Store } from '../../models/Store.model.js';
import { logger } from '../../utils/logger.js';

export const integrationRoutes = Router();

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

    const order = await DropshippingOrder.create({
      storeId: store.id,
      orderNumber,
      marketplace,
      marketplaceOrderId: payload.id.toString(),
      marketplaceOrderNumber: payload.order_number,
      status: 'pending',
      totalAmount,
      currency: payload.currency || 'TRY',
      shippingAddress: payload.shipping_address || payload.address,
      items,
    });

    await OrderStatusHistory.create({
      dropshippingOrderId: order.id,
      fromStatus: null,
      toStatus: 'pending',
      note: `Order received from ${marketplace}`,
    });

    logger.info(`Webhook order created: ${order.id} from ${marketplace}`);
    res.status(201).json({ order, created: true });
  } catch (error) {
    logger.error('Webhook order error:', error);
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
    logger.error('Webhook stock error:', error);
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
    logger.error('Webhook price error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});