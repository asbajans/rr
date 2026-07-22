import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { body, param, query, validationResult } from 'express-validator';
import { Product } from '../../models/Product.model.js';
import { Category } from '../../models/Category.model.js';
import { ProductVariant } from '../../models/ProductVariant.model.js';
import { Store } from '../../models/Store.model.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export const productRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

productRoutes.get('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const where: any = { storeId: store.id };
    if (req.query.status) where.isActive = req.query.status === 'active';
    if (req.query.categoryId) where.categoryId = req.query.categoryId;
    if (req.query.marketplace) where.marketplaces = { [Op.contains]: [req.query.marketplace] };
    if (req.query.priceMin) where.priceTRY = { ...where.priceTRY, [Op.gte]: req.query.priceMin };
    if (req.query.priceMax) where.priceTRY = { ...where.priceTRY, [Op.lte]: req.query.priceMax };
    if (req.query.search) where[Op.or] = [
      { title: { [Op.iLike]: `%${req.query.search}%` } },
      { sku: { [Op.iLike]: `%${req.query.search}%` } },
    ];

    const { count, rows } = await Product.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'slug'] }],
    });

    res.json({
      products: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List products error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

productRoutes.post('/', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('title').isString().isLength({ min: 2, max: 500 }),
  body('sku').isString().isLength({ min: 2, max: 100 }),
  body('categoryId').optional().isInt(),
  body('description').optional().isString(),
  body('gramWeight').optional().isFloat({ min: 0 }),
  body('milyem').optional().isInt({ min: 0, max: 999 }),
  body('effectiveMilyem').optional().isInt({ min: 0, max: 999 }),
  body('profitMargin').optional().isFloat({ min: 0, max: 100 }),
  body('priceMultiplier').optional().isFloat({ min: 0.1, max: 10 }),
  body('priceTRY').optional().isFloat({ min: 0 }),
  body('priceUSD').optional().isFloat({ min: 0 }),
  body('isB2BEnabled').optional().isBoolean(),
  body('b2bDiscount').optional().isFloat({ min: 0, max: 100 }),
  body('b2bPrice').optional().isFloat({ min: 0 }),
  body('discountRate').optional().isFloat({ min: 0, max: 100 }),
  body('quantity').optional().isInt({ min: 0 }),
  body('images').optional().isArray(),
  body('videoUrl').optional().isURL(),
  body('marketplaces').optional().isArray(),
  body('marketplaceConfig').optional().isObject(),
  body('hasVariants').optional().isBoolean(),
  body('variantAttributes').optional().isObject(),
  body('tags').optional().isArray(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const user = (req as any).user;

    const existing = await Product.findOne({ where: { storeId: store.id, sku: req.body.sku } });
    if (existing) {
      return res.status(409).json({ error: 'SKU already exists' });
    }

    const slug = req.body.title.toLowerCase()
      .replace(/[^a-z0-9ğüşıöç]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + Date.now().toString(36);

    const product = await Product.create({
      ...req.body,
      storeId: store.id,
      slug,
      isActive: true,
    });

    logger.info(`Product created: ${product.id} (${product.sku}) by store ${store.id}`);

    // Auto-queue sync for configured marketplaces
    const mps = req.body.marketplaces;
    if (Array.isArray(mps) && mps.length > 0) {
      try {
        const syncQueue = (await import('../../queues/index.js')).syncQueue;
        await syncQueue.add('product-sync', { productId: product.id, storeId: store.id, marketplaces: mps, trigger: 'create' });
      } catch (e) {
        logger.warn({ err: e }, 'Failed to auto-queue sync for new product');
      }
    }

    res.status(201).json({ product });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create product error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

productRoutes.get('/:id', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const product = await Product.findOne({
      where: { id: req.params.id, storeId: store.id },
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
        { model: ProductVariant, as: 'variants' },
      ],
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get product error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

productRoutes.put('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('title').optional().isString().isLength({ min: 2, max: 500 }),
  body('sku').optional().isString().isLength({ min: 2, max: 100 }),
  body('categoryId').optional().isInt(),
  body('description').optional().isString(),
  body('gramWeight').optional().isFloat({ min: 0 }),
  body('milyem').optional().isInt({ min: 0, max: 999 }),
  body('effectiveMilyem').optional().isInt({ min: 0, max: 999 }),
  body('profitMargin').optional().isFloat({ min: 0, max: 100 }),
  body('priceMultiplier').optional().isFloat({ min: 0.1, max: 10 }),
  body('priceTRY').optional().isFloat({ min: 0 }),
  body('priceUSD').optional().isFloat({ min: 0 }),
  body('isB2BEnabled').optional().isBoolean(),
  body('b2bDiscount').optional().isFloat({ min: 0, max: 100 }),
  body('b2bPrice').optional().isFloat({ min: 0 }),
  body('discountRate').optional().isFloat({ min: 0, max: 100 }),
  body('quantity').optional().isInt({ min: 0 }),
  body('images').optional().isArray(),
  body('videoUrl').optional().isURL(),
  body('marketplaces').optional().isArray(),
  body('marketplaceConfig').optional().isObject(),
  body('hasVariants').optional().isBoolean(),
  body('variantAttributes').optional().isObject(),
  body('tags').optional().isArray(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const product = await Product.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (req.body.sku && req.body.sku !== product.sku) {
      const existing = await Product.findOne({ where: { storeId: store.id, sku: req.body.sku } });
      if (existing) {
        return res.status(409).json({ error: 'SKU already exists' });
      }
    }

    const changedFields = Object.keys(req.body);
    await product.update(req.body);
    logger.info(`Product updated: ${product.id} (${product.sku})`);

    // Auto-queue sync for configured marketplaces on price/stock/fields change
    const mps = req.body.marketplaces || product.marketplaces;
    const syncTriggers = ['priceTRY', 'quantity', 'title', 'description', 'images', 'discountRate', 'isActive', 'marketplaces'];
    if (Array.isArray(mps) && mps.length > 0 && changedFields.some(f => syncTriggers.includes(f))) {
      try {
        const syncQueue = (await import('../../queues/index.js')).syncQueue;
        await syncQueue.add('product-sync', { productId: product.id, storeId: store.id, marketplaces: mps, trigger: 'update' });
      } catch (e) {
        logger.warn({ err: e }, 'Failed to auto-queue sync for updated product');
      }
    }

    res.json({ product });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update product error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

productRoutes.delete('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const product = await Product.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await product.destroy();
    logger.info(`Product deleted: ${req.params.id} (store: ${store.id})`);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete product error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

productRoutes.post('/bulk-delete', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('ids').isArray({ min: 1 }),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { ids } = req.body;

    await Product.destroy({ where: { id: ids, storeId: store.id } });
    logger.info(`Bulk deleted ${ids.length} products for store ${store.id}`);
    res.json({ success: true, deleted: ids.length });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Bulk delete error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

productRoutes.post('/:id/verify', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('marketplace').isString().isIn(['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy']),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplace } = req.body;

    const product = await Product.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const integration = await (await import('../../models/MarketplaceIntegration.model.js')).MarketplaceIntegration.findOne({
      where: { storeId: store.id, marketplace, isActive: true },
    });

    if (!integration) {
      return res.status(400).json({ error: 'Marketplace not configured' });
    }

    const listing = await (await import('../../models/ProductMarketplaceListing.model.js')).ProductMarketplaceListing.findOne({
      where: { productId: product.id, platform: marketplace },
    });

    if (listing && listing.externalId) {
      return res.json({ verified: true, externalId: listing.externalId, status: listing.status });
    }

    res.json({ verified: false, message: 'Product not yet listed on this marketplace' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Verify product error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

productRoutes.post('/:id/sync', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('marketplaces').optional().isArray(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplaces } = req.body;

    const product = await Product.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const syncQueue = (await import('../../queues/index.js')).syncQueue;
    const job = await syncQueue.add('product-sync', { productId: product.id, storeId: store.id, marketplaces, trigger: 'manual' });

    res.status(202).json({ jobId: job.id, message: 'Sync job queued' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Product sync error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/products/:id/variants — list variants for a product
productRoutes.get('/:id/variants', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const product = await Product.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const variants = await ProductVariant.findAll({
      where: { productId: product.id, storeId: store.id },
      order: [['createdAt', 'ASC']],
    });
    res.json({ variants });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List variants error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/products/:id/variants — create variant for a product
productRoutes.post('/:id/variants', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('sku').isString().isLength({ min: 2, max: 100 }),
  body('attributes').isObject().notEmpty(),
  body('gramWeight').optional().isFloat({ min: 0 }),
  body('quantity').optional().isInt({ min: 0 }),
  body('priceTRY').optional().isFloat({ min: 0 }),
  body('priceUSD').optional().isFloat({ min: 0 }),
  body('b2bPrice').optional().isFloat({ min: 0 }),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const product = await Product.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const existing = await ProductVariant.findOne({ where: { productId: product.id, sku: req.body.sku } });
    if (existing) return res.status(409).json({ error: 'SKU already exists for this product' });
    const variant = await ProductVariant.create({ productId: product.id, storeId: store.id, ...req.body });
    await product.update({ hasVariants: true });
    logger.info(`Variant created: ${variant.id} (${variant.sku}) for product ${product.id}`);
    res.status(201).json({ variant });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create variant error');
    res.status(500).json({ error: 'Internal server error' });
  }
});