import { Router, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { authMiddleware, requireStore, requireRole } from '../auth/middleware.js';
import { MarketplaceIntegration } from '../../models/MarketplaceIntegration.model.js';
import { Brand } from '../../models/Brand.model.js';
import {
  getGlobalCategories,
  getGlobalBrands,
  getGlobalCategoryAttributes,
  syncGlobalCategories,
  syncGlobalBrands,
  syncGlobalCategoryAttributes,
} from '../../marketplace/globalCatalog.js';
import { logger } from '../../utils/logger.js';

export const marketplaceCatalogRoutes: Router = Router();

const MARKETPLACES = ['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy', 'facebook', 'instagram'];

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

async function requireMarketplaceIntegration(req: Request, res: Response, next: Function) {
  const store = (req as any).store;
  const mp = req.params.marketplace as string;
  // superadmin bypass
  const user = (req as any).user;
  if (user?.role === 'superadmin') return next();
  const integration = await MarketplaceIntegration.findOne({ where: { storeId: store.id, marketplace: mp, isActive: true } });
  if (!integration) {
    res.status(403).json({
      error: 'MARKETPLACE_NOT_INTEGRATED',
      marketplace: mp,
      message: `Bu pazaryeri için entegrasyonunuz bulunmuyor. Önce ${mp} entegrasyonunu aktif edin.`,
    });
    return;
  }
  next();
}

// GET /api/admin/marketplace-catalog/:marketplace/categories
marketplaceCatalogRoutes.get('/:marketplace/categories', authMiddleware, requireStore, [
  param('marketplace').isIn(MARKETPLACES),
], validate, requireMarketplaceIntegration as any, async (req: Request, res: Response) => {
  try {
    const mp = req.params.marketplace as any;
    const cats = await getGlobalCategories(mp);
    // Transform to frontend-expected shape: marketplace_category_id, name, parent_id, level, path, children (built by frontend)
    const mapped = cats.map((c: any) => ({
      id: c.marketplaceCategoryId,
      marketplace_category_id: c.marketplaceCategoryId,
      name: c.name,
      parent_id: c.parentId,
      parentId: c.parentId,
      level: c.level,
      path: c.path,
      raw: c.raw,
    }));
    res.json({ categories: mapped, total: mapped.length, source: 'global' });
  } catch (error) {
    logger.error({ err: error }, 'Global categories error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/marketplace-catalog/:marketplace/brands?search=&limit=
marketplaceCatalogRoutes.get('/:marketplace/brands', authMiddleware, requireStore, [
  param('marketplace').isIn(MARKETPLACES),
  query('search').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 5000 }),
], validate, requireMarketplaceIntegration as any, async (req: Request, res: Response) => {
  try {
    const mp = req.params.marketplace as any;
    const store = (req as any).store;
    const search = req.query.search as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    // Fetch all global brands (no limit) for correct total; limit is applied after merge
    const globalBrands = await getGlobalBrands(mp, { search });

    // Also include per-store custom brands (where storeId == current store, marketplace == mp)
    // These are custom brands created manually by seller (marketplaceBrandId may be null or custom)
    const custom = await Brand.findAll({
      where: { storeId: store.id, marketplace: mp } as any,
      order: [['name', 'ASC']],
    });

    // Merge: global first, then custom not already in global (dedup by marketplaceBrandId and name)
    const seen = new Set<string>(globalBrands.map((b: any) => `${b.marketplaceBrandId}:${b.name.toLowerCase()}`));
    const merged: any[] = globalBrands.map((b: any) => ({
      id: b.id,
      name: b.name,
      marketplace: b.marketplace,
      marketplaceBrandId: b.marketplaceBrandId,
      isActive: true,
      source: 'global' as const,
    }));
    for (const c of custom) {
      const key = `${(c as any).marketplaceBrandId ?? ''}:${String((c as any).name).toLowerCase()}`;
      const key2 = `:${String((c as any).name).toLowerCase()}`;
      if (seen.has(key) || seen.has(key2)) continue;
      // Also check global by name alone to avoid duplicate names
      const nameLower = String((c as any).name).toLowerCase();
      if (globalBrands.some((g: any) => String(g.name).toLowerCase() === nameLower)) continue;
      merged.push({
        id: (c as any).id,
        name: (c as any).name,
        marketplace: (c as any).marketplace,
        marketplaceBrandId: (c as any).marketplaceBrandId,
        isActive: (c as any).isActive,
        source: 'custom' as const,
      });
      seen.add(key);
    }

    let filtered = merged;
    if (search) {
      const s = search.toLowerCase();
      filtered = merged.filter((b) => String(b.name).toLowerCase().includes(s));
    }
    const total = filtered.length;
    if (limit) filtered = filtered.slice(0, limit);
    res.json({ brands: filtered, total, global: globalBrands.length, custom: custom.length });
  } catch (error) {
    logger.error({ err: error }, 'Global brands error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/marketplace-catalog/:marketplace/categories/:categoryId/attributes
marketplaceCatalogRoutes.get('/:marketplace/categories/:categoryId/attributes', authMiddleware, requireStore, [
  param('marketplace').isIn(MARKETPLACES),
  param('categoryId').isString(),
], validate, requireMarketplaceIntegration as any, async (req: Request, res: Response) => {
  try {
    const mp = req.params.marketplace as any;
    const catId = req.params.categoryId as string;

    // 1) Try global cache
    let cached = await getGlobalCategoryAttributes(mp, catId);
    const isFresh = cached && cached.updatedAt && (Date.now() - new Date(cached.updatedAt).getTime() < 24 * 60 * 60 * 1000);
    if (cached && isFresh) {
      res.json({ attributes: (cached as any).attributes, source: 'global', cached: true, syncedAt: (cached as any).updatedAt });
      return;
    }

    // 2) Fetch live via any active integration (fallback) and cache
    const result = await syncGlobalCategoryAttributes(mp, catId);
    if (result.synced) {
      cached = await getGlobalCategoryAttributes(mp, catId);
      if (cached) {
        res.json({ attributes: (cached as any).attributes, source: 'live', cached: false, syncedAt: (cached as any).updatedAt });
        return;
      }
    }

    // 3) Return stale cache if exists
    if (cached) {
      res.json({ attributes: (cached as any).attributes, source: 'global', cached: true, stale: true, syncedAt: (cached as any).updatedAt });
      return;
    }

    // 4) No data
    res.json({ attributes: [], source: 'none' });
  } catch (error) {
    logger.error({ err: error }, 'Global category attributes error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/marketplace-catalog/:marketplace/refresh  (superadmin or any active integrator? restrict to superadmin)
marketplaceCatalogRoutes.post('/:marketplace/refresh', authMiddleware, requireStore, requireRole('superadmin' as any), [
  param('marketplace').isIn(MARKETPLACES),
], validate, async (req: Request, res: Response) => {
  try {
    const mp = req.params.marketplace as any;
    const cat = await syncGlobalCategories(mp);
    const br = await syncGlobalBrands(mp);
    res.json({ success: true, categories: cat.synced, brands: br.synced, sourceStoreId: cat.sourceStoreId || br.sourceStoreId });
  } catch (error) {
    logger.error({ err: error }, 'Global catalog refresh error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/marketplace-catalog/refresh-all  (superadmin)
marketplaceCatalogRoutes.post('/refresh-all', authMiddleware, requireStore, requireRole('superadmin' as any), async (_req: Request, res: Response) => {
  try {
    const { syncAllGlobalCatalogs } = await import('../../marketplace/globalCatalog.js');
    const result = await syncAllGlobalCatalogs();
    res.json({ success: true, result });
  } catch (error) {
    logger.error({ err: error }, 'Global catalog refresh-all error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/marketplace-catalog/cleanup-per-store  (superadmin) — deletes per-store marketplace categories/brands after global is ready
marketplaceCatalogRoutes.post('/cleanup-per-store', authMiddleware, requireStore, requireRole('superadmin' as any), async (_req: Request, res: Response) => {
  try {
    const { Op } = await import('sequelize');
    const { Category } = await import('../../models/Category.model.js');
    const { Brand } = await import('../../models/Brand.model.js');
    const { MarketplaceGlobalCategory, MarketplaceGlobalBrand } = await import('../../models/MarketplaceGlobalCatalog.model.js');
    const catGlobalCount = await (MarketplaceGlobalCategory as any).count();
    const brandGlobalCount = await (MarketplaceGlobalBrand as any).count();
    if (catGlobalCount === 0 && brandGlobalCount === 0) {
      res.status(400).json({ error: 'Global catalog is empty — sync first before cleanup' });
      return;
    }
    const deletedCats = await (Category as any).destroy({ where: { source: { [Op.ne]: null as any } } });
    // Delete only marketplace-synced brands (those with marketplaceBrandId), keep custom (marketplaceBrandId null)
    const deletedBrands = await (Brand as any).destroy({ where: { marketplace: { [Op.ne]: null as any }, marketplaceBrandId: { [Op.ne]: null as any } } });
    logger.info({ deletedCats, deletedBrands }, 'Per-store catalog cleanup completed');
    res.json({ success: true, deletedCats, deletedBrands });
  } catch (error) {
    logger.error({ err: error }, 'Per-store cleanup error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
