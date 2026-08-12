import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import { getPlanForStore, getModuleCreditCost, requireModule } from '../plan/access.js';
import { logger } from '../../utils/logger.js';
import { AiProvider, AiModel, AiScenario, AiUsageLog } from '../../models/AiModels.js';
import { sequelize } from '../../config/database.js';
import { parseAiResponse, AiResponseValidationError } from '@rahatio/shared';
import { normalizeAiResponse } from './aiResponse.js';
import { resolvePlanModel } from './planModelResolution.js';

export const aiRoutes: Router = Router();

export const AI_TIMEOUT_MS = 180000;

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

export async function deductCredits(userId: number, storeId: number, amount: number, action: string, module: string) {
  const User = (await import('../../models/User.model.js')).User;
  const CreditLog = (await import('../../models/CreditLog.model.js')).CreditLog;

  await sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(userId, { transaction });
    if (!user) return;

    const balanceBefore = user.aiCredits;
    const balanceAfter = balanceBefore - amount;

    await CreditLog.create({
      userId,
      storeId,
      action,
      module,
      amount: -amount,
      balanceBefore,
      balanceAfter,
    }, { transaction });

    await user.update({ aiCredits: balanceAfter }, { transaction });
  });
}

/**
 * Validates an AI analysis response against the shared JSON schema.
 * Writes a 422 response and returns false when the payload is invalid,
 * so no draft is ever created from malformed AI output.
 */
export function validateAiAnalysisResponse(data: unknown, res: Response): boolean {
  try {
    parseAiResponse(data);
    return true;
  } catch (err) {
    logger.warn({ err }, 'AI response failed JSON schema validation');
    if (err instanceof AiResponseValidationError) {
      res.status(422).json({ error: 'AI_RESPONSE_INVALID', message: err.message, issues: err.issues });
    } else {
      res.status(422).json({ error: 'AI_RESPONSE_INVALID', message: (err as Error).message });
    }
    return false;
  }
}

export async function logAiUsage(
  userId: number, storeId: number,
  scenarioCode: string,
  providerId: number | null,
  modelId: number | null,
  creditsUsed: number,
  requestMeta: any,
  responseMeta: any
) {
  const scenario = await AiScenario.findOne({ where: { code: scenarioCode } });
  await AiUsageLog.create({
    userId,
    storeId,
    providerId,
    modelId,
    scenarioId: scenario?.id || null,
    creditsUsed,
    balanceBefore: 0,
    balanceAfter: 0,
    requestMeta,
    responseMeta,
  });
}

export async function getGlobalAiSettings(): Promise<{
  defaultProviderId?: number;
  defaultModelId?: number;
  keys: Record<string, string>;
}> {
  try {
    const Setting = (await import('../../models/Setting.model.js')).Setting;
    const row = await Setting.findByPk('ai');
    const val = row?.value || {};
    return {
      defaultProviderId: val.defaultProviderId || undefined,
      defaultModelId: val.defaultModelId || undefined,
      keys: val.keys || {},
    };
  } catch (err) {
    logger.warn({ err }, 'Global AI settings lookup failed');
    return { keys: {} };
  }
}

