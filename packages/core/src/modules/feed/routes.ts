import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { ExternalFeed, FeedSyncLog } from '../../models/ContentModels.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';
import { Op } from 'sequelize';

export const feedRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

const FEED_FIELDS = [
  'name', 'url', 'format', 'mapping', 'authType', 'authCredentials',
  'pricingMode', 'currency', 'priceMultiplier', 'defaultGramWeight',
  'defaultMilyem', 'defaultProfitMargin', 'defaultCategory', 'defaultCategoryId',
  'defaultIsB2bEnabled', 'defaultQuantity', 'defaultMarketplaces',
  'fieldMapping', 'autoSync', 'updateInterval', 'isActive',
];

function pickFeedBody(body: any): any {
  const data: any = {};
  for (const key of FEED_FIELDS) {
    if (body[key] !== undefined) data[key] = body[key];
    else if (body.snakeToCamel(key) !== undefined) data[key] = body[body.snakeToCamel(key)];
  }
  return data;
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
}

function mapFeed(feed: any): any {
  const f = feed.toJSON ? feed.toJSON() : feed;
  return {
    id: f.id,
    store_id: f.storeId,
    name: f.name,
    feed_url: f.url,
    file_format: f.format,
    auth_type: f.authType || 'none',
    auth_credentials: f.authCredentials || null,
    pricing_mode: f.pricingMode || 'fixed',
    currency: f.currency || 'TRY',
    price_multiplier: parseFloat(f.priceMultiplier || '1'),
    default_gram_weight: f.defaultGramWeight || null,
    default_milyem: f.defaultMilyem || null,
    default_profit_margin: f.defaultProfitMargin || null,
    default_category: f.defaultCategory || null,
    default_category_id: f.defaultCategoryId || null,
    default_is_b2b_enabled: f.defaultIsB2bEnabled || false,
    default_quantity: f.defaultQuantity || 1,
    default_marketplaces: f.defaultMarketplaces || null,
    field_mapping: f.fieldMapping || {},
    auto_sync: f.autoSync || false,
    update_interval: f.updateInterval || 'manual',
    last_sync_at: f.lastSyncAt || null,
    last_sync_result: f.lastSyncResult || null,
    is_active: f.isActive,
    created_at: f.createdAt,
    updated_at: f.updatedAt,
  };
}

function toCamelKeys(obj: any): any {
  const result: any = {};
  for (const key of Object.keys(obj)) {
    result[snakeToCamel(key)] = obj[key];
  }
  return result;
}

