import { Router, Request, Response } from 'express';
import { Store } from '../../models/Store.model.js';
import { Product } from '../../models/Product.model.js';
import { Category } from '../../models/Category.model.js';
import { Page, StoreLocation, StorePaymentMethod } from '../../models/ContentModels.js';
import { apiKeyMiddleware } from '../auth/middleware.js';

export const publicStoreRoutes = Router();

publicStoreRoutes.get('/:siteCode', async (req: Request, res: Response) => {
  try {
    const { siteCode } = req.params;
    const store = await Store.findOne({ where: { siteCode, isActive: true } });
    if (!store) {
      return res.status(404).json({ error: 'Not found', message: 'Store not found' });
    }
    res.json({
      id: store.id,
      name: store.name,
      siteCode: store.siteCode,
      domain: store.domain,
      email: store.email,
      currency: store.currency,
      theme: store.theme,
      taxSettings: store.taxSettings,
      shippingSettings: store.shippingSettings,
    });
  } catch (error) {
    console.error('Public store error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

publicStoreRoutes.get('/:siteCode/locations', async (req: Request, res: Response) => {
  try {
    const { siteCode } = req.params;
    const store = await Store.findOne({ where: { siteCode, isActive: true } });
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const locations = await StoreLocation.findAll({ where: { storeId: store.id, isActive: true } });
    res.json({ locations });
  } catch (error) {
    console.error('Public locations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

publicStoreRoutes.get('/:siteCode/payment-methods', async (req: Request, res: Response) => {
  try {
    const { siteCode } = req.params;
    const store = await Store.findOne({ where: { siteCode, isActive: true } });
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const methods = await StorePaymentMethod.findAll({ where: { storeId: store.id, isActive: true } });
    res.json({ paymentMethods: methods });
  } catch (error) {
    console.error('Public payment methods error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

publicStoreRoutes.post('/:siteCode/addresses', apiKeyMiddleware, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    res.json({ success: true, message: 'Address saved' });
  } catch (error) {
    console.error('Save address error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

publicStoreRoutes.post('/:siteCode/checkout', apiKeyMiddleware, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { items, shippingAddress, paymentMethod } = req.body;
    res.json({ success: true, orderId: `ORD-${Date.now()}`, message: 'Order placed' });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});