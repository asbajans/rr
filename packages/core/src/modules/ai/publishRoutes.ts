import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import { AiProductDraft } from '../../models/AiProductDraft.model.js';
import { AiProductSession } from '../../models/AiProductSession.model.js';
import { Product } from '../../models/Product.model.js';
import { ProductMarketplaceListing } from '../../models/ProductMarketplaceListing.model.js';
import { assertProductQuota } from '../plan/access.js';
import { logger } from '../../utils/logger.js';
import type { AiChannel, PublishResult } from '@rahatio/shared';

export const publishRoutes: Router = Router();

const ALL_CHANNELS: AiChannel[] = ['storefront', 'trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy'];

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

function makeSlug(title: string): string {
  const base = title.toLowerCase()
    .replace(/[^a-z0-9ğüşıöç]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base}-${Date.now().toString(36)}`;
}

async function makeUniqueSku(storeId: number, sku: string | null | undefined): Promise<string> {
  const base = (sku || 'SKU').trim() || 'SKU';
  let candidate = base;
  let i = 1;
  while (await Product.findOne({ where: { storeId, sku: candidate } })) {
    candidate = `${base}-${i}`;
    i += 1;
  }
  return candidate;
}

/**
 * Finds or creates the product backing a draft inside the publish transaction.
 * Idempotent: re-publish reuses draft.productId / the sku match.
 */
async function resolveProduct(
  storeId: number,
  draft: AiProductDraft,
  transaction: any
): Promise<{ product: Product; created: boolean }> {
  if (draft.productId) {
    const existing = await Product.findByPk(draft.productId, { transaction });
    if (existing) return { product: existing, created: false };
  }
  if (draft.sku) {
    const existing = await Product.findOne({ where: { storeId, sku: draft.sku }, transaction });
    if (existing) {
      await draft.update({ productId: existing.id }, { transaction });
      return { product: existing, created: false };
    }
  }

  const quota = await assertProductQuota({ id: storeId } as any);
  if (!quota.ok) {
    const err: any = new Error('Ürün limitiniz doldu. Planınızı yükseltin.');
    err.code = 'PLAN_PRODUCT_LIMIT';
    err.status = 403;
    throw err;
  }

  const sku = await makeUniqueSku(storeId, draft.sku || undefined);
  const product = await Product.create({
    storeId,
    title: draft.title,
    slug: makeSlug(draft.title),
    description: draft.description,
    sku,
    categoryId: draft.categoryId || null,
    quantity: draft.quantity ?? 0,
    priceTRY: draft.suggestedPrice != null ? Number(draft.suggestedPrice) : null,
    images: draft.images || [],
    marketplaces: [],
    marketplaceConfig: {},
    isActive: true,
  }, { transaction });

  await draft.update({ productId: product.id }, { transaction });
  return { product, created: true };
}

async function queuePublication(
  type: string,
  listingId: number,
  productId: number,
  storeId: number,
  channel: string,
  trigger: 'publish' | 'retry'
): Promise<void> {
  try {
    const { publicationQueue } = await import('../../queues/index.js');
    await publicationQueue.add(type, { type, listingId, productId, storeId, channel, trigger });
  } catch (err) {
    logger.error({ err, channel }, 'Failed to enqueue publication job');
    throw err;
  }
}

// POST /api/ai/product-drafts/:id/publish
// Draft → Product transaction + per-channel listing rows + enqueued jobs.
// A failure on one channel never blocks the others (per-channel job isolation).
publishRoutes.post('/product-drafts/:id/publish', authMiddleware, requireStore, [
  param('id').isInt({ min: 1 }),
  body('channels').isArray().notEmpty(),
], validate, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const draft = await AiProductDraft.findOne({ where: { id: req.params.id, storeId: store.id } });
  if (!draft) return res.status(404).json({ error: 'Draft not found' });

  const channels = req.body.channels as AiChannel[];
  const invalid = channels.filter((c) => !ALL_CHANNELS.includes(c));
  if (invalid.length) return res.status(400).json({ error: `Invalid channel(s): ${invalid.join(', ')}` });

  const { sequelize } = await import('../../config/database.js');
  const results: PublishResult[] = [];

  try {
    await sequelize.transaction(async (transaction: any) => {
      const { product, created } = await resolveProduct(store.id, draft, transaction);

      for (const channel of channels) {
        const platform = channel === 'storefront' ? 'storefront' : channel;
        const [listing] = await ProductMarketplaceListing.findOrCreate({
          where: { productId: product.id, storeId: store.id, platform },
          defaults: {
            productId: product.id,
            storeId: store.id,
            platform,
            channel,
            status: 'publishing',
            externalId: channel === 'storefront' ? String(product.id) : null,
            retryCount: 0,
            lastAttemptAt: new Date(),
          },
          transaction,
        });

        if (channel === 'storefront') {
          // Listing already carries the storefront externalId; job marks it active.
          await queuePublication('publication:storefront', listing.id, product.id, store.id, 'storefront', 'publish');
          results.push({ channel: 'storefront', status: 'queued', externalId: String(product.id), retryCount: 0 });
        } else {
          await listing.update({ status: 'publishing', lastError: null, retryCount: 0 }, { transaction });
          await queuePublication(`publication:${channel}`, listing.id, product.id, store.id, channel, 'publish');
          results.push({ channel, status: 'queued', retryCount: 0 });
        }
      }

      await draft.update({ status: 'converted', productId: product.id }, { transaction });
      await AiProductSession.update({ status: 'completed' }, { where: { id: draft.sessionId }, transaction });

      logger.info({ draftId: draft.id, productId: product.id, channels, created }, 'Draft published');
    });

    res.json({ ok: true, productId: draft.productId, results });
  } catch (error: any) {
    logger.error({ err: error, draftId: draft.id }, 'Publish failed');
    if (error?.code === 'PLAN_PRODUCT_LIMIT') {
      return res.status(403).json({ error: 'PLAN_PRODUCT_LIMIT', message: error.message });
    }
    res.status(500).json({ error: error?.message || 'Publish failed' });
  }
});

// POST /api/ai/product-drafts/:id/publish/retry
// Re-enqueues failed listings for the draft's product, per channel.
publishRoutes.post('/product-drafts/:id/publish/retry', authMiddleware, requireStore, [
  param('id').isInt({ min: 1 }),
  body('channels').optional().isArray(),
], validate, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const draft = await AiProductDraft.findOne({ where: { id: req.params.id, storeId: store.id } });
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  if (!draft.productId) return res.status(409).json({ error: 'Draft has no product yet — publish first' });

  const channels = (req.body.channels as AiChannel[] | undefined) ?? ALL_CHANNELS;
  const invalid = channels.filter((c) => !ALL_CHANNELS.includes(c));
  if (invalid.length) return res.status(400).json({ error: `Invalid channel(s): ${invalid.join(', ')}` });

  const where: any = { productId: draft.productId, storeId: store.id, status: 'failed' };
  if (channels.length) where.platform = { [require('sequelize').Op.in]: channels };

  const listings = await ProductMarketplaceListing.findAll({ where });
  const results: PublishResult[] = [];

  for (const listing of listings) {
    const channel = (listing.channel || listing.platform) as AiChannel;
    await listing.update({ status: 'publishing', lastError: null });
    try {
      await queuePublication(`publication:${channel}`, listing.id, draft.productId, store.id, channel, 'retry');
      results.push({ channel, status: 'queued', retryCount: (listing.retryCount || 0) + 1 });
    } catch (err: any) {
      await listing.update({ status: 'failed', lastError: err?.message });
      results.push({ channel, status: 'failed', error: err?.message });
    }
  }

  res.json({ ok: true, retried: results.length, results });
});

// GET /api/ai/product-drafts/:id/publish — current publish state per channel
publishRoutes.get('/product-drafts/:id/publish', authMiddleware, requireStore, [
  param('id').isInt({ min: 1 }),
], validate, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const draft = await AiProductDraft.findOne({ where: { id: req.params.id, storeId: store.id } });
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  if (!draft.productId) return res.json({ productId: null, listings: [] });

  const listings = await ProductMarketplaceListing.findAll({
    where: { productId: draft.productId, storeId: store.id },
    order: [['createdAt', 'ASC']],
  });

  res.json({
    productId: draft.productId,
    draftStatus: draft.status,
    listings: listings.map((l) => ({
      id: l.id,
      platform: l.platform,
      channel: l.channel || l.platform,
      status: l.status,
      externalId: l.externalId,
      lastError: l.lastError,
      retryCount: l.retryCount || 0,
      lastAttemptAt: l.lastAttemptAt,
    })),
  });
});
