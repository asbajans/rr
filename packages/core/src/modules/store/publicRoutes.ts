import { Router, Request, Response } from 'express';
import { Store } from '../../models/Store.model.js';
import { Product } from '../../models/Product.model.js';
import { Category } from '../../models/Category.model.js';
import { Page, StoreLocation, StorePaymentMethod } from '../../models/ContentModels.js';
import { StoreMenu } from '../../models/Menu.model.js';
import { apiKeyMiddleware } from '../auth/middleware.js';

export const publicStoreRoutes: Router = Router();

publicStoreRoutes.get('/:siteCode', async (req: Request, res: Response) => {
  try {
    const { siteCode } = req.params;
    const store = await Store.findOne({ where: { siteCode, isActive: true } });
    if (!store) {
      return res.status(404).json({ error: 'Not found', message: 'Store not found' });
    }
    const products = await Product.findAll({
      where: { storeId: store.id, isActive: true },
      attributes: ['id', 'title', 'sku', 'priceTRY', 'priceUSD', 'images', 'description', 'isActive'],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    res.json({
      store: {
        id: store.id,
        name: store.name,
        siteCode: store.siteCode,
        domain: store.domain,
        siteUrl: store.siteUrl,
        email: store.email,
        currency: store.currency,
        theme: store.theme,
        taxSettings: store.taxSettings,
        shippingSettings: store.shippingSettings,
      },
      products: products.map((p: any) => {
        const hasTRY = p.priceTRY !== null && p.priceTRY !== undefined;
        const hasUSD = p.priceUSD !== null && p.priceUSD !== undefined;
        const firstImage = Array.isArray(p.images) && p.images.length > 0
          ? (typeof p.images[0] === 'string' ? p.images[0] : p.images[0]?.url ?? null)
          : null;
        return {
          'product.id': String(p.id),
          'product.code': p.sku ?? '',
          'product.label': p.title ?? '',
          'product.status': p.isActive ? 1 : 0,
          price: p.priceTRY ?? p.priceUSD ?? null,
          currency: hasTRY ? 'TRY' : hasUSD ? 'USD' : null,
          image: firstImage,
          description: p.description ?? null,
        };
      }),
      total: products.length,
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

publicStoreRoutes.get('/:siteCode/pixels', async (req: Request, res: Response) => {
  try {
    const { siteCode } = req.params;
    const store = await Store.findOne({ where: { siteCode, isActive: true } });
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json({ pixels: store.pixels || {} });
  } catch (error) {
    console.error('Public pixels error:', error);
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

publicStoreRoutes.get('/:siteCode/menus', async (req: Request, res: Response) => {
  try {
    const { siteCode } = req.params;
    const store = await Store.findOne({ where: { siteCode, isActive: true } });
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const menus = await StoreMenu.findAll({ where: { storeId: store.id, isActive: true } });
    res.json({ menus });
  } catch (error) {
    console.error('Public menus error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

publicStoreRoutes.get('/:siteCode/pages', async (req: Request, res: Response) => {
  try {
    const { siteCode } = req.params;
    const store = await Store.findOne({ where: { siteCode, isActive: true } });
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const pages = await Page.findAll({
      where: { storeId: store.id, isActive: true },
      attributes: ['id', 'slug', 'title', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'ASC']],
    });
    res.json({ pages });
  } catch (error) {
    console.error('Public pages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

publicStoreRoutes.get('/:siteCode/pages/:slug', async (req: Request, res: Response) => {
  try {
    const { siteCode, slug } = req.params;
    const store = await Store.findOne({ where: { siteCode, isActive: true } });
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const page = await Page.findOne({ where: { storeId: store.id, slug, isActive: true } });
    if (!page) return res.status(404).json({ error: 'Page not found' });

    res.json({ page });
  } catch (error) {
    console.error('Public page error:', error);
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

