import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { body, param, validationResult } from 'express-validator';
import { MarketplaceIntegration } from '../../models/MarketplaceIntegration.model.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const marketplaceRoutes = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

const MARKETPLACES = ['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy'];

marketplaceRoutes.get('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const integrations = await MarketplaceIntegration.findAll({
      where: { storeId: store.id },
      order: [['marketplace', 'ASC']],
    });
    res.json({ integrations });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List integrations error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

marketplaceRoutes.get('/:marketplace', authMiddleware, requireStore, [
  param('marketplace').isIn(MARKETPLACES),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplace } = req.params;

    const integration = await MarketplaceIntegration.findOne({
      where: { storeId: store.id, marketplace },
    });

    if (!integration) {
      return res.json({ integration: null, marketplace });
    }

    const config = integration.config || {};
    const safeConfig = { ...config };
    delete safeConfig.apiSecret;
    delete safeConfig.password;
    delete safeConfig.clientSecret;
    delete safeConfig.accessToken;
    delete safeConfig.refreshToken;

    res.json({ integration: { ...integration.toJSON(), config: safeConfig }, marketplace });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get integration error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

marketplaceRoutes.put('/:marketplace', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('marketplace').isIn(MARKETPLACES),
  body('isActive').optional().isBoolean(),
  body('config').isObject(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplace } = req.params;
    const { isActive, config, etsyCategoryId, etsyShippingProfileId } = req.body;

    const integration = await MarketplaceIntegration.findOne({
      where: { storeId: store.id, marketplace },
    });

    if (integration) {
      await integration.update({
        isActive: isActive !== undefined ? isActive : integration.isActive,
        config: { ...integration.config, ...config },
        etsyCategoryId: etsyCategoryId || integration.etsyCategoryId,
        etsyShippingProfileId: etsyShippingProfileId || integration.etsyShippingProfileId,
        lastSyncAt: new Date(),
      });
    } else {
      const newIntegration = await MarketplaceIntegration.create({
        storeId: store.id,
        marketplace,
        isActive: isActive !== undefined ? isActive : true,
        config: config || {},
        etsyCategoryId: etsyCategoryId || null,
        etsyShippingProfileId: etsyShippingProfileId || null,
      });
      return res.status(201).json({ integration: newIntegration });
    }

    logger.info(`Integration updated: ${marketplace} for store ${store.id}`);
    res.json({ integration });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update integration error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

marketplaceRoutes.post('/:marketplace/import', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('marketplace').isIn(MARKETPLACES),
  body('maxPages').optional().isInt({ min: 1, max: 100 }),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplace } = req.params;
    const { maxPages = 10 } = req.body;

    const integration = await MarketplaceIntegration.findOne({
      where: { storeId: store.id, marketplace, isActive: true },
    });

    if (!integration) {
      return res.status(400).json({ error: 'Marketplace not configured or inactive' });
    }

    const importQueue = (await import('../../queues/index.js')).importQueue;
    const job = await importQueue.add(`import-${marketplace}`, {
      marketplace,
      storeId: store.id,
      maxPages,
    });

    res.status(202).json({ jobId: job.id, message: 'Import started' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Import error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

marketplaceRoutes.get('/:marketplace/import/:jobId', authMiddleware, requireStore, [
  param('marketplace').isIn(MARKETPLACES),
  param('jobId').isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const importQueue = (await import('../../queues/index.js')).importQueue;
    const job = await importQueue.getJob(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();
    const progress = job.progress;

    res.json({ jobId: job.id, state, progress, data: job.data, result: job.returnvalue, failedReason: job.failedReason });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Job status error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

marketplaceRoutes.get('/:marketplace/categories', authMiddleware, requireStore, [
  param('marketplace').isIn(MARKETPLACES),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;

    if (req.params.marketplace === 'etsy') {
      const integration = await MarketplaceIntegration.findOne({
        where: { storeId: store.id, marketplace: 'etsy', isActive: true },
      });

      if (!integration || !integration.config?.accessToken) {
        return res.status(400).json({ error: 'Etsy not connected via OAuth' });
      }

      const etsyClient = (await import('../../marketplace/clients/etsy.js')).default;
      const categories = await etsyClient.getCategories(integration.config.accessToken);
      return res.json({ categories });
    }

    res.json({ categories: [] });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get marketplace categories error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

marketplaceRoutes.post('/:marketplace/categories', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('marketplace').isIn(MARKETPLACES),
  body('categoryId').isInt(),
  body('marketplaceCategoryId').isString().isLength({ min: 1, max: 200 }),
  body('name').isString().isLength({ min: 1, max: 500 }),
  body('parentId').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplace } = req.params;

    const CategoryMapping = (await import('../../models/Category.model.js')).MarketplaceCategoryMapping;
    const Category = (await import('../../models/Category.model.js')).Category;

    const category = await Category.findOne({ where: { id: req.body.categoryId, storeId: store.id } });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const existing = await CategoryMapping.findOne({
      where: { categoryId: category.id, marketplace },
    });
    if (existing) {
      return res.status(409).json({ error: 'Mapping already exists' });
    }

    const mapping = await CategoryMapping.create({
      categoryId: category.id,
      marketplace,
      marketplaceCategoryId: req.body.marketplaceCategoryId,
      name: req.body.name,
      parentId: req.body.parentId || null,
    });

    logger.info(`Category mapping created: ${mapping.id} for ${marketplace}`);
    res.status(201).json({ mapping });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create category mapping error');
    res.status(500).json({ error: 'Internal server error' });
  }
});