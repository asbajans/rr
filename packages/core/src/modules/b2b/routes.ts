import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { body, param, query, validationResult } from 'express-validator';
import { Product } from '../../models/Product.model.js';
import { ProductVariant } from '../../models/ProductVariant.model.js';
import { ProductB2bSetting } from '../../models/ProductB2bSetting.model.js';
import { B2BRequest, B2BListedProduct } from '../../models/B2BModels.js';
import { Store } from '../../models/Store.model.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const b2bRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

b2bRoutes.get('/discover', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const where: any = {
      isB2BEnabled: true,
      storeId: { [Op.ne]: store.id },
    };

    if (req.query.search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${req.query.search}%` } },
        { sku: { [Op.iLike]: `%${req.query.search}%` } },
      ];
    }

    const { count, rows } = await Product.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Store, as: 'store', attributes: ['id', 'name', 'siteCode'] },
        { model: ProductB2bSetting, as: 'b2bSetting', required: true },
      ],
    });

    const enriched = rows.map(p => ({
      ...p.toJSON(),
      b2bPrice: p.b2bSetting?.b2bPrice || p.priceTRY,
      b2bDiscount: p.b2bSetting?.b2bDiscount || 0,
      canRequest: true,
    }));

    res.json({
      products: enriched,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (error) {
    logger.error({ err: error }, 'B2B discover error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

b2bRoutes.get('/settings', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const settings = await ProductB2bSetting.findAll({
      where: { storeId: store.id },
      include: [{ model: Product, as: 'product', attributes: ['id', 'title', 'sku'] }],
    });
    res.json({ settings });
  } catch (error) {
    logger.error({ err: error }, 'B2B settings error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

b2bRoutes.put('/settings', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('productId').isInt(),
  body('isB2BEnabled').isBoolean(),
  body('b2bDiscount').optional().isFloat({ min: 0, max: 100 }),
  body('b2bPrice').optional().isFloat({ min: 0 }),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { productId, isB2BEnabled, b2bDiscount, b2bPrice } = req.body;

    const product = await Product.findOne({ where: { id: productId, storeId: store.id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const [setting] = await ProductB2bSetting.upsert({
      storeId: store.id,
      productId,
      isB2BEnabled,
      b2bDiscount: b2bDiscount || 0,
      b2bPrice: b2bPrice || null,
    }, { returning: true });

    logger.info(`B2B setting updated for product ${productId}`);
    res.json({ setting });
  } catch (error) {
    logger.error({ err: error }, 'Update B2B setting error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

b2bRoutes.get('/requests', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const type = req.query.type as string || 'all';
    const status = req.query.status as string;

    let where: any;
    if (type === 'incoming') where = { ownerStoreId: store.id };
    else if (type === 'outgoing') where = { requesterStoreId: store.id };
    else where = { [Op.or]: [{ ownerStoreId: store.id }, { requesterStoreId: store.id }] };

    if (status) where.status = status;

    const requests = await B2BRequest.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Product, as: 'product', attributes: ['id', 'title', 'sku', 'images'] },
        { model: ProductVariant, as: 'variant', attributes: ['id', 'sku', 'attributes'] },
        { model: Store, as: 'requesterStore', attributes: ['id', 'name', 'siteCode'] },
        { model: Store, as: 'ownerStore', attributes: ['id', 'name', 'siteCode'] },
      ],
    });

    res.json({ requests });
  } catch (error) {
    logger.error({ err: error }, 'List B2B requests error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

b2bRoutes.post('/requests', authMiddleware, requireStore, [
  body('productId').isInt(),
  body('variantId').optional().isInt(),
  body('requestNote').optional().isString(),
  body('profitMargin').optional().isFloat({ min: 0, max: 100 }),
  body('marketplaces').optional().isArray(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { productId, variantId, requestNote, profitMargin, marketplaces } = req.body;

    const product = await Product.findByPk(productId, {
      include: [{ model: ProductB2bSetting, as: 'b2bSetting', required: true }],
    });

    if (!product || !product.b2bSetting || !product.b2bSetting.isB2BEnabled) {
      return res.status(400).json({ error: 'Product not available for B2B' });
    }

    if (product.storeId === store.id) {
      return res.status(400).json({ error: 'Cannot request own product' });
    }

    const existing = await B2BRequest.findOne({
      where: { productId, requesterStoreId: store.id, ownerStoreId: product.storeId, status: 'pending' },
    });
    if (existing) return res.status(409).json({ error: 'Request already pending' });

    const request = await B2BRequest.create({
      productId,
      variantId: variantId || null,
      requesterStoreId: store.id,
      ownerStoreId: product.storeId,
      status: 'pending',
      requestNote: requestNote || '',
      profitMargin: profitMargin || product.b2bSetting.b2bDiscount || 0,
      marketplaces: marketplaces || [],
    });

    logger.info(`B2B request created: ${request.id} by store ${store.id} for product ${productId}`);
    res.status(201).json({ request });
  } catch (error) {
    logger.error({ err: error }, 'Create B2B request error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

b2bRoutes.put('/requests/:id', authMiddleware, requireStore, [
  param('id').isInt(),
  body('status').isIn(['approved', 'rejected']),
  body('profitMargin').optional().isFloat({ min: 0, max: 100 }),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { status, profitMargin } = req.body;

    const request = await B2BRequest.findOne({
      where: { id: req.params.id },
      include: [{ model: Product, as: 'product' }],
    });

    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.ownerStoreId !== store.id) return res.status(403).json({ error: 'Not authorized' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });

    await request.update({ status, profitMargin: profitMargin || request.profitMargin });

    logger.info(`B2B request ${request.id} ${status} by store ${store.id}`);
    res.json({ request });
  } catch (error) {
    logger.error({ err: error }, 'Update B2B request error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

b2bRoutes.post('/requests/:id/clone', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;

    const request = await B2BRequest.findOne({
      where: { id: req.params.id },
      include: [{ model: Product, as: 'product', include: [{ model: ProductVariant, as: 'variants' }] }],
    });

    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.requesterStoreId !== store.id) return res.status(403).json({ error: 'Not authorized' });
    if (request.status !== 'approved') return res.status(400).json({ error: 'Request must be approved first' });

    const product = await cloneProductForB2B(request, store, request.profitMargin);

    logger.info(`B2B product cloned: request ${request.id} → product ${product.id} for store ${store.id}`);
    res.status(201).json({ product });
  } catch (error) {
    logger.error({ err: error }, 'Clone B2B product error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function cloneProductForB2B(request: any, targetStore: any, profitMargin: number) {
  const originalProduct = request.product;
  const variant = request.variant;

  const b2bPrice = originalProduct.priceTRY 
    ? Math.round(originalProduct.priceTRY * (1 + profitMargin / 100) * 100) / 100
    : null;

  const clonedProduct = await Product.create({
    storeId: targetStore.id,
    originalStoreId: originalProduct.storeId,
    originalProductId: originalProduct.id,
    title: originalProduct.title,
    slug: originalProduct.title.toLowerCase().replace(/[^a-z0-9ğüşıöç]+/g, '-') + '-b2b-' + Date.now().toString(36),
    description: originalProduct.description,
    categoryId: originalProduct.categoryId,
    sku: `B2B-${originalProduct.sku}-${targetStore.siteCode}`,
    gramWeight: originalProduct.gramWeight,
    milyem: originalProduct.milyem,
    effectiveMilyem: originalProduct.effectiveMilyem,
    profitMargin,
    priceTRY: b2bPrice,
    priceUSD: originalProduct.priceUSD,
    quantity: variant?.quantity || originalProduct.quantity,
    images: originalProduct.images,
    videoUrl: originalProduct.videoUrl,
    marketplaces: [],
    marketplaceConfig: {},
    hasVariants: originalProduct.hasVariants,
    variantAttributes: originalProduct.variantAttributes,
    tags: originalProduct.tags,
    isActive: true,
    isB2BEnabled: true,
    b2bDiscount: 0,
    b2bPrice,
  });

  if (originalProduct.hasVariants && originalProduct.variants) {
    for (const origVariant of originalProduct.variants) {
      const vPrice = origVariant.priceTRY 
        ? Math.round(origVariant.priceTRY * (1 + profitMargin / 100) * 100) / 100
        : null;
      await ProductVariant.create({
        productId: clonedProduct.id,
        storeId: targetStore.id,
        sku: `B2B-${origVariant.sku}-${targetStore.siteCode}`,
        attributes: origVariant.attributes,
        gramWeight: origVariant.gramWeight,
        quantity: origVariant.quantity,
        priceTRY: vPrice,
        priceUSD: origVariant.priceUSD,
        b2bPrice: vPrice,
        isActive: true,
      });
    }
  }

  await B2BListedProduct.create({
    storeId: targetStore.id,
    originalStoreId: originalProduct.storeId,
    productId: clonedProduct.id,
    originalProductId: originalProduct.id,
    b2bRequestId: request.id,
    profitMargin,
  });

  return clonedProduct;
}

b2bRoutes.get('/listed', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const { count, rows } = await B2BListedProduct.findAndCountAll({
      where: { storeId: store.id },
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Product, as: 'product', attributes: ['id', 'title', 'sku', 'priceTRY', 'images', 'isActive'] },
        { model: Product, as: 'originalProduct', attributes: ['id', 'title', 'sku', 'priceTRY', 'storeId'] },
        { model: Store, as: 'originalStore', attributes: ['id', 'name', 'siteCode'] },
      ],
    });

    res.json({
      products: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (error) {
    logger.error({ err: error }, 'List B2B products error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});