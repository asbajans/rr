import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import { AiProductSession } from '../../models/AiProductSession.model.js';
import { AiProductDraft } from '../../models/AiProductDraft.model.js';
import { Category } from '../../models/Category.model.js';
import {
  resolveScenarioConfig,
  buildProviderPayload,
  deductCredits,
  logAiUsage,
  AI_TIMEOUT_MS,
} from './routes.js';
import { getPlanForStore, getModuleCreditCost } from '../plan/access.js';
import { logger } from '../../utils/logger.js';
import type { AiAnalysisResult, AiProductDraftDTO } from '@rahatio/shared';
import { parseAiResponse } from '@rahatio/shared';
import { normalizeAiResponse } from './aiResponse.js';
import { validateDraftForChannels } from './channelRequirements.js';

export const draftRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

function categoryLabel(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const obj = value as Record<string, unknown>;
  return String(obj.tr || obj.en || obj.name || Object.values(obj)[0] || '');
}

function normalizeCategoryLabel(value: string): string {
  return value.toLocaleLowerCase('tr-TR').trim().replace(/[^a-z0-9ğüşıöç]+/gi, ' ');
}

async function resolveCategoryId(storeId: number, analysis: AiAnalysisResult): Promise<number | null> {
  const candidates = [
    ...(analysis.categoryCandidates || []).sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0)).map((c) => c.name),
    analysis.category,
  ].filter((value): value is string => Boolean(value && value.trim()));
  if (candidates.length === 0) return null;

  const categories = await Category.findAll({
    where: { storeId, isActive: true },
    attributes: ['id', 'name', 'slug'],
    limit: 1000,
  });
  const normalizedCandidates = candidates.map(normalizeCategoryLabel);
  const exact = categories.find((category) => {
    const name = normalizeCategoryLabel(categoryLabel(category.name));
    return normalizedCandidates.includes(name) || normalizedCandidates.includes(normalizeCategoryLabel(category.slug));
  });
  if (exact) return exact.id;

  let best: { id: number; score: number } | null = null;
  for (const category of categories) {
    const name = normalizeCategoryLabel(categoryLabel(category.name));
    const score = normalizedCandidates.reduce((max, candidate) => {
      const tokens = candidate.split(' ').filter(Boolean);
      const overlap = tokens.filter((token) => name.includes(token)).length;
      return Math.max(max, tokens.length ? overlap / tokens.length : 0);
    }, 0);
    if (score >= 0.6 && (!best || score > best.score)) best = { id: category.id, score };
  }
  return best?.id || null;
}

function mapToDraft(analysis: AiAnalysisResult, sourceImageUrl: string, categoryId: number | null): Partial<AiProductDraftDTO> {
  const suggestedPrice = analysis.priceSuggestion
    ? Number(analysis.priceSuggestion.max || analysis.priceSuggestion.min) || undefined
    : undefined;
  return {
    title: analysis.title,
    description: analysis.description,
    shortDescription: analysis.shortDescription,
    slug: analysis.slug,
    categoryId: categoryId || undefined,
    categoryPath: analysis.category ? [analysis.category] : [],
    attributes: analysis.attributes,
    tags: analysis.tags ?? [],
    keywords: analysis.keywords,
    suggestedPrice,
    priceCurrency: analysis.priceSuggestion?.currency || 'TRY',
    images: [sourceImageUrl],
    confidence: analysis.confidence,
    rawAiResponse: analysis as unknown as Record<string, unknown>,
    status: 'review',
  };
}

/**
 * Runs the agentic-listing pipeline, validates the AI output against the
 * shared JSON schema, persists an AiProductSession + AiProductDraft and
 * deducts credits atomically.
 */
