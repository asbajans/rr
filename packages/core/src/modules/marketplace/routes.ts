import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { body, param, validationResult } from 'express-validator';
import { MarketplaceIntegration } from '../../models/MarketplaceIntegration.model.js';
import { Product } from '../../models/Product.model.js';
import { Setting } from '../../models/Setting.model.js';
import { User } from '../../models/User.model.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { requireInternalKey } from '../../middleware/internalAuth.js';
import { requireModule, assertMarketplaceQuota, assertProductQuota } from '../plan/access.js';
import { logger } from '../../utils/logger.js';

export const marketplaceRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

const MARKETPLACES = ['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy', 'facebook', 'instagram'];

function buildCategoryTree(rows: any[]): any[] {
  const byParent = new Map<string, any[]>();
  for (const r of rows) {
    const pid = String(r.parent_id ?? r.parentId ?? 0);
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(r);
  }
  const build = (parentId: string): any[] => {
    return (byParent.get(parentId) || []).map((r: any) => {
      const id = String(r.id ?? r.marketplace_category_id ?? r.categoryId ?? r.category_id ?? '');
      return {
        marketplace_category_id: id,
        name: r.name,
        parent_id: String(r.parent_id ?? r.parentId ?? ''),
        level: r.level ?? 0,
        path: r.path ?? r.name ?? '',
        children: build(id),
      };
    });
  };
  return build('0');
}

marketplaceRoutes.get('/marketplace-trees', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const integrations = await MarketplaceIntegration.findAll({
      where: { storeId: store.id, isActive: true },
    });

    const trees: Record<string, any[]> = {};
    for (const integration of integrations) {
      const mp = integration.marketplace;
      // Prefer global catalog (daily synced, shared) — fallback to live per-integration if global empty
      try {
        const { getGlobalCategories } = await import('../../marketplace/globalCatalog.js');
        const globalCats = await getGlobalCategories(mp as any);
        if (globalCats.length > 0) {
          const byParent = new Map<string, any[]>();
          for (const g of globalCats as any[]) {
            const pid = String(g.parentId ?? '0');
            if (!byParent.has(pid)) byParent.set(pid, []);
            byParent.get(pid)!.push(g);
          }
          const build = (parentId: string): any[] => {
            return (byParent.get(parentId) || []).map((r: any) => ({
              id: r.marketplaceCategoryId,
              marketplace_category_id: r.marketplaceCategoryId,
              name: r.name,
              parent_id: r.parentId,
              parentId: r.parentId,
              level: r.level,
              path: r.path,
              children: build(String(r.marketplaceCategoryId)),
            }));
          };
          trees[mp] = build('0');
          continue;
        }
      } catch {}
      try {
        const { createMarketplaceClient, getMarketplaceConfig } = await import('../../marketplace/clients/index.js');
        const config = getMarketplaceConfig(mp as any, integration);
        const client = createMarketplaceClient(mp as any, config);
        const categories = await client.getCategories();
        trees[mp] = buildCategoryTree(categories);
      } catch (err: unknown) {
        logger.warn({ err, marketplace: mp }, 'Failed to fetch marketplace tree');
        trees[mp] = [];
      }
    }

    res.json({ trees });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get marketplace trees error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function getEtsyGlobalConfig(): Promise<{ clientId: string; clientSecret: string }> {
  const settings = await Setting.findAll({ where: { key: ['etsy_client_id', 'etsy_client_secret'] } });
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value as string;
  return {
    clientId: map.etsy_client_id || process.env.ETSY_CLIENT_ID || '',
    clientSecret: map.etsy_client_secret || process.env.ETSY_CLIENT_SECRET || '',
  };
}

marketplaceRoutes.get('/etsy/oauth/connect', authMiddleware, requireRole('owner', 'admin'), requireStore, requireModule('marketplace'), async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const existing = await MarketplaceIntegration.findOne({
      where: { storeId: store.id, marketplace: 'etsy' },
    });
    if (!existing?.isActive) {
      const quota = await assertMarketplaceQuota(store);
      if (!quota.ok) {
        return res.status(403).json({ error: 'PLAN_MARKETPLACE_LIMIT', limit: quota.limit, current: quota.current, message: 'Pazaryeri entegrasyon limitiniz doldu. Planınızı yükseltin.' });
      }
    }
    const globalCfg = await getEtsyGlobalConfig();
    if (!globalCfg.clientId) {
      return res.status(400).json({ error: 'Etsy Client ID not configured. Ask super admin to add it in Settings.' });
    }
    const callbackUrl = `${req.protocol}://${req.get('host')}/api/admin/integrations/etsy/oauth/callback`;
    const state = Buffer.from(JSON.stringify({ storeId: store.id, ts: Date.now() })).toString('base64');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: globalCfg.clientId,
      redirect_uri: callbackUrl,
      scope: 'listings_r listings_w transactions_r transactions_w profile_r profile_w shops_r shops_w',
      state,
    });
    res.json({ url: `https://www.etsy.com/oauth/connect?${params.toString()}` });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Etsy OAuth connect error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

