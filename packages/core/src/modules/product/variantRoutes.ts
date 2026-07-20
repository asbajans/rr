import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { Product } from '../../models/Product.model.js';
import { ProductVariant } from '../../models/ProductVariant.model.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const variantRoutes = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

variantRoutes.get('/product/:productId', authMiddleware, requireStore, [
  param('productId').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const product = await Product.findOne({ where: { id: req.params.productId, storeId: store.id } });
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

variantRoutes.post('/product/:productId', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('productId').isInt(),
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
    const product = await Product.findOne({ where: { id: req.params.productId, storeId: store.id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const existing = await ProductVariant.findOne({ where: { productId: product.id, sku: req.body.sku } });
    if (existing) return res.status(409).json({ error: 'SKU already exists for this product' });

    const variant = await ProductVariant.create({
      productId: product.id,
      storeId: store.id,
      ...req.body,
    });

    await product.update({ hasVariants: true });

    logger.info(`Variant created: ${variant.id} (${variant.sku}) for product ${product.id}`);
    res.status(201).json({ variant });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create variant error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

variantRoutes.put('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('sku').optional().isString().isLength({ min: 2, max: 100 }),
  body('attributes').optional().isObject(),
  body('gramWeight').optional().isFloat({ min: 0 }),
  body('quantity').optional().isInt({ min: 0 }),
  body('priceTRY').optional().isFloat({ min: 0 }),
  body('priceUSD').optional().isFloat({ min: 0 }),
  body('b2bPrice').optional().isFloat({ min: 0 }),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const variant = await ProductVariant.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!variant) return res.status(404).json({ error: 'Variant not found' });

    if (req.body.sku && req.body.sku !== variant.sku) {
      const existing = await ProductVariant.findOne({ where: { productId: variant.productId, sku: req.body.sku } });
      if (existing) return res.status(409).json({ error: 'SKU already exists' });
    }

    await variant.update(req.body);
    logger.info(`Variant updated: ${variant.id}`);
    res.json({ variant });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update variant error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

variantRoutes.delete('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const variant = await ProductVariant.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!variant) return res.status(404).json({ error: 'Variant not found' });

    await variant.destroy();
    const remaining = await ProductVariant.count({ where: { productId: variant.productId, storeId: store.id } });
    if (remaining === 0) {
      await Product.update({ hasVariants: false }, { where: { id: variant.productId, storeId: store.id } });
    }
    logger.info(`Variant deleted: ${req.params.id}`);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete variant error');
    res.status(500).json({ error: 'Internal server error' });
  }
});