export async function resolveScenarioConfig(scenarioCode: string, opts?: { plan?: any }): Promise<{
  provider: any | null;
  model: any | null;
  scenario: any | null;
  parameters: any;
  costCredits: number;
  keys: Record<string, string>;
}> {
  const defaultCost = scenarioCode === 'chat' ? 1 : 3;
  try {
    const scenario = await AiScenario.findOne({
      where: { code: scenarioCode, isActive: true },
      include: [
        { model: AiModel, as: 'model' },
        { model: AiProvider, as: 'provider' },
      ],
    });

    const globals = await getGlobalAiSettings();

    // Plan-level override: plan.aiScenarioModels[code] wins over the scenario
    // default. Falls through silently when the override model is missing/disabled.
    const planOverrideId = opts?.plan?.aiScenarioModels?.[scenarioCode] ?? null;
    let overrideModel: any = null;
    if (planOverrideId) {
      const m = await AiModel.findByPk(planOverrideId, {
        include: [{ model: AiProvider, as: 'provider' }],
      });
      if (m && m.isActive !== false) overrideModel = m;
    }

    // Global default model — only loaded when it can actually become the winner.
    let globalModel: any = null;
    if (!overrideModel && !scenario?.model && globals.defaultModelId) {
      const m = await AiModel.findByPk(globals.defaultModelId, {
        include: [{ model: AiProvider, as: 'provider' }],
      });
      if (m && m.isActive !== false) globalModel = m;
    }

    const decision = resolvePlanModel({
      overrideModelId: overrideModel ? overrideModel.id : null,
      overrideProviderId: overrideModel?.provider?.id ?? null,
      scenarioModelId: scenario?.model?.id ?? null,
      scenarioProviderId: scenario?.provider?.id ?? null,
      globalModelId: globalModel ? globalModel.id : null,
      globalProviderId: globalModel?.provider?.id ?? globals.defaultProviderId ?? null,
    });

    let provider: any = null;
    let model: any = null;
    if (decision.modelId != null) {
      if (overrideModel && decision.modelId === overrideModel.id) {
        model = overrideModel;
        provider = overrideModel.provider || null;
      } else if (scenario?.model && decision.modelId === scenario.model.id) {
        model = scenario.model;
        provider = scenario.provider || null;
      } else if (globalModel && decision.modelId === globalModel.id) {
        model = globalModel;
        provider = globalModel.provider || null;
      }
    }
    // Fall back to the global default provider when the resolved model has none.
    if (model && !provider && globals.defaultProviderId) {
      provider = await AiProvider.findByPk(globals.defaultProviderId);
    }

    if (!scenario) {
      return { provider, model, scenario: null, parameters: {}, costCredits: defaultCost, keys: globals.keys };
    }

    return {
      provider,
      model,
      scenario,
      parameters: scenario.parameters || {},
      costCredits: scenario.costCredits ?? defaultCost,
      keys: globals.keys,
    };
  } catch (err) {
    logger.warn({ err, scenarioCode }, 'Scenario config lookup failed, using defaults');
    return { provider: null, model: null, scenario: null, parameters: {}, costCredits: defaultCost, keys: {} };
  }
}

export function buildProviderPayload(provider: any, model: any, scenario: any, globalKeys: Record<string, string> = {}) {
  if (!provider || !model) return {};

  let apiKey = '';
  if (provider.authConfig && typeof provider.authConfig === 'object') {
    const ac = provider.authConfig as any;
    if (ac.apiKey) {
      apiKey = ac.apiKey;
    } else if (ac.apiKeyEnv) {
      apiKey = process.env[ac.apiKeyEnv] || '';
    }
  }
  if (!apiKey && globalKeys[provider.code]) {
    apiKey = globalKeys[provider.code];
  }

  const scenarioParams = (scenario?.parameters as any) || {};
  const modelMax = Number(model.maxTokens) || undefined;
  const scenarioMax = Number(scenarioParams.max_tokens) || undefined;
  const maxTokens = scenarioMax
    ? Math.min(scenarioMax, modelMax ?? scenarioMax)
    : modelMax;

  return {
    provider: {
      baseUrl: provider.baseUrl,
      apiKey,
      authType: (provider.authConfig as any)?.authType || 'bearer',
    },
    model: model.modelId,
    parameters: scenarioParams,
    maxTokens,
  };
}