marketplaceRoutes.get('/etsy/oauth/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }
    let storeId: number;
    try {
      const decoded = JSON.parse(Buffer.from(state as string, 'base64').toString());
      storeId = decoded.storeId;
    } catch {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }
    const integration = await MarketplaceIntegration.findOne({
      where: { storeId, marketplace: 'etsy' },
    });
    if (!integration?.config) {
      return res.status(400).json({ error: 'Etsy integration not configured' });
    }
    const globalCfg = await getEtsyGlobalConfig();
    const callbackUrl = `${req.protocol}://${req.get('host')}/api/admin/integrations/etsy/oauth/callback`;
    const { EtsyClient } = await import('../../marketplace/clients/etsy.js');
    const etsyClient = new EtsyClient({ ...globalCfg, redirectUri: callbackUrl });
    const tokenData = await etsyClient.exchangeCodeForToken(code as string);
    await integration.update({
      isActive: true,
      config: { ...(integration.config as any || {}), accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token, tokenExpiry: Date.now() + (tokenData.expires_in - 60) * 1000 },
    });
    logger.info(`Etsy OAuth completed for store ${storeId}`);
    res.redirect(`/admin/integrations?etsy=connected`);
  } catch (error: unknown) {
    logger.error({ err: error }, 'Etsy OAuth callback error');
    res.status(500).send('Etsy authorization failed. Please try again.');
  }
});

marketplaceRoutes.get('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const integrations = await MarketplaceIntegration.findAll({
      where: { storeId: store.id },
      order: [['marketplace', 'ASC']],
    });
    const existing = new Set(integrations.map(i => i.marketplace));
    const all = MARKETPLACES.map(mp => {
      const found = integrations.find(i => i.marketplace === mp);
      return found || { marketplace: mp, storeId: store.id, isActive: false, config: {}, etsyCategoryId: null, etsyShippingProfileId: null };
    });
    res.json({ integrations: all });
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

    const config: any = integration.config || {};
    const safeConfig: any = { ...config };
    delete safeConfig.apiSecret;
    delete safeConfig.password;
    delete safeConfig.clientSecret;
    delete safeConfig.accessToken;
    delete safeConfig.refreshToken;
    delete safeConfig.userAccessToken;
    delete safeConfig.pageAccessToken;
    delete safeConfig.appSecret;
    delete safeConfig.token;

    res.json({ integration: { ...integration.toJSON(), config: safeConfig }, marketplace });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get integration error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

