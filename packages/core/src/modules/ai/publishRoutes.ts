import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import { AiProductDraft } from '../../models/AiProductDraft.model.js';
import { AiProductSession } from '../../models/AiProductSession.model.js';
import { Product } from '../../models/Product.model.js';
import { ProductMarketplaceListing } from '../../models/ProductMarketplaceListing.model.js';
import { assertProductQuota } from '../plan/access.js';
import { MarketplaceCategoryMapping } from '../../models/Category.model.js';
import { validateDraftForChannels, type ChannelSelections } from './channelRequirements.js';
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
const CHANNEL_TO_MARKETPLACE: Record<string, string> = {
  storefront: 'Kendi Sitem',
  trendyol: 'trendyol',
  hepsiburada: 'hepsiburada',
  pazarama: 'pazarama',
  n11: 'n11',
  amazon: 'amazon',
  etsy: 'etsy',
};

async function resolveProduct(
  storeId: number,
  draft: AiProductDraft,
  transaction: any,
  selections?: ChannelSelections,
  channels: AiChannel[] = []
): Promise<{ product: Product; created: boolean }> {
  const marketplaces = [...new Set(
    (channels as string[]).map((c) => CHANNEL_TO_MARKETPLACE[c] ?? c).filter(Boolean)
  )];

  const mergeMarketplaces = async (existing: Product) => {
    const merged = [...new Set([...(existing.marketplaces || []), ...marketplaces])];
    if (merged.length !== (existing.marketplaces || []).length) {
      await existing.update({ marketplaces: merged }, { transaction });
    }
    return existing;
  };

  if (draft.productId) {
    const existing = await Product.findOne({ where: { id: draft.productId, storeId }, transaction });
    if (existing) return { product: await mergeMarketplaces(existing), created: false };
  }
  if (draft.sku) {
    const existing = await Product.findOne({ where: { storeId, sku: draft.sku }, transaction });
    if (existing) {
      await draft.update({ productId: existing.id }, { transaction });
      return { product: await mergeMarketplaces(existing), created: false };
    }
  }

  const { Store } = await import('../../models/Store.model.js');
  const store = await Store.findByPk(storeId);
  if (!store) throw new Error('Store not found');
  const quota = await assertProductQuota(store);
  if (!quota.ok) {
    const err: any = new Error('Ürün limitiniz doldu. Planınızı yükseltin.');
    err.code = 'PLAN_PRODUCT_LIMIT';
    err.status = 403;
    throw err;
  }

  const sku = await makeUniqueSku(storeId, draft.sku || undefined);
  const attributes = (draft.attributes || {}) as Record<string, unknown>;
  const genericAttributes = Object.entries(attributes).map(([name, value]) => ({
    name,
    customValue: String(value ?? ''),
  }));
  const marketplaceConfig: Record<string, any> = {};
  const channelsSet = new Set(channels as string[]);

  // Storefront channel maps to the "Kendi Sitem" entry that the frontend
  // product modal/list reads (marketplace_data). Both snake_case (frontend)
  // and camelCase (mappers) aliases are populated.
  if (channelsSet.has('storefront')) {
    marketplaceConfig['Kendi Sitem'] = {
      category_id: draft.categoryId ?? null,
      categoryId: draft.categoryId ?? null,
      brand_id: null,
      brandId: null,
      brand: attributes.brand || attributes.brandName || attributes.marka || null,
      attributes: genericAttributes,
      on_sale: true,
      status: 1,
    };
  }

  for (const channel of ['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy']) {
    if (!channelsSet.has(channel)) continue;
    const mapping = draft.categoryId
      ? await MarketplaceCategoryMapping.findOne({
          where: { categoryId: draft.categoryId, marketplace: channel },
          transaction,
        })
      : null;
    const selection = (selections || {})[channel] || {};
    const channelAttrs = Array.isArray(selection.attributes) && selection.attributes.length > 0
      ? selection.attributes.map((a: any) => ({
          attributeId: a.attributeId,
          ...(a.customValue != null && a.customValue !== '' ? { customValue: String(a.customValue) } : {}),
          ...(a.attributeValueId != null && a.attributeValueId !== '' ? { attributeValueId: a.attributeValueId } : {}),
        }))
      : genericAttributes;
    marketplaceConfig[channel] = {
      category_id: selection.categoryId ?? mapping?.marketplaceCategoryId ?? null,
      categoryId: selection.categoryId ?? mapping?.marketplaceCategoryId ?? null,
      brand_id: selection.brandId ?? null,
      brandId: selection.brandId ?? null,
      brand: selection.brand || attributes.brand || attributes.brandName || attributes.marka || null,
      attributes: channelAttrs,
      on_sale: true,
      status: 1,
    };
  }

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
    marketplaces,
    marketplaceConfig,
    attributes: (draft.attributes || {}) as Record<string, string>,
    tags: [...(draft.tags || []), ...(draft.keywords || [])],
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
  body('selections').optional().isObject(),
], validate, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const draft = await AiProductDraft.findOne({ where: { id: req.params.id, storeId: store.id } });
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  if (draft.status !== 'approved') {
    return res.status(409).json({ error: 'DRAFT_NOT_APPROVED', message: 'Taslak yayınlanmadan önce onaylanmalıdır.' });
  }

  const channels = [...new Set(req.body.channels as AiChannel[])];
  const invalid = channels.filter((c) => !ALL_CHANNELS.includes(c));
  if (invalid.length) return res.status(400).json({ error: `Invalid channel(s): ${invalid.join(', ')}` });

  const selections: ChannelSelections | undefined = req.body.selections;
  const validation = await validateDraftForChannels(draft, channels, selections);
  const blocked = validation.filter((result) => result.status !== 'ready');
  if (blocked.length) {
    return res.status(422).json({ error: 'DRAFT_CHANNEL_VALIDATION_FAILED', results: validation });
  }

  const { sequelize } = await import('../../config/database.js');
  const results: PublishResult[] = [];
  const jobs: Array<{ type: string; listingId: number; productId: number; storeId: number; channel: string }> = [];
  let publishedProductId: number | null = null;

  try {
    await sequelize.transaction(async (transaction: any) => {
      const { product, created } = await resolveProduct(store.id, draft, transaction, selections, channels);
      publishedProductId = product.id;

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
          jobs.push({ type: 'publication:storefront', listingId: listing.id, productId: product.id, storeId: store.id, channel: 'storefront' });
          results.push({ channel: 'storefront', status: 'queued', externalId: String(product.id), retryCount: 0 });
        } else {
          await listing.update({ status: 'publishing', lastError: null, retryCount: 0 }, { transaction });
          jobs.push({ type: `publication:${channel}`, listingId: listing.id, productId: product.id, storeId: store.id, channel });
          results.push({ channel, status: 'queued', retryCount: 0 });
        }
      }

      await draft.update({ status: 'converted', productId: product.id }, { transaction });
      await AiProductSession.update({ status: 'completed' }, { where: { id: draft.sessionId }, transaction });

      logger.info({ draftId: draft.id, productId: product.id, channels, created }, 'Draft published');
    });

    for (const job of jobs) {
      try {
        await queuePublication(job.type, job.listingId, job.productId, job.storeId, job.channel, 'publish');
      } catch (error: any) {
        await ProductMarketplaceListing.update(
          { status: 'failed', lastError: `Queue enqueue failed: ${error?.message || 'Unknown error'}` },
          { where: { id: job.listingId, storeId: store.id } }
        );
        const result = results.find((item) => item.channel === job.channel);
        if (result) {
          result.status = 'failed';
          result.error = error?.message || 'Queue enqueue failed';
        }
      }
    }

    res.json({ ok: true, productId: publishedProductId, results });
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
  if (!['converted', 'approved'].includes(draft.status)) {
    return res.status(409).json({ error: 'DRAFT_STATE_INVALID', message: 'Bu taslak için yayın tekrar denenemez.' });
  }

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
