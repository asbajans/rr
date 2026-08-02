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

publicProductRoutes.get('/:siteCode/products', async (req: Request, res: Response) => {
  try {
    const { siteCode } = req.params;
    const store = await Store.findOne({ where: { siteCode, isActive: true } });
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const where: any = { storeId: store.id, isActive: true };
    if (req.query.categoryId) where.categoryId = req.query.categoryId;
    if (req.query.search) where[Op.or] = [
      { title: { [Op.iLike]: `%${req.query.search}%` } },
      { sku: { [Op.iLike]: `%${req.query.search}%` } },
    ];
    if (req.query.priceMin) where.priceTRY = { ...where.priceTRY, [Op.gte]: req.query.priceMin };
    if (req.query.priceMax) where.priceTRY = { ...where.priceTRY, [Op.lte]: req.query.priceMax };

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
    const store = await Store.findOne({ where: { siteCode, isActive: true } });
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const product = await Product.findOne({
      where: { id, storeId: store.id, isActive: true },
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
      ],
    });
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
    const store = await Store.findOne({ where: { siteCode, isActive: true } });
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