marketplaceRoutes.put('/:marketplace', authMiddleware, requireRole('owner', 'admin'), requireStore, requireModule('marketplace'), [
  param('marketplace').isIn(MARKETPLACES),
  body('isActive').optional().isBoolean(),
  body('config').optional().isObject(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplace } = req.params;
    const { isActive, config, etsyCategoryId, etsyShippingProfileId } = req.body;

    const integration = await MarketplaceIntegration.findOne({
      where: { storeId: store.id, marketplace },
    });

    const currentlyActive = integration?.isActive ?? false;
    const willActivate = isActive !== undefined ? isActive : (integration?.isActive ?? true);
    if (willActivate && !currentlyActive) {
      const quota = await assertMarketplaceQuota(store);
      if (!quota.ok) {
        return res.status(403).json({ error: 'PLAN_MARKETPLACE_LIMIT', limit: quota.limit, current: quota.current, message: 'Pazaryeri entegrasyon limitiniz doldu. Planınızı yükseltin.' });
      }
    }

    let finalIntegration: any = integration;
    if (integration) {
      // For secrets, keep existing if new value is empty string (user didn't re-enter)
      const mergedConfig: any = { ...(integration.config as any || {}) };
      if (config && typeof config === 'object') {
        for (const [k, v] of Object.entries(config as Record<string, any>)) {
          if (typeof v === 'string' && v.trim() === '' && typeof (integration.config as any)?.[k] === 'string' && (integration.config as any)[k]) {
            continue; // keep existing secret
          }
          mergedConfig[k] = v;
        }
      }
      await integration.update({
        isActive: isActive !== undefined ? isActive : integration.isActive,
        config: mergedConfig,
        etsyCategoryId: etsyCategoryId || integration.etsyCategoryId,
        etsyShippingProfileId: etsyShippingProfileId || integration.etsyShippingProfileId,
        lastSyncAt: new Date(),
      });
      finalIntegration = integration;
    } else {
      finalIntegration = await MarketplaceIntegration.create({
        storeId: store.id,
        marketplace,
        isActive: isActive !== undefined ? isActive : true,
        config: config || {},
        etsyCategoryId: etsyCategoryId || null,
        etsyShippingProfileId: etsyShippingProfileId || null,
      });
      // For new integration creation, return early after triggering global sync
      if (finalIntegration.isActive) {
        // Non-blocking: ensure global catalog populated via any active integration (fallback chain)
        import('../../marketplace/globalCatalog.js').then(m => {
          m.ensureGlobalCatalogFor(marketplace as any).catch(() => undefined);
          // also trigger full sync in background
          m.syncGlobalCategories(marketplace as any).catch(() => undefined);
          m.syncGlobalBrands(marketplace as any).catch(() => undefined);
        });
      }
      return res.status(201).json({ integration: finalIntegration });
    }

    // If activation happened, ensure global catalog is populated (non-blocking)
    if (willActivate && !currentlyActive && finalIntegration?.isActive) {
      import('../../marketplace/globalCatalog.js').then(m => {
        m.ensureGlobalCatalogFor(marketplace as any).catch(() => undefined);
      });
    }

    logger.info(`Integration updated: ${marketplace} for store ${store.id}`);
    res.json({ integration: finalIntegration });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update integration error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

marketplaceRoutes.delete('/:marketplace', authMiddleware, requireRole('owner'), requireStore, [
  param('marketplace').isIn(MARKETPLACES),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplace } = req.params;
    const integration = await MarketplaceIntegration.findOne({
      where: { storeId: store.id, marketplace },
    });
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    await integration.destroy();
    logger.info(`Integration deleted: ${marketplace} for store ${store.id}`);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete integration error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

marketplaceRoutes.post('/:marketplace/import', authMiddleware, requireRole('owner', 'admin'), requireStore, requireModule('marketplace'), [
  param('marketplace').isIn(MARKETPLACES),
  body('maxPages').optional().isInt({ min: 1, max: 2000 }),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplace } = req.params;
    const { maxPages = 100 } = req.body;

    const quota = await assertProductQuota(store);
    if (!quota.ok) {
      return res.status(403).json({ error: 'PLAN_PRODUCT_LIMIT', limit: quota.limit, current: quota.current, message: 'Ürün limitiniz doldu. Import engellendi. Planınızı yükseltin.' });
    }
    const mpQuota = await assertMarketplaceQuota(store);
    if (!mpQuota.ok) {
      return res.status(403).json({ error: 'PLAN_MARKETPLACE_LIMIT', limit: mpQuota.limit, current: mpQuota.current, message: 'Pazaryeri entegrasyon limitiniz doldu. Planınızı yükseltin.' });
    }

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

marketplaceRoutes.post('/:marketplace/sync-all', authMiddleware, requireRole('owner', 'admin'), requireStore, requireModule('marketplace'), [
  param('marketplace').isIn(MARKETPLACES),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplace } = req.params;

    const integration = await MarketplaceIntegration.findOne({
      where: { storeId: store.id, marketplace, isActive: true },
    });
    if (!integration) {
      return res.status(400).json({ error: 'Marketplace not configured or inactive' });
    }

    const products = await Product.findAll({
      where: {
        storeId: store.id,
        marketplaces: { [Op.contains]: [marketplace] },
      },
    });
    if (products.length === 0) {
      return res.status(404).json({ error: `No products assigned to ${marketplace}`, count: 0 });
    }

    const syncQueue = (await import('../../queues/index.js')).syncQueue;
    let enqueued = 0;
    for (const p of products) {
      await syncQueue.add('product-sync', {
        productId: p.id,
        storeId: store.id,
        marketplaces: [marketplace],
        trigger: 'manual',
      });
      enqueued++;
    }

    logger.info(`Bulk sync queued ${enqueued} products to ${marketplace} for store ${store.id}`);
    res.json({ success: true, enqueued, message: `${enqueued} ürün senkronizasyon kuyruğuna eklendi` });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Bulk sync error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

marketplaceRoutes.delete('/:marketplace/listings/:productId', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('marketplace').isIn(MARKETPLACES),
  param('productId').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplace, productId } = req.params;
    const { ProductMarketplaceListing } = await import('../../models/ProductMarketplaceListing.model.js');
    const listing = await ProductMarketplaceListing.findOne({
      where: { storeId: store.id, productId, platform: marketplace },
    });
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    await listing.destroy();
    logger.info(`Marketplace listing deleted: ${marketplace} product ${productId}`);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete marketplace listing error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

marketplaceRoutes.get('/:marketplace/import/:jobId', authMiddleware, requireStore, [
  param('marketplace').isIn(MARKETPLACES),
  param('jobId').isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const importQueue = (await import('../../queues/index.js')).importQueue;
    const job = await importQueue.getJob(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // BullMQ job ids are not globally safe to expose without ownership
    // checks. A user must only be able to inspect jobs created for their own
    // store and the requested marketplace.
    if (Number(job.data?.storeId) !== Number(store.id) || job.data?.marketplace !== req.params.marketplace) {
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
    const { marketplace } = req.params;

    const integration = await MarketplaceIntegration.findOne({
      where: { storeId: store.id, marketplace, isActive: true },
    });

    if (!integration) {
      return res.status(400).json({ error: `${marketplace} integration not configured or inactive` });
    }

    // Try global cache first (daily sync, non-blocking fallback)
    try {
      const { getGlobalCategories } = await import('../../marketplace/globalCatalog.js');
      const globalCats = await getGlobalCategories(marketplace as any);
      if (globalCats.length > 0) {
        // Return live-like tree: transform global rows to client-expected shape (with children)
        const byParent = new Map<string, any[]>();
        for (const g of globalCats as any[]) {
          const pid = String(g.parentId ?? '0');
          if (!byParent.has(pid)) byParent.set(pid, []);
          byParent.get(pid)!.push(g);
        }
        const build = (parentId: string): any[] => {
          return (byParent.get(parentId) || []).map((r: any) => ({
            id: r.marketplaceCategoryId,
            marketplace_category_id: r.marketplaceCategoryId,
            name: r.name,
            parent_id: r.parentId,
            parentId: r.parentId,
            level: r.level,
            path: r.path,
            children: build(String(r.marketplaceCategoryId)),
          }));
        };
        const tree = build('0');
        // If tree empty fallback to live fetch below
        if (tree.length > 0) {
          // Trigger background refresh if stale (>24h)
          const oldest = globalCats.reduce((min: any, c: any) => Math.min(min, new Date((c as any).updatedAt).getTime()), Date.now());
          if (Date.now() - oldest > 24 * 60 * 60 * 1000) {
            import('../../marketplace/globalCatalog.js').then(m => m.syncGlobalCategories(marketplace as any).catch(() => undefined));
          }
          res.json({ categories: tree, source: 'global' });
          return;
        }
      }
    } catch { /* fall through to live */ }

    const { createMarketplaceClient, getMarketplaceConfig } = await import('../../marketplace/clients/index.js');
    const config = getMarketplaceConfig(marketplace as any, integration);
    const client = createMarketplaceClient(marketplace as any, config);
    const categories = await client.getCategories();

    // Auto-sync into global table (non-blocking, uses fallback chain)
    import('../../marketplace/globalCatalog.js').then(m => m.syncGlobalCategories(marketplace as any).catch(() => undefined));
    // Legacy per-store sync kept for rollback period (will be cleaned up)
    try {
      const { syncMarketplaceCategories } = await import('../../marketplace/categorySync.js');
      await syncMarketplaceCategories(marketplace, store.id, () => Promise.resolve(categories));
    } catch (syncErr) {
      logger.warn({ err: syncErr, marketplace }, 'Category sync failed (non-fatal)');
    }

    res.json({ categories, source: 'live' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get marketplace categories error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

marketplaceRoutes.get('/:marketplace/categories/:categoryId/attributes', authMiddleware, requireStore, [
  param('marketplace').isIn(MARKETPLACES),
  param('categoryId').isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplace, categoryId } = req.params;

    const integration = await MarketplaceIntegration.findOne({
      where: { storeId: store.id, marketplace, isActive: true },
    });

    if (!integration) {
      return res.status(400).json({ error: `${marketplace} integration not configured or inactive` });
    }

    // 1) Global cache (daily)
    try {
      const { getGlobalCategoryAttributes } = await import('../../marketplace/globalCatalog.js');
      const cached = await getGlobalCategoryAttributes(marketplace as any, String(categoryId));
      const isFresh = cached && (Date.now() - new Date((cached as any).updatedAt).getTime() < 24 * 60 * 60 * 1000);
      if (cached && isFresh) {
        res.json({ attributes: (cached as any).attributes, source: 'global', cached: true });
        return;
      }
    } catch { /* ignore */ }

    const { createMarketplaceClient, getMarketplaceConfig } = await import('../../marketplace/clients/index.js');
    const config = getMarketplaceConfig(marketplace as any, integration);
    const client = createMarketplaceClient(marketplace as any, config);

    if (typeof client.getCategoryAttributes !== 'function') {
      // Fallback to global stale if exists
      try {
        const { getGlobalCategoryAttributes: getG } = await import('../../marketplace/globalCatalog.js');
        const stale = await getG(marketplace as any, String(categoryId));
        if (stale) {
          res.json({ attributes: (stale as any).attributes, source: 'global', cached: true, stale: true });
          return;
        }
      } catch {}
      return res.status(400).json({ error: `${marketplace} does not support category attributes` });
    }

    const attributes = await (client as any).getCategoryAttributes(Number(categoryId) || categoryId);
    logger.info({ marketplace, categoryId, count: attributes?.length, sample: attributes?.[0] }, 'Category attributes fetched');
    // Cache to global (non-blocking, uses fallback chain internally)
    import('../../marketplace/globalCatalog.js').then(m => m.syncGlobalCategoryAttributes(marketplace as any, String(categoryId)).catch(() => undefined));
    res.json({ attributes, source: 'live' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get category attributes error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

marketplaceRoutes.get('/:marketplace/shipment-templates', authMiddleware, requireStore, [
  param('marketplace').isIn(MARKETPLACES),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplace } = req.params;

    const integration = await MarketplaceIntegration.findOne({
      where: { storeId: store.id, marketplace, isActive: true },
    });
    if (!integration) {
      return res.status(400).json({ error: `${marketplace} integration not configured or inactive` });
    }

    const { createMarketplaceClient, getMarketplaceConfig } = await import('../../marketplace/clients/index.js');
    const config = getMarketplaceConfig(marketplace as any, integration);
    const client = createMarketplaceClient(marketplace as any, config);

    if (typeof (client as any).getShipmentTemplates !== 'function') {
      return res.status(400).json({ error: `${marketplace} does not support shipment templates` });
    }

    const templates = await (client as any).getShipmentTemplates();
    res.json({ templates });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get shipment templates error');
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

marketplaceRoutes.get('/active', requireInternalKey, async (req: Request, res: Response) => {
  try {
    const { storeId, marketplace } = req.query;
    const where: any = { isActive: true };
    if (storeId) where.storeId = Number(storeId);
    if (marketplace) where.marketplace = marketplace;
    const integrations = await MarketplaceIntegration.findAll({ where });
    const result = integrations.map(i => ({
      storeId: i.storeId,
      marketplace: i.marketplace,
      config: i.config || {},
    }));
    res.json({ integrations: result });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Active integrations error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

marketplaceRoutes.get('/fcm-tokens', requireInternalKey, async (req: Request, res: Response) => {
  try {
    const { storeId } = req.query;
    if (!storeId) {
      res.status(400).json({ error: 'storeId is required' });
      return;
    }
    const users = await User.findAll({
      where: { storeId: Number(storeId), isActive: true },
      attributes: ['fcmToken'],
    });
    const tokens = users.map(u => u.fcmToken).filter(Boolean) as string[];
    res.json({ tokens });
  } catch (error: unknown) {
    logger.error({ err: error }, 'FCM tokens error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