export async function analyzeAndCreateSession(
  user: any,
  store: any,
  input: any,
  idempotencyKey?: string,
  existingSession?: AiProductSession
): Promise<{ session?: AiProductSession; draft?: AiProductDraft; error?: { status: number; body: any } }> {
  const plan = await getPlanForStore(store);
  const { provider, model, scenario, costCredits, keys } = await resolveScenarioConfig('agentic_listing', { plan });
  let credits = costCredits || 12;

  const override = getModuleCreditCost(plan, 'ai_product_create');
  if (override != null) credits = override;

  if ((user.aiCredits ?? 0) < credits) {
    return {
      error: {
        status: 402,
        body: {
          error: 'INSUFFICIENT_CREDITS',
          credits: user.aiCredits ?? 0,
          required: credits,
          message: 'AI krediniz yetersiz. Kredi satın alın veya üst pakete geçin.',
        },
      },
    };
  }

  if (!provider || !model) {
    return {
      error: {
        status: 422,
        body: {
          error: 'AI_PROVIDER_NOT_CONFIGURED',
          message: 'Bu AI senaryosu için sağlayıcı/model atanmamış. Süper admin: AI Senaryoları sayfasından bu senaryoya bir model atayın.',
        },
      },
    };
  }

  let session: AiProductSession | null = existingSession || null;
  try {
    if (!session) {
      session = await AiProductSession.create({
        storeId: store.id,
        userId: user.id,
        status: 'analyzing',
        sourceImageUrl: input.sourceImageUrl,
        creditsUsed: credits,
        idempotencyKey: idempotencyKey || null,
      });
    } else if (session.status !== 'analyzing' || session.creditsUsed !== credits) {
      await session.update({ status: 'analyzing', errorMessage: null, creditsUsed: credits });
    }

    const providerPayload = buildProviderPayload(provider, model, scenario, keys);
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;

    // Resolve the category's custom attribute schema so the LLM is directed by it.
    let categoryName = input.category;
    let categoryAttributes: any[] = [];
    if (input.category_id) {
      const { Op } = await import('sequelize');
      const Category = (await import('../../models/Category.model.js')).Category;
      const cat = await Category.findOne({
        where: { id: input.category_id, [Op.or]: [{ storeId: null }, { storeId: store.id }] },
      });
      if (cat) {
        categoryName = categoryName || cat.slug || '';
        categoryAttributes = Array.isArray(cat.aiAttributes) ? cat.aiAttributes : [];
      }
    }

    const aiBody = {
      imageUrl: input.sourceImageUrl,
      category: categoryName,
      category_attributes: categoryAttributes,
      short_description: input.short_description,
      keywords: input.keywords,
      notes: input.notes,
      suggest_price: input.suggest_price,
      target_marketplaces: input.target_marketplaces,
      ...providerPayload,
    };

    const response = await axios.post(`${aiServiceUrl}/ai/agentic-listing`, aiBody, { timeout: AI_TIMEOUT_MS });

    const analysis = parseAiResponse(normalizeAiResponse(response.data));

    const categoryId = await resolveCategoryId(store.id, analysis);

    const draft = await AiProductDraft.create({
      sessionId: session.id,
      storeId: store.id,
      ...mapToDraft(analysis, input.sourceImageUrl, categoryId),
    });

    await session.update({ draftId: draft.id, status: 'review' });

    await deductCredits(user.id, store.id, credits, 'agentic_listing', 'ai');
    await logAiUsage(
      user.id, store.id, 'agentic_listing',
      provider?.id || null, model?.id || null, credits,
      { path: '/ai/agentic-listing', bodyKeys: Object.keys(input) },
      { status: response.status }
    );

    return { session, draft };
  } catch (error: any) {
    if (session) {
      await session.update({ status: 'failed', errorMessage: String(error?.response?.data?.error || error?.message || 'AI analysis failed').slice(0, 2000) }).catch(() => undefined);
    }
    logger.error({ err: error, message: error?.message, status: error?.response?.status }, 'AI session creation failed');
    const status = error?.response?.status || 500;
    const upstream = error?.response?.data?.error || error.message;
    return { error: { status, body: { error: upstream } } };
  }
}