async function proxyToAiService(req: Request, res: Response, path: string, scenarioCode: string, defaultCredits: number, opts?: { validateStructured?: boolean }) {
  const user = (req as any).user;
  const store = (req as any).store;

  // Per-plan credit cost + model override (modules[key].credit_cost, aiScenarioModels)
  const plan = await getPlanForStore(store);
  const { provider, model, scenario, costCredits, keys } = await resolveScenarioConfig(scenarioCode, { plan });
  let credits = costCredits || defaultCredits;

  const moduleKey = scenarioCode === 'analyze_product' || scenarioCode === 'generate_description' || scenarioCode === 'agentic_listing'
    ? 'ai_product_create'
    : scenarioCode === 'process_image' || scenarioCode === 'generate_image' ? 'ai_image_generate' : null;
  if (plan && moduleKey) {
    const override = getModuleCreditCost(plan, moduleKey);
    if (override != null) credits = override;
  }

  if ((user.aiCredits ?? 0) < credits) {
    return res.status(402).json({
      error: 'INSUFFICIENT_CREDITS',
      credits: user.aiCredits ?? 0,
      required: credits,
      message: 'AI krediniz yetersiz. Kredi satın alın veya üst pakete geçin.',
    });
  }

  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;

    const providerPayload = buildProviderPayload(provider, model, scenario, keys);

    if (!provider || !model) {
      logger.warn({ scenarioCode }, 'AI scenario has no provider/model configured; refusing proxy');
      return res.status(422).json({
        error: 'AI_PROVIDER_NOT_CONFIGURED',
        message: 'Bu AI senaryosu için sağlayıcı/model atanmamış. Süper admin: AI Senaryoları sayfasından bu senaryoya bir model atayın veya AI Ayarları sayfasından varsayılan sağlayıcı/model seçin.',
      });
    }

    const body = { ...req.body, ...providerPayload };

    const response = await axios.post(`${aiServiceUrl}${path}`, body, { timeout: AI_TIMEOUT_MS });

    if (opts?.validateStructured) {
      const ok = validateAiAnalysisResponse(normalizeAiResponse(response.data), res);
      if (!ok) return;
    }

    await deductCredits(user.id, store.id, credits, scenarioCode, 'ai');
    await logAiUsage(
      user.id, store.id, scenarioCode,
      provider?.id || null, model?.id || null, credits,
      { path, bodyKeys: Object.keys(req.body) },
      { status: response.status }
    );

    res.json(response.data);
  } catch (error: any) {
    logger.error(
      { scenarioCode, path, message: error?.message, code: error?.code, status: error?.response?.status },
      'AI proxy error'
    );
    await logAiUsage(
      user.id, store.id, scenarioCode,
      provider?.id || null, model?.id || null, credits,
      { path, bodyKeys: Object.keys(req.body) },
      { error: error.message }
    ).catch(() => {});

    const status = error?.response?.status || 500;
    const upstream = error?.response?.data?.error || error.message;
    res.status(status).json({ error: upstream });
  }
}

aiRoutes.get('/credits', authMiddleware, requireStore, async (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({ credits: user.aiCredits });
});

aiRoutes.post('/process-image', authMiddleware, requireStore, requireModule('ai_image_generate'), [
  body('imageUrl').isURL(),
  body('prompt').optional().isString(),
  body('category').optional().isString(),
], validate, async (req: Request, res: Response) => {
  return proxyToAiService(req, res, '/ai/process-image', 'process_image', 5);
});

// Default per-image credit cost for AI image edit / generation. Plans can
// override via the ai_image_generate module credit_cost.
const IMAGE_GEN_CREDIT_PER_IMAGE = 5;

async function proxyImageGen(req: Request, res: Response, path: string, opts: { count?: number }) {
  const user = (req as any).user;
  const store = (req as any).store;
  const plan = await getPlanForStore(store);

  const moduleOverride = plan ? getModuleCreditCost(plan, 'ai_image_generate') : null;
  const perImage = moduleOverride ?? IMAGE_GEN_CREDIT_PER_IMAGE;
  const credits = Math.max(1, perImage) * (opts.count || 1);

  if ((user.aiCredits ?? 0) < credits) {
    return res.status(402).json({
      error: 'INSUFFICIENT_CREDITS',
      credits: user.aiCredits ?? 0,
      required: credits,
      message: 'AI krediniz yetersiz. Kredi satın alın veya üst pakete geçin.',
    });
  }

  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;

    const response = await axios.post(`${aiServiceUrl}${path}`, req.body, { timeout: AI_TIMEOUT_MS });

    // Billed on acceptance (202): the generation runs async on ComfyUI.
    if (response.status >= 200 && response.status < 300) {
      await deductCredits(user.id, store.id, credits, 'ai_image_generate', 'ai');
      await logAiUsage(
        user.id, store.id, 'ai_image_generate',
        null, null, credits,
        { path, bodyKeys: Object.keys(req.body) },
        { status: response.status }
      );
    }

    res.status(response.status).json(response.data);
  } catch (error: any) {
    logger.error(
      { path, message: error?.message, code: error?.code, status: error?.response?.status },
      'AI image proxy error'
    );
    const status = error?.response?.status || 502;
    const upstream = error?.response?.data?.error || error.message;
    res.status(status).json({ error: upstream });
  }
}