feedRoutes.get('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const where: any = { storeId: store.id };
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === 'true';

    const { count, rows } = await ExternalFeed.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    res.json({
      feeds: rows.map(mapFeed),
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List feeds error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

feedRoutes.post('/', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('name').isString().isLength({ min: 2, max: 100 }),
  body('url').optional().isString().isLength({ min: 2, max: 500 }),
  body('feed_url').optional().isString().isLength({ min: 2, max: 500 }),
  body('format').optional().isString().isIn(['xml', 'json', 'csv', 'xlsx']),
  body('file_format').optional().isString().isIn(['xml', 'json', 'csv', 'xlsx']),
  body('authType').optional().isString(),
  body('auth_type').optional().isString(),
  body('pricingMode').optional().isString(),
  body('pricing_mode').optional().isString(),
  body('currency').optional().isString(),
  body('isActive').optional().isBoolean(),
  body('is_active').optional().isBoolean(),
  body('autoSync').optional().isBoolean(),
  body('auto_sync').optional().isBoolean(),
  body('defaultIsB2bEnabled').optional().isBoolean(),
  body('default_is_b2b_enabled').optional().isBoolean(),
  body('priceMultiplier').optional().isFloat(),
  body('price_multiplier').optional().isFloat(),
  body('defaultQuantity').optional().isInt(),
  body('default_quantity').optional().isInt(),
  body('defaultGramWeight').optional().isFloat(),
  body('default_gram_weight').optional().isFloat(),
  body('defaultMilyem').optional().isInt(),
  body('default_milyem').optional().isInt(),
  body('defaultProfitMargin').optional().isFloat(),
  body('default_profit_margin').optional().isFloat(),
  body('defaultCategoryId').optional().isInt(),
  body('default_category_id').optional().isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const data = toCamelKeys(req.body);

    const feed = await ExternalFeed.create({
      storeId: store.id,
      name: data.name,
      url: data.url || data.feedUrl || '',
      format: data.format || data.fileFormat || 'xml',
      mapping: data.mapping || null,
      authType: data.authType || 'none',
      authCredentials: data.authCredentials || null,
      pricingMode: data.pricingMode || 'fixed',
      currency: data.currency || 'TRY',
      priceMultiplier: data.priceMultiplier || 1,
      defaultGramWeight: data.defaultGramWeight || null,
      defaultMilyem: data.defaultMilyem || null,
      defaultProfitMargin: data.defaultProfitMargin || null,
      defaultCategory: data.defaultCategory || null,
      defaultCategoryId: data.defaultCategoryId || null,
      defaultIsB2bEnabled: data.defaultIsB2bEnabled || false,
      defaultQuantity: data.defaultQuantity || 1,
      defaultMarketplaces: data.defaultMarketplaces || null,
      fieldMapping: data.fieldMapping || {},
      autoSync: data.autoSync || false,
      updateInterval: data.updateInterval || 'manual',
      isActive: data.isActive !== undefined ? data.isActive : true,
    });

    logger.info(`Feed created: ${feed.id} (${feed.name}) by store ${store.id}`);
    res.status(201).json({ feed: mapFeed(feed) });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create feed error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

feedRoutes.get('/:id', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const feed = await ExternalFeed.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    res.json({ feed: mapFeed(feed) });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get feed error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

feedRoutes.put('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('name').optional().isString().isLength({ min: 2, max: 100 }),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const feed = await ExternalFeed.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    const data = toCamelKeys(req.body);
    const updateData: any = {};

    for (const key of FEED_FIELDS) {
      if (data[snakeToCamel(key)] !== undefined) updateData[key] = data[snakeToCamel(key)];
      else if (data[key] !== undefined) updateData[key] = data[key];
    }

    if (data.feedUrl !== undefined) updateData.url = data.feedUrl;
    if (data.fileFormat !== undefined) updateData.format = data.fileFormat;
    if (data.authType !== undefined) updateData.authType = data.authType;
    if (data.auth_type !== undefined) updateData.authType = data.auth_type;
    if (data.pricingMode !== undefined) updateData.pricingMode = data.pricingMode;
    if (data.pricing_mode !== undefined) updateData.pricingMode = data.pricing_mode;
    if (data.autoSync !== undefined) updateData.autoSync = data.autoSync;
    if (data.auto_sync !== undefined) updateData.autoSync = data.auto_sync;
    if (data.fieldMapping !== undefined) updateData.fieldMapping = data.fieldMapping;
    if (data.field_mapping !== undefined) updateData.fieldMapping = data.field_mapping;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.is_active !== undefined) updateData.isActive = data.is_active;
    if (data.updateInterval !== undefined) updateData.updateInterval = data.updateInterval;
    if (data.update_interval !== undefined) updateData.updateInterval = data.update_interval;
    if (data.defaultIsB2bEnabled !== undefined) updateData.defaultIsB2bEnabled = data.defaultIsB2bEnabled;
    if (data.default_is_b2b_enabled !== undefined) updateData.defaultIsB2bEnabled = data.default_is_b2b_enabled;
    if (data.priceMultiplier !== undefined) updateData.priceMultiplier = data.priceMultiplier;
    if (data.price_multiplier !== undefined) updateData.priceMultiplier = data.price_multiplier;
    if (data.defaultQuantity !== undefined) updateData.defaultQuantity = data.defaultQuantity;
    if (data.default_quantity !== undefined) updateData.defaultQuantity = data.default_quantity;
    if (data.defaultGramWeight !== undefined) updateData.defaultGramWeight = data.defaultGramWeight;
    if (data.default_gram_weight !== undefined) updateData.defaultGramWeight = data.default_gram_weight;
    if (data.defaultMilyem !== undefined) updateData.defaultMilyem = data.defaultMilyem;
    if (data.default_milyem !== undefined) updateData.defaultMilyem = data.default_milyem;
    if (data.defaultProfitMargin !== undefined) updateData.defaultProfitMargin = data.defaultProfitMargin;
    if (data.default_profit_margin !== undefined) updateData.defaultProfitMargin = data.default_profit_margin;
    if (data.defaultCategoryId !== undefined) updateData.defaultCategoryId = data.defaultCategoryId;
    if (data.default_category_id !== undefined) updateData.defaultCategoryId = data.default_category_id;
    if (data.defaultCategory !== undefined) updateData.defaultCategory = data.defaultCategory;
    if (data.default_category !== undefined) updateData.defaultCategory = data.default_category;
    if (data.defaultMarketplaces !== undefined) updateData.defaultMarketplaces = data.defaultMarketplaces;
    if (data.default_marketplaces !== undefined) updateData.defaultMarketplaces = data.default_marketplaces;
    if (data.authCredentials !== undefined) updateData.authCredentials = data.authCredentials;
    if (data.auth_credentials !== undefined) updateData.authCredentials = data.auth_credentials;
    if (data.currency !== undefined) updateData.currency = data.currency;

    await feed.update(updateData);
    logger.info(`Feed updated: ${feed.id} (${feed.name})`);
    res.json({ feed: mapFeed(feed) });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update feed error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

feedRoutes.delete('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const feed = await ExternalFeed.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    await FeedSyncLog.destroy({ where: { feedId: feed.id } });
    await feed.destroy();
    logger.info(`Feed deleted: ${req.params.id} (store: ${store.id})`);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete feed error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

feedRoutes.get('/:id/logs', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const feed = await ExternalFeed.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    const logs = await FeedSyncLog.findAll({
      where: { feedId: feed.id },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });

    res.json({ logs: logs.map(l => ({
      id: l.id,
      feed_id: l.feedId,
      status: l.status,
      started_at: l.startedAt || null,
      completed_at: l.completedAt || null,
      summary: l.summary || { total: l.productsProcessed, imported: l.productsCreated, failed: l.productsFailed, error: l.errorMessage || undefined },
      created_at: l.createdAt,
    })) });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get feed logs error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

feedRoutes.post('/:id/test', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const feed = await ExternalFeed.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    const axios = (await import('axios')).default;
    const headers: Record<string, string> = {};
    if (feed.authType === 'bearer' && feed.authCredentials) {
      const creds = feed.authCredentials as any;
      headers['Authorization'] = `Bearer ${creds.token || ''}`;
    } else if (feed.authType === 'api-key' && feed.authCredentials) {
      const creds = feed.authCredentials as any;
      headers[creds.header_name || 'X-API-Key'] = creds.key || '';
    }

    const auth: any = {};
    if (feed.authType === 'basic' && feed.authCredentials) {
      const creds = feed.authCredentials as any;
      auth.username = creds.username || '';
      auth.password = creds.password || '';
    }

    const response = await axios.get(feed.url, { timeout: 15000, headers, auth: auth.username ? auth : undefined });
    const data = response.data;
    const preview = typeof data === 'string' ? data.substring(0, 2000) : JSON.stringify(data).substring(0, 2000);

    res.json({
      success: true,
      message: `Feed fetched (${response.status}) — ${(typeof data === 'string' ? data.length : JSON.stringify(data).length)} bytes`,
      headers: response.headers['content-type'] || null,
      preview,
      error: null,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Test feed error');
    res.json({
      success: false,
      message: error.message || 'Failed to fetch or parse feed',
      headers: null,
      preview: null,
      error: error.message || 'Unknown error',
    });
  }
});

feedRoutes.post('/:id/sync', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const feed = await ExternalFeed.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    const syncLog = await FeedSyncLog.create({
      feedId: feed.id,
      status: 'pending',
    });

    const syncQueue = (await import('../../queues/index.js')).syncQueue;
    const job = await syncQueue.add('feed-sync', { feedId: feed.id, syncLogId: syncLog.id, storeId: store.id });

    await feed.update({ lastSyncAt: new Date() });

    res.status(202).json({
      id: syncLog.id,
      feed_id: syncLog.feedId,
      status: syncLog.status,
      summary: null,
      created_at: syncLog.createdAt,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Feed sync error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