// POST /api/ai/product-sessions
draftRoutes.post('/product-sessions', authMiddleware, requireStore, [
  body('sourceImageUrl').isURL(),
  body('category').optional().isString(),
  body('category_id').optional().isInt(),
  body('short_description').optional().isString(),
  body('keywords').optional().isArray(),
  body('notes').optional().isString(),
  body('suggest_price').optional().isBoolean(),
  body('target_marketplaces').optional().isArray(),
], validate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const store = (req as any).store;
  const idempotencyKey = (req.headers['idempotency-key'] as string) || undefined;

  if (idempotencyKey) {
    const existing = await AiProductSession.findOne({
      where: { storeId: store.id, idempotencyKey },
    });
    if (existing) {
      const draft = existing.draftId ? await AiProductDraft.findByPk(existing.draftId) : null;
      return res.json({ session: existing, draft });
    }
  }

  let session: AiProductSession;
  try {
    session = await AiProductSession.create({
      storeId: store.id,
      userId: user.id,
      status: 'uploaded',
      sourceImageUrl: req.body.sourceImageUrl,
      creditsUsed: 0,
      idempotencyKey: idempotencyKey || null,
    });
  } catch (error: any) {
    // A concurrent request may win the unique idempotency index between the
    // initial lookup and session creation. Return that winner instead of
    // creating a duplicate or exposing a 500 to the mobile client.
    if (idempotencyKey && (error?.original?.code === '23505' || error?.parent?.code === '23505')) {
      const existing = await AiProductSession.findOne({ where: { storeId: store.id, idempotencyKey } });
      if (existing) {
        const draft = existing.draftId ? await AiProductDraft.findByPk(existing.draftId) : null;
        return res.json({ session: existing, draft });
      }
    }
    throw error;
  }

  try {
    const { aiProductQueue } = await import('../../queues/index.js');
    await aiProductQueue.add('analyze-product-session', {
      sessionId: session.id,
      userId: user.id,
      storeId: store.id,
      input: req.body,
      idempotencyKey,
    }, { jobId: `ai-session-${session.id}` });
    res.status(202).json({ session, draft: null, queued: true });
  } catch (error: any) {
    await session.update({ status: 'failed', errorMessage: `AI job enqueue failed: ${error?.message || 'Unknown error'}` });
    res.status(503).json({ error: 'AI_QUEUE_UNAVAILABLE', message: 'AI işlemi kuyruğa alınamadı. Lütfen tekrar deneyin.' });
  }
});

/** BullMQ handler: runs the AI pipeline for a persisted session. */
export async function processAiProductSession(job: {
  data: { sessionId: string; userId: number; storeId: number; input: any; idempotencyKey?: string };
  attemptsMade?: number;
  opts?: { attempts?: number };
}) {
  const { User } = await import('../../models/User.model.js');
  const { Store } = await import('../../models/Store.model.js');
  const session = await AiProductSession.findOne({ where: { id: job.data.sessionId, storeId: job.data.storeId } });
  const user = await User.findOne({ where: { id: job.data.userId, storeId: job.data.storeId } });
  const store = await Store.findByPk(job.data.storeId);
  if (!session || !user || !store) throw new Error('AI session context not found');

  const result = await analyzeAndCreateSession(user, store, job.data.input, job.data.idempotencyKey, session);
  if (result.error) {
    await session.update({
      status: 'failed',
      errorMessage: String(result.error.body?.message || result.error.body?.error || 'AI analysis failed').slice(0, 2000),
    });
    return { success: false, error: result.error.body };
  }
  return { success: true, sessionId: session.id, draftId: result.draft?.id };
}

// GET /api/ai/product-sessions/:id
draftRoutes.get('/product-sessions/:id', authMiddleware, requireStore, [
  param('id').isUUID(),
], validate, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const session = await AiProductSession.findOne({ where: { id: req.params.id, storeId: store.id } });
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const draft = session.draftId ? await AiProductDraft.findByPk(session.draftId) : null;
  res.json({ session, draft });
});

// GET /api/ai/product-sessions/:id/status
draftRoutes.get('/product-sessions/:id/status', authMiddleware, requireStore, [
  param('id').isUUID(),
], validate, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const session = await AiProductSession.findOne({ where: { id: req.params.id, storeId: store.id } });
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({
    id: session.id,
    status: session.status,
    errorMessage: session.errorMessage,
    creditsUsed: session.creditsUsed,
    draftId: session.draftId,
  });
});

// GET /api/ai/product-sessions/:id/draft
draftRoutes.get('/product-sessions/:id/draft', authMiddleware, requireStore, [
  param('id').isUUID(),
], validate, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const session = await AiProductSession.findOne({ where: { id: req.params.id, storeId: store.id } });
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const draft = session.draftId ? await AiProductDraft.findByPk(session.draftId) : null;
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  res.json({ draft });
});

// GET /api/ai/product-drafts
// Only unpublished drafts are visible — once a draft is published (status
// 'converted') it leaves the drafts list; the row is kept only so the
// publish-state/retry endpoints can still operate on it.
draftRoutes.get('/product-drafts', authMiddleware, requireStore, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const { Op } = await import('sequelize');
  const drafts = await AiProductDraft.findAll({
    where: { storeId: store.id, status: { [Op.notIn]: ['converted'] } },
    order: [['createdAt', 'DESC']],
  });
  res.json({ drafts });
});