// AI ile görsel düzenleme (mevcut ürün görseline talimatla): 1 düzenleme = 1 görsel hakkı
aiRoutes.post('/image-edit', authMiddleware, requireStore, requireModule('ai_image_generate'), [
  body('imageUrl').isURL(),
  body('prompt').isString().isLength({ min: 3, max: 1000 }),
  body('category').optional().isString(),
], validate, (req: Request, res: Response) => proxyImageGen(req, res, '/ai/image-edit', { count: 1 }));

// AI ile yeni görsel üretme: count başına kredi düşer (1-4)
aiRoutes.post('/image-generate', authMiddleware, requireStore, requireModule('ai_image_generate'), [
  body('prompt').isString().isLength({ min: 3, max: 1000 }),
  body('count').optional().isInt({ min: 1, max: 4 }),
  body('category').optional().isString(),
], validate, (req: Request, res: Response) => proxyImageGen(req, res, '/ai/image-generate', { count: Number(req.body.count) || 1 }));

aiRoutes.post('/analyze-product', authMiddleware, requireStore, [
  body('imageUrl').isURL(),
  body('category').optional().isString(),
], validate, async (req: Request, res: Response) => {
  return proxyToAiService(req, res, '/ai/analyze-product', 'analyze_product', 10, { validateStructured: true });
});

aiRoutes.post('/agentic-listing', authMiddleware, requireStore, [
  body('imageUrl').isURL(),
  body('category').optional().isString(),
  body('suggest_price').optional().isBoolean(),
  body('target_marketplaces').optional().isArray(),
], validate, async (req: Request, res: Response) => {
  return proxyToAiService(req, res, '/ai/agentic-listing', 'agentic_listing', 12, { validateStructured: true });
});

aiRoutes.post('/generate-description', authMiddleware, requireStore, [
  body('title').isString().isLength({ min: 2 }),
  body('category').isString(),
  body('attributes').optional().isObject(),
  body('keywords').optional().isArray(),
], validate, async (req: Request, res: Response) => {
  return proxyToAiService(req, res, '/ai/generate-description', 'generate_description', 3);
});

aiRoutes.post('/chat', authMiddleware, requireStore, [
  body('message').isString().isLength({ min: 1 }),
  body('history').optional().isArray(),
  body('storeInfo').optional().isObject(),
], validate, async (req: Request, res: Response) => {
  return proxyToAiService(req, res, '/ai/chat', 'chat', 1);
});

aiRoutes.post('/search', authMiddleware, requireStore, [
  body('query').isString().isLength({ min: 1 }),
  body('products').isArray(),
], validate, async (req: Request, res: Response) => {
  return proxyToAiService(req, res, '/ai/search', 'search', 2);
});

aiRoutes.post('/recommend', authMiddleware, requireStore, [
  body('product').optional().isObject(),
  body('allProducts').isArray(),
  body('type').optional().isIn(['similar', 'trending', 'cross-sell']),
], validate, async (req: Request, res: Response) => {
  return proxyToAiService(req, res, '/ai/recommend', 'recommend', 2);
});

aiRoutes.get('/status/:id', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;
    const response = await axios.get(`${aiServiceUrl}/ai/status/${req.params.id}`, { timeout: 10000 });
    res.json(response.data);
  } catch (error: any) {
    logger.error({ err: error }, 'AI status proxy error');
    const status = error?.response?.status || 502;
    const upstream = error?.response?.data?.error || error.message;
    res.status(status).json({ error: upstream });
  }
});

aiRoutes.get('/output/:id/:file', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;
    const response = await axios.get(`${aiServiceUrl}/ai/output/${req.params.id}/${req.params.file}`, {
      responseType: 'stream',
      timeout: 30000,
    });
    response.data.pipe(res);
  } catch (error: any) {
    logger.error({ err: error }, 'AI output proxy error');
    const status = error?.response?.status || 502;
    const upstream = error?.response?.data?.error || error.message;
    if (!res.headersSent) {
      res.status(status).json({ error: upstream });
    }
  }
});