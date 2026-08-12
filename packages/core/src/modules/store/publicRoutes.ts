import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { Store } from '../../models/Store.model.js';
import { Product } from '../../models/Product.model.js';
import { Category } from '../../models/Category.model.js';
import { Page, BlogPost, StoreLocation, StorePaymentMethod } from '../../models/ContentModels.js';
import { StoreMenu } from '../../models/Menu.model.js';
import { serializeLocation } from '../location/routes.js';
import { config } from '../../config/index.js';

export const publicStoreRoutes: Router = Router();

/**
 * Loads an active store by siteCode and enforces publish gating.
 * Unpublished (draft) stores are only reachable with ?preview=1 (used by the
 * owner during site builder work).
 */
async function resolveStore(siteCode: string, req: Request): Promise<Store | null> {
  const store = await Store.findOne({ where: { siteCode, isActive: true } });
  if (!store) return null;
  const preview = String((req.query as any).preview ?? '') === '1';
  if (!store.published && !preview) return null;
  return store;
}

function toAbsoluteImage(img: unknown): string | null {
  if (!img) return null;
  const url = typeof img === 'string' ? img : (img as any)?.url;
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${config.apiUrl}${url}`;
  return url;
}

publicStoreRoutes.get('/:siteCode', async (req: Request, res: Response) => {
  try {
    const { siteCode } = req.params;
    const store = await resolveStore(siteCode, req);
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
        published: store.published,
        theme: store.theme,
        homepage: store.homepage,
        taxSettings: store.taxSettings,
        shippingSettings: store.shippingSettings,
      },
      products: products.map((p: any) => {
        const hasTRY = p.priceTRY !== null && p.priceTRY !== undefined;
        const hasUSD = p.priceUSD !== null && p.priceUSD !== undefined;
        const firstImage = toAbsoluteImage(Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null);
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
    const store = await resolveStore(siteCode, req);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const locations = await StoreLocation.findAll({ where: { storeId: store.id, isActive: true } });
    res.json({ locations: locations.map(serializeLocation) });
  } catch (error) {
    console.error('Public locations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

publicStoreRoutes.get('/:siteCode/pixels', async (req: Request, res: Response) => {
  try {
    const { siteCode } = req.params;
    const store = await resolveStore(siteCode, req);
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
    const store = await resolveStore(siteCode, req);
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
    const store = await resolveStore(siteCode, req);
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
    const store = await resolveStore(siteCode, req);
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
    const store = await resolveStore(siteCode, req);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const page = await Page.findOne({ where: { storeId: store.id, slug, isActive: true } });
    if (!page) return res.status(404).json({ error: 'Page not found' });

    res.json({ page });
  } catch (error) {
    console.error('Public page error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

publicStoreRoutes.get('/:siteCode/blogs', async (req: Request, res: Response) => {
  try {
    const { siteCode } = req.params;
    const store = await resolveStore(siteCode, req);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '12'), 10) || 12));

    const where: any = { storeId: store.id, isActive: true };
    where.publishedAt = { [Op.lte]: new Date() };

    const { rows, count } = await BlogPost.findAndCountAll({
      where,
      attributes: ['id', 'slug', 'title', 'excerpt', 'coverImage', 'tags', 'author', 'publishedAt', 'createdAt'],
      order: [['publishedAt', 'DESC']],
      offset: (page - 1) * limit,
      limit,
    });

    res.json({
      posts: rows,
      pagination: { page, limit, total: count, totalPages: Math.max(1, Math.ceil(count / limit)) },
    });
  } catch (error) {
    console.error('Public blog list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

publicStoreRoutes.get('/:siteCode/blogs/:slug', async (req: Request, res: Response) => {
  try {
    const { siteCode, slug } = req.params;
    const store = await resolveStore(siteCode, req);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const where: any = { storeId: store.id, slug, isActive: true };
    where.publishedAt = { [Op.lte]: new Date() };

    const post = await BlogPost.findOne({ where });
    if (!post) return res.status(404).json({ error: 'Blog post not found' });

    res.json({ post });
  } catch (error) {
    console.error('Public blog post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