// GET /api/ai/product-drafts/:id
draftRoutes.get('/product-drafts/:id', authMiddleware, requireStore, [
  param('id').isInt({ min: 1 }),
], validate, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const draft = await AiProductDraft.findOne({ where: { id: req.params.id, storeId: store.id } });
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  res.json({ draft });
});

// PUT /api/ai/product-drafts/:id — user edits; each changed field is tracked
draftRoutes.put('/product-drafts/:id', authMiddleware, requireStore, [
  param('id').isInt({ min: 1 }),
  body('title').optional().isString(),
  body('description').optional().isString(),
  body('shortDescription').optional().isString(),
  body('slug').optional().isString(),
  body('sku').optional().isString(),
  body('categoryId').optional().isInt({ min: 1 }),
  body('categoryPath').optional().isArray(),
  body('attributes').optional().isObject(),
  body('tags').optional().isArray(),
  body('keywords').optional().isArray(),
  body('suggestedPrice').optional().isFloat({ min: 0 }),
  body('priceCurrency').optional().isString().isLength({ min: 3, max: 10 }),
  body('quantity').optional().isInt({ min: 0 }),
  body('images').optional().isArray(),
], validate, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const draft = await AiProductDraft.findOne({ where: { id: req.params.id, storeId: store.id } });
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  if (['converted', 'publishing'].includes(draft.status)) {
    return res.status(409).json({ error: 'DRAFT_LOCKED', message: 'Yayın sürecine alınmış taslak düzenlenemez.' });
  }

  const EDITABLE_FIELDS = [
    'title', 'description', 'shortDescription', 'slug', 'sku', 'categoryId',
    'categoryPath', 'attributes', 'tags', 'keywords', 'suggestedPrice',
    'priceCurrency', 'quantity', 'images',
  ] as const;

  const patch: Record<string, any> = {};
  const edited: string[] = [...(draft.userEditedFields || [])];
  for (const field of EDITABLE_FIELDS) {
    if (req.body[field] !== undefined) {
      patch[field] = req.body[field];
      const current = (draft as any)[field];
      const next = req.body[field];
      const changed = JSON.stringify(current) !== JSON.stringify(next);
      if (changed && !edited.includes(field)) edited.push(field);
    }
  }

  await draft.update({ ...patch, userEditedFields: edited });
  res.json({ draft });
});

// POST /api/ai/product-drafts/:id/approve
draftRoutes.post('/product-drafts/:id/approve', authMiddleware, requireStore, [
  param('id').isInt({ min: 1 }),
], validate, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const draft = await AiProductDraft.findOne({ where: { id: req.params.id, storeId: store.id } });
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  if (!['review', 'rejected'].includes(draft.status)) {
    if (draft.status === 'approved') return res.json({ draft });
    return res.status(409).json({ error: 'DRAFT_STATE_INVALID', message: 'Bu taslak mevcut durumundan onaylanamaz.' });
  }

  await draft.update({ status: 'approved' });
  await AiProductSession.update({ status: 'approved' }, { where: { id: draft.sessionId } });

  res.json({ draft });
});

// POST /api/ai/product-drafts/:id/validate-channels
draftRoutes.post('/product-drafts/:id/validate-channels', authMiddleware, requireStore, [
  param('id').isInt({ min: 1 }),
  body('channels').isArray().notEmpty(),
  body('selections').optional().isObject(),
], validate, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const draft = await AiProductDraft.findOne({ where: { id: req.params.id, storeId: store.id } });
  if (!draft) return res.status(404).json({ error: 'Draft not found' });

  const channels = req.body.channels as string[];
  const invalid = channels.filter((c) => !['storefront', 'trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy'].includes(c));
  if (invalid.length) return res.status(400).json({ error: `Invalid channel(s): ${invalid.join(', ')}` });

  const results = await validateDraftForChannels(draft, channels as any, req.body.selections);
  res.json({ results });
});

// DELETE /api/ai/product-drafts/:id
draftRoutes.delete('/product-drafts/:id', authMiddleware, requireStore, [
  param('id').isInt({ min: 1 }),
], validate, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const draft = await AiProductDraft.findOne({ where: { id: req.params.id, storeId: store.id } });
  if (!draft) return res.status(404).json({ error: 'Draft not found' });

  await AiProductSession.update({ draftId: null }, { where: { id: draft.sessionId } });
  await draft.destroy();

  res.json({ ok: true });
});
