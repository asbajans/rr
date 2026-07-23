import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';
import { AiProvider, AiModel, AiScenario, AiUsageLog } from '../../models/AiModels.js';

export const aiRoutes: Router = Router();

const AI_TIMEOUT_MS = 30000;

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

async function deductCredits(userId: number, storeId: number, amount: number, action: string, module: string) {
  const User = (await import('../../models/User.model.js')).User;
  const CreditLog = (await import('../../models/CreditLog.model.js')).CreditLog;

  const user = await User.findByPk(userId);
  if (!user) return;

  const balanceBefore = user.aiCredits;
  const balanceAfter = Math.max(0, balanceBefore - amount);

  await CreditLog.create({
    userId,
    storeId,
    action,
    module,
    amount: -amount,
    balanceBefore,
    balanceAfter,
  });

  await user.update({ aiCredits: balanceAfter });
}

async function logAiUsage(
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

async function resolveScenarioConfig(scenarioCode: string): Promise<{
  provider: any | null;
  model: any | null;
  scenario: any | null;
  parameters: any;
  costCredits: number;
}> {
  try {
    const scenario = await AiScenario.findOne({
      where: { code: scenarioCode, isActive: true },
      include: [
        { model: AiModel, as: 'model' },
        { model: AiProvider, as: 'provider' },
      ],
    });

    if (!scenario) {
      return { provider: null, model: null, scenario: null, parameters: {}, costCredits: scenarioCode === 'chat' ? 1 : 3 };
    }

    return {
      provider: scenario.provider || null,
      model: scenario.model || null,
      scenario,
      parameters: scenario.parameters || {},
      costCredits: scenario.costCredits,
    };
  } catch (err) {
    logger.warn({ err, scenarioCode }, 'Scenario config lookup failed, using defaults');
    return { provider: null, model: null, scenario: null, parameters: {}, costCredits: scenarioCode === 'chat' ? 1 : 3 };
  }
}

function buildProviderPayload(provider: any, model: any, scenario: any) {
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

  return {
    provider: {
      baseUrl: provider.baseUrl,
      apiKey,
      authType: (provider.authConfig as any)?.authType || 'bearer',
    },
    model: model.modelId,
    parameters: scenario?.parameters || {},
  };
}

async function proxyToAiService(req: Request, res: Response, path: string, scenarioCode: string, defaultCredits: number) {
  const user = (req as any).user;
  const store = (req as any).store;

  const { provider, model, scenario, costCredits } = await resolveScenarioConfig(scenarioCode);
  const credits = costCredits || defaultCredits;

  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;

    const providerPayload = buildProviderPayload(provider, model, scenario);
    const body = { ...req.body, ...providerPayload };

    const response = await axios.post(`${aiServiceUrl}${path}`, body, { timeout: AI_TIMEOUT_MS });

    await deductCredits(user.id, store.id, credits, scenarioCode, 'ai');
    await logAiUsage(
      user.id, store.id, scenarioCode,
      provider?.id || null, model?.id || null, credits,
      { path, bodyKeys: Object.keys(req.body) },
      { status: response.status }
    );

    res.json(response.data);
  } catch (error: any) {
    logger.error({ err: error, scenarioCode, path }, 'AI proxy error');
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

aiRoutes.post('/process-image', authMiddleware, requireStore, [
  body('imageUrl').isURL(),
  body('category').optional().isString(),
], validate, async (req: Request, res: Response) => {
  return proxyToAiService(req, res, '/ai/process-image', 'process-image', 5);
});

aiRoutes.post('/analyze-product', authMiddleware, requireStore, [
  body('imageUrl').isURL(),
  body('category').optional().isString(),
], validate, async (req: Request, res: Response) => {
  return proxyToAiService(req, res, '/ai/analyze-product', 'analyze-product', 10);
});

aiRoutes.post('/generate-description', authMiddleware, requireStore, [
  body('title').isString().isLength({ min: 2 }),
  body('category').isString(),
  body('attributes').optional().isObject(),
  body('keywords').optional().isArray(),
], validate, async (req: Request, res: Response) => {
  return proxyToAiService(req, res, '/ai/generate-description', 'generate-description', 3);
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