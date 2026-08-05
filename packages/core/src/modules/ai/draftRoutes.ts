import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import { AiProductSession } from '../../models/AiProductSession.model.js';
import { AiProductDraft } from '../../models/AiProductDraft.model.js';
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

function mapToDraft(analysis: AiAnalysisResult, sourceImageUrl: string): Partial<AiProductDraftDTO> {
  const suggestedPrice = analysis.priceSuggestion
    ? Number(analysis.priceSuggestion.max || analysis.priceSuggestion.min) || undefined
    : undefined;
  return {
    title: analysis.title,
    description: analysis.description,
    shortDescription: analysis.shortDescription,
    slug: analysis.slug,
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
async function analyzeAndCreateSession(
  user: any,
  store: any,
  input: any,
  idempotencyKey?: string
): Promise<{ session?: AiProductSession; draft?: AiProductDraft; error?: { status: number; body: any } }> {
  const { provider, model, scenario, costCredits, keys } = await resolveScenarioConfig('agentic_listing');
  let credits = costCredits || 12;

  const plan = await getPlanForStore(store);
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

  try {
    const providerPayload = buildProviderPayload(provider, model, scenario, keys);
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;

    const aiBody = {
      imageUrl: input.sourceImageUrl,
      category: input.category,
      short_description: input.short_description,
      keywords: input.keywords,
      notes: input.notes,
      suggest_price: input.suggest_price,
      target_marketplaces: input.target_marketplaces,
      ...providerPayload,
    };

    const response = await axios.post(`${aiServiceUrl}/ai/agentic-listing`, aiBody, { timeout: AI_TIMEOUT_MS });

    const analysis = parseAiResponse(normalizeAiResponse(response.data));

    const session = await AiProductSession.create({
      storeId: store.id,
      userId: user.id,
      status: 'review',
      sourceImageUrl: input.sourceImageUrl,
      creditsUsed: credits,
      idempotencyKey: idempotencyKey || null,
    });

    const draft = await AiProductDraft.create({
      sessionId: session.id,
      storeId: store.id,
      ...mapToDraft(analysis, input.sourceImageUrl),
    });

    await session.update({ draftId: draft.id });

    await deductCredits(user.id, store.id, credits, 'agentic_listing', 'ai');
    await logAiUsage(
      user.id, store.id, 'agentic_listing',
      provider?.id || null, model?.id || null, credits,
      { path: '/ai/agentic-listing', bodyKeys: Object.keys(input) },
      { status: response.status }
    );

    return { session, draft };
  } catch (error: any) {
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

  const result = await analyzeAndCreateSession(user, store, req.body, idempotencyKey);
  if (result.error) return res.status(result.error.status).json(result.error.body);
  res.status(201).json({ session: result.session, draft: result.draft });
});

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
draftRoutes.get('/product-drafts', authMiddleware, requireStore, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const drafts = await AiProductDraft.findAll({
    where: { storeId: store.id },
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

  await draft.update({ status: 'approved' });
  await AiProductSession.update({ status: 'approved' }, { where: { id: draft.sessionId } });

  res.json({ draft });
});

// POST /api/ai/product-drafts/:id/validate-channels
draftRoutes.post('/product-drafts/:id/validate-channels', authMiddleware, requireStore, [
  param('id').isInt({ min: 1 }),
  body('channels').isArray().notEmpty(),
], validate, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const draft = await AiProductDraft.findOne({ where: { id: req.params.id, storeId: store.id } });
  if (!draft) return res.status(404).json({ error: 'Draft not found' });

  const channels = req.body.channels as string[];
  const invalid = channels.filter((c) => !['storefront', 'trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy'].includes(c));
  if (invalid.length) return res.status(400).json({ error: `Invalid channel(s): ${invalid.join(', ')}` });

  const results = await validateDraftForChannels(draft, channels as any);
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
