import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { body, param, validationResult } from 'express-validator';
import { Brand } from '../../models/Brand.model.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';
import { createMarketplaceClient } from '../../marketplace/clients/index.js';
import { MarketplaceClient } from '../../marketplace/clients/base.js';
import { MarketplaceIntegration } from '../../models/MarketplaceIntegration.model.js';
import { Product } from '../../models/Product.model.js';

export const brandRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

brandRoutes.get('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplace, search } = req.query;

    const where: any = { storeId: store.id };
    if (marketplace) where.marketplace = marketplace;
    if (search) where.name = { [Op.iLike]: `%${search}%` };

    const brands = await Brand.findAll({
      where,
      order: [['name', 'ASC']],
    });

    res.json({ brands });
  } catch (error) {
    logger.error({ err: error }, 'List brands error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

brandRoutes.post('/', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('name').isString().isLength({ min: 1, max: 200 }),
  body('marketplace').optional().isString(),
  body('marketplaceBrandId').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;

    const brand = await Brand.create({
      storeId: store.id,
      name: req.body.name,
      marketplace: req.body.marketplace || null,
      marketplaceBrandId: req.body.marketplaceBrandId || null,
    });

    logger.info(`Brand created: ${brand.id} (${brand.name})`);
    res.status(201).json({ brand });
  } catch (error) {
    logger.error({ err: error }, 'Create brand error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

brandRoutes.get('/:id', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const brand = await Brand.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    res.json({ brand });
  } catch (error) {
    logger.error({ err: error }, 'Get brand error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

brandRoutes.put('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('name').optional().isString().isLength({ min: 1, max: 200 }),
  body('marketplace').optional().isString(),
  body('marketplaceBrandId').optional().isString(),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const brand = await Brand.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    await brand.update(req.body);
    logger.info(`Brand updated: ${brand.id}`);
    res.json({ brand });
  } catch (error) {
    logger.error({ err: error }, 'Update brand error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

brandRoutes.delete('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const brand = await Brand.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    await brand.destroy();
    logger.info(`Brand deleted: ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Delete brand error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

brandRoutes.post('/sync', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplace } = req.body;

    if (!marketplace || !['trendyol', 'n11'].includes(marketplace)) {
      return res.status(400).json({ error: 'Supported marketplaces: trendyol, n11' });
    }

    const integration = await MarketplaceIntegration.findOne({
      where: { storeId: store.id, marketplace, isActive: true },
    });

    if (!integration) {
      return res.status(404).json({ error: `No active ${marketplace} integration found` });
    }

    const client = createMarketplaceClient(marketplace, integration.config);

    let brands: { id: number | string; name: string }[] = [];

    if ('getBrands' in client) {
      try {
        const apiBrands = await (client as any).getBrands();
        if (Array.isArray(apiBrands)) brands = apiBrands;
      } catch {
        // API failed, will use DB fallback
      }
    }

    const brandNamesFromDb = new Set<string>();

    // Extract brands from existing product marketplaceConfig
    if (brands.length === 0) {
      const products = await Product.findAll({
        where: { storeId: store.id },
        attributes: ['marketplaceConfig'],
        raw: true,
      });
      for (const p of products) {
        const mc = (p as any)?.marketplaceConfig?.[marketplace];
        if (mc?.brand) brandNamesFromDb.add(mc.brand);
      }
      for (const name of brandNamesFromDb) {
        brands.push({ id: name, name });
      }
    }

    if (brands.length === 0) {
      return res.json({ brands: [], imported: 0, message: 'No brands found via API or existing products' });
    }

    let imported = 0;
    for (const b of brands) {
      const name = b.name?.trim();
      if (!name) continue;

      const existing = await Brand.findOne({
        where: { storeId: store.id, marketplace, marketplaceBrandId: String(b.id) },
      });

      if (!existing) {
        await Brand.create({
          storeId: store.id,
          name,
          marketplace,
          marketplaceBrandId: String(b.id),
        });
        imported++;
      }
    }

    logger.info(`Brands synced from ${marketplace}: ${imported} new, ${brands.length} total`);
    res.json({ brands, imported, total: brandNamesFromDb.size || brands.length });
  } catch (error) {
    logger.error({ err: error }, 'Sync brands error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});
