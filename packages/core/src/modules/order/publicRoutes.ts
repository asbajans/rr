import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { Store } from '../../models/Store.model.js';
import { StorePaymentMethod } from '../../models/ContentModels.js';
import { apiKeyMiddleware } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const publicOrderRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

publicOrderRoutes.post('/:siteCode/checkout', apiKeyMiddleware, [
  body('items').isArray({ min: 1 }),
  body('shippingAddress').isObject(),
  body('paymentMethod').isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { items, shippingAddress, paymentMethod } = req.body;

    // Validate payment method exists and is active
    const method = await StorePaymentMethod.findOne({
      where: { storeId: store.id, type: paymentMethod, isActive: true },
    });
    if (!method) {
      return res.status(400).json({ error: 'Geçersiz ödeme yöntemi' });
    }

    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    const orderNumber = `ORD-${Date.now()}`;

    const paymentStatus = paymentMethod === 'cash_on_delivery' ? 'pending' : 'awaiting';

    const order = await DropshippingOrder.create({
      storeId: store.id,
      orderNumber,
      marketplace: 'storefront',
      marketplaceOrderId: `SF-${Date.now()}`,
      status: paymentStatus === 'pending' ? 'pending' : 'pending',
      paymentMethod,
      paymentStatus,
      totalAmount,
      currency: store.currency || 'TRY',
      shippingAddress,
      items,
    });

    // For bank_transfer/cash_on_delivery, auto-confirm
    // For stripe/iyzico/paytr, frontend needs to complete payment separately
    const requiresPaymentGateway = ['stripe', 'iyzico', 'paytr'].includes(paymentMethod);

    logger.info(`Checkout: order ${order.id}, method=${paymentMethod}, amount=${totalAmount} ${store.currency || 'TRY'}`);

    res.status(201).json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentMethod,
      paymentStatus,
      requiresPaymentGateway,
      message: requiresPaymentGateway
        ? 'Ödeme bekleniyor'
        : 'Sipariş başarıyla oluşturuldu',
    });
  } catch (error) {
    logger.error({ err: error }, 'Checkout error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

publicOrderRoutes.get('/:siteCode/orders', apiKeyMiddleware, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const orders = await DropshippingOrder.findAll({
      where: { storeId: store.id, marketplace: 'storefront' },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    res.json({ orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

publicOrderRoutes.get('/:siteCode/orders/:id', apiKeyMiddleware, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const order = await DropshippingOrder.findOne({
      where: { id: req.params.id, storeId: store.id },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});