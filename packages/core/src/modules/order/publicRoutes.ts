import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { Store } from '../../models/Store.model.js';
import { StorePaymentMethod } from '../../models/ContentModels.js';
import { apiKeyMiddleware } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';
import { resolveCustomer } from '../customer/middleware.js';
import {
  createCheckoutOrder,
  verifyOrderToken,
  parseCheckoutPayload,
  CheckoutError,
} from './checkout.js';

export const publicOrderRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

async function resolveStore(req: Request, res: Response): Promise<Store | null> {
  const store = await Store.findOne({ where: { siteCode: req.params.siteCode, isActive: true } });
  if (!store) {
    res.status(404).json({ error: 'Not found', message: 'Store not found' });
    return null;
  }
  return store;
}

// Public, anonymous storefront checkout. Pricing/stock/tax/shipping computed server-side.
publicOrderRoutes.post('/:siteCode/checkout', [
  body().isObject(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = await resolveStore(req, res);
    if (!store) return;
    (req as any).store = store;
    const customer = await resolveCustomer(req);

    let payload;
    try {
      payload = parseCheckoutPayload(req.body);
    } catch (e: any) {
      if (e instanceof CheckoutError) {
        return res.status(e.status).json({ error: e.message });
      }
      throw e;
    }

    // Validate payment method exists and is active for this store
    const method = await StorePaymentMethod.findOne({
      where: { storeId: store.id, type: payload.payment_method, isActive: true },
    });
    if (!method) {
      return res.status(400).json({ error: 'Geçersiz ödeme yöntemi' });
    }

    const result = await createCheckoutOrder(store, payload, customer?.id || null);

    res.status(201).json({
      orderId: result.order.id,
      orderNumber: result.order.orderNumber,
      orderToken: result.orderToken,
      paymentMethod: payload.payment_method,
      paymentStatus: result.paymentStatus,
      requiresPaymentGateway: result.requiresGateway,
      totals: result.totals,
      message: result.requiresGateway
        ? 'Ödeme bekleniyor'
        : 'Sipariş başarıyla oluşturuldu',
    });
  } catch (error) {
    logger.error({ err: error }, 'Checkout error');
    if (error instanceof CheckoutError) {
      return res.status(error.status).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Internal/admin listing (requires API key).
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

// Public single-order lookup for the customer (guest tracking via ?token=).
publicOrderRoutes.get('/:siteCode/orders/:id', async (req: Request, res: Response) => {
  try {
    const store = await resolveStore(req, res);
    if (!store) return;

    const order = await DropshippingOrder.findOne({
      where: { id: req.params.id, storeId: store.id, marketplace: 'storefront' },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const token = req.query.token as string | undefined;
    const tokenData = token ? verifyOrderToken(token) : null;
    if (!tokenData || tokenData.id !== order.id || tokenData.n !== order.orderNumber) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Geçerli sipariş takip kodu gerekli' });
    }

    res.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        totalAmount: order.totalAmount,
        currency: order.currency,
        trackingNumber: order.trackingNumber,
        carrier: order.carrier,
        items: order.items,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
