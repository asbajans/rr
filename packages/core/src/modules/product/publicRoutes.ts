import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { Product } from '../../models/Product.model.js';
import { Category } from '../../models/Category.model.js';
import { Store } from '../../models/Store.model.js';
import { apiKeyMiddleware } from '../auth/middleware.js';
import { config } from '../../config/index.js';

export const publicProductRoutes: Router = Router();

function toAbsoluteImage(img: unknown): unknown {
  if (!img) return img;
  const url = typeof img === 'string' ? img : (img as any)?.url;
  if (!url) return img;
  if (url.startsWith('http://') || url.startsWith('https://')) return img;
  if (url.startsWith('/')) return `${config.apiUrl}${url}`;
  return img;
}

function normalizeProductImages(p: any): any {
  if (Array.isArray(p.images)) {
    p.images = p.images.map((img: unknown) => toAbsoluteImage(img));
  }
  return p;
}

/**
 * Products shown on the storefront must be explicitly enabled for the store's
 * own site: "Kendi Sitem" must be present in the `marketplaces` array, or the
 * product has no marketplace assigned at all (legacy site-only products).
 */
function siteProductWhere(storeId: number): any {
  return {
    storeId,
    isActive: true,
    [Op.or]: [
      { marketplaces: { [Op.contains]: ['Kendi Sitem'] } },
      { marketplaces: null },
      { marketplaces: [] },
    ],
  };
}

publicProductRoutes.get('/:siteCode/products', async (req: Request, res: Response) => {
  try {
    const { siteCode } = req.params;
    const store = await Store.findOne({ where: { siteCode, isActive: true, published: true } });
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const andFilters: any[] = [siteProductWhere(store.id)];
    if (req.query.categoryId) andFilters.push({ categoryId: req.query.categoryId });
    if (req.query.search) andFilters.push({ [Op.or]: [
      { title: { [Op.iLike]: `%${req.query.search}%` } },
      { sku: { [Op.iLike]: `%${req.query.search}%` } },
    ] });
    if (req.query.priceMin) andFilters.push({ priceTRY: { [Op.gte]: req.query.priceMin } });
    if (req.query.priceMax) andFilters.push({ priceTRY: { [Op.lte]: req.query.priceMax } });
    const where: any = { [Op.and]: andFilters };

    const { count, rows } = await Product.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'slug'] }],
    });

    res.json({
      products: rows.map((p: any) => normalizeProductImages(p)),
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (error) {
    console.error('Public products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

publicProductRoutes.get('/:siteCode/products/:id', async (req: Request, res: Response) => {
  try {
    const { siteCode, id } = req.params;
    const store = await Store.findOne({ where: { siteCode, isActive: true, published: true } });
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const baseWhere = siteProductWhere(store.id);
    const idNum = Number(id);
    const isNumericId = Number.isFinite(idNum) && /^\d+$/.test(String(id));
    const idOrSlugWhere: any = isNumericId
      ? { [Op.or]: [{ id: idNum }, { slug: id }] }
      : { slug: id };

    let product = await Product.findOne({
      where: { [Op.and]: [idOrSlugWhere, baseWhere] },
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
      ],
    });
    if (!product && isNumericId) {
      product = await Product.findOne({
        where: { [Op.and]: [{ slug: id }, baseWhere] },
        include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'slug'] }],
      });
    }
    if (!product) return res.status(404).json({ error: 'Product not found' });

    res.json({ product: normalizeProductImages(product) });
  } catch (error) {
    console.error('Public product detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

publicProductRoutes.get('/:siteCode/categories', async (req: Request, res: Response) => {
  try {
    const { siteCode } = req.params;
    const store = await Store.findOne({ where: { siteCode, isActive: true, published: true } });
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const categories = await Category.findAll({
      where: { storeId: store.id, isActive: true },
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    });
    res.json({ categories });
  } catch (error) {
    console.error('Public categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});