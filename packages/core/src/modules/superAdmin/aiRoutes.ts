import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { AiProvider, AiModel, AiScenario, AiProviderRateLimit, AiUsageLog } from '../../models/AiModels.js';
import { authMiddleware, requireRole } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';
import { Op } from 'sequelize';

export const superAdminAiRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

superAdminAiRoutes.use(authMiddleware);

const superAdminOnly = requireRole('superadmin');

function stripApiKey(provider: any): any {
  const data = provider.toJSON ? provider.toJSON() : { ...provider };
  if (data.authConfig) {
    data.authConfig = { ...data.authConfig as any };
    if (data.authConfig.apiKey) {
      data.authConfig.apiKey = '••••••••';
    }
  }
  return data;
}

// ============ AI PROVIDERS ============

superAdminAiRoutes.get('/ai/providers', superAdminOnly, async (req: Request, res: Response) => {
  try {
    const providers = await AiProvider.findAll({
      order: [['code', 'ASC']],
      include: [{ model: AiModel, as: 'models' }],
    });
    res.json({ providers: providers.map(stripApiKey) });
  } catch (error) {
    logger.error({ err: error }, 'List AI providers error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

superAdminAiRoutes.post('/ai/providers', superAdminOnly, [
  body('code').isString().isLength({ min: 2, max: 50 }).matches(/^[a-z0-9_-]+$/),
  body('name').isString().isLength({ min: 2, max: 100 }),
  body('type').isIn(['llm', 'vision', 'embedding', 'image', 'diffusion']),
  body('baseUrl').optional({ values: 'falsy' }).isString(),
  body('authConfig').optional().isObject(),
  body('isActive').optional().isBoolean(),
  body('isDefault').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const { code, name, type, baseUrl, authConfig, isActive, isDefault } = req.body;

    if (isDefault) {
      await AiProvider.update({ isDefault: false }, { where: { type } });
    }

    const provider = await AiProvider.create({
      code,
      name,
      type,
      baseUrl,
      authConfig,
      isActive: isActive !== false,
      isDefault: isDefault === true,
    });

    // Strip API key from response

    logger.info(`AI Provider created: ${code}`);
    res.status(201).json({ provider: stripApiKey(provider) });
  } catch (error: any) {
    logger.error({ err: error }, 'Create AI provider error');
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(409).json({ error: 'Provider code already exists' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

superAdminAiRoutes.put('/ai/providers/:id', superAdminOnly, [
  param('id').isInt(),
  body('name').optional().isString().isLength({ min: 2, max: 100 }),
  body('baseUrl').optional({ values: 'falsy' }).isString(),
  body('authConfig').optional().isObject(),
  body('isActive').optional().isBoolean(),
  body('isDefault').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const provider = await AiProvider.findByPk(req.params.id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    if (req.body.isDefault === true) {
      await AiProvider.update({ isDefault: false }, { where: { type: provider.type } });
    }

    await provider.update(req.body);
    logger.info(`AI Provider updated: ${provider.code}`);
    res.json({ provider: stripApiKey(provider) });
  } catch (error) {
    logger.error({ err: error }, 'Update AI provider error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

superAdminAiRoutes.delete('/ai/providers/:id', superAdminOnly, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const provider = await AiProvider.findByPk(req.params.id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    await provider.destroy();
    logger.info(`AI Provider deleted: ${provider.code}`);
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Delete AI provider error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ AI MODELS ============

superAdminAiRoutes.get('/ai/models', superAdminOnly, async (req: Request, res: Response) => {
  try {
    const models = await AiModel.findAll({
      include: [{ model: AiProvider, as: 'provider' }],
      order: [['providerId', 'ASC'], ['modelCode', 'ASC']],
    });
    res.json({ models });
  } catch (error) {
    logger.error({ err: error }, 'List AI models error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

superAdminAiRoutes.post('/ai/models', superAdminOnly, [
  body('providerId').isInt(),
  body('modelCode').isString().isLength({ min: 2, max: 100 }),
  body('displayName').isString().isLength({ min: 2, max: 100 }),
  body('capability').optional().isIn(['chat', 'vision', 'embedding', 'image', 'diffusion']),
  body('parameters').optional().isObject(),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const model = await AiModel.create(req.body);
    logger.info(`AI Model created: ${model.modelId}`);
    res.status(201).json({ model });
  } catch (error) {
    logger.error({ err: error }, 'Create AI model error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

superAdminAiRoutes.put('/ai/models/:id', superAdminOnly, [
  param('id').isInt(),
  body('displayName').optional().isString().isLength({ min: 2, max: 100 }),
  body('capability').optional().isIn(['chat', 'vision', 'embedding', 'image', 'diffusion']),
  body('parameters').optional().isObject(),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const model = await AiModel.findByPk(req.params.id);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    await model.update(req.body);
    res.json({ model });
  } catch (error) {
    logger.error({ err: error }, 'Update AI model error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

superAdminAiRoutes.delete('/ai/models/:id', superAdminOnly, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const model = await AiModel.findByPk(req.params.id);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    await model.destroy();
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Delete AI model error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ AI SCENARIOS ============

superAdminAiRoutes.get('/ai/scenarios', superAdminOnly, async (req: Request, res: Response) => {
  try {
    const scenarios = await AiScenario.findAll({
      include: [{ model: AiModel, as: 'model', include: [{ model: AiProvider, as: 'provider' }] }],
      order: [['code', 'ASC']],
    });
    res.json({ scenarios });
  } catch (error) {
    logger.error({ err: error }, 'List AI scenarios error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

superAdminAiRoutes.post('/ai/scenarios', superAdminOnly, [
  body('code').isString().isLength({ min: 2, max: 50 }).matches(/^[a-z0-9_]+$/),
  body('name').isString().isLength({ min: 2, max: 100 }),
  body('description').optional().isString(),
  body('modelId').optional().isInt(),
  body('parameters').optional().isObject(),
  body('costCredits').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const scenario = await AiScenario.create(req.body);
    logger.info(`AI Scenario created: ${scenario.code}`);
    res.status(201).json({ scenario });
  } catch (error: any) {
    logger.error({ err: error }, 'Create AI scenario error');
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(409).json({ error: 'Scenario code already exists' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

superAdminAiRoutes.put('/ai/scenarios/:id', superAdminOnly, [
  param('id').isInt(),
  body('name').optional().isString().isLength({ min: 2, max: 100 }),
  body('description').optional().isString(),
  body('modelId').optional().isInt(),
  body('parameters').optional().isObject(),
  body('costCredits').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const scenario = await AiScenario.findByPk(req.params.id);
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
    await scenario.update(req.body);
    res.json({ scenario });
  } catch (error) {
    logger.error({ err: error }, 'Update AI scenario error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

superAdminAiRoutes.delete('/ai/scenarios/:id', superAdminOnly, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const scenario = await AiScenario.findByPk(req.params.id);
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
    await scenario.destroy();
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Delete AI scenario error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ AI RATE LIMITS ============

superAdminAiRoutes.get('/ai/rate-limits', superAdminOnly, async (req: Request, res: Response) => {
  try {
    const limits = await AiProviderRateLimit.findAll({
      include: [{ model: AiProvider, as: 'provider' }],
      order: [['providerId', 'ASC'], ['scope', 'ASC']],
    });
    res.json({ limits });
  } catch (error) {
    logger.error({ err: error }, 'List rate limits error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

superAdminAiRoutes.post('/ai/rate-limits', superAdminOnly, [
  body('providerId').isInt(),
  body('scope').isIn(['per_minute', 'per_hour', 'per_day']),
  body('maxRequests').isInt({ min: 1 }),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const limit = await AiProviderRateLimit.create(req.body);
    res.status(201).json({ limit });
  } catch (error) {
    logger.error({ err: error }, 'Create rate limit error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

superAdminAiRoutes.put('/ai/rate-limits/:id', superAdminOnly, [
  param('id').isInt(),
  body('maxRequests').optional().isInt({ min: 1 }),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const limit = await AiProviderRateLimit.findByPk(req.params.id);
    if (!limit) return res.status(404).json({ error: 'Rate limit not found' });
    await limit.update(req.body);
    res.json({ limit });
  } catch (error) {
    logger.error({ err: error }, 'Update rate limit error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

superAdminAiRoutes.delete('/ai/rate-limits/:id', superAdminOnly, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const limit = await AiProviderRateLimit.findByPk(req.params.id);
    if (!limit) return res.status(404).json({ error: 'Rate limit not found' });
    await limit.destroy();
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Delete rate limit error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ AI USAGE LOGS ============

superAdminAiRoutes.get('/ai/usage-logs', superAdminOnly, [
  query('userId').optional().isInt(),
  query('storeId').optional().isInt(),
  query('providerId').optional().isInt(),
  query('scenarioId').optional().isInt(),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('offset').optional().isInt({ min: 0 }),
], validate, async (req: Request, res: Response) => {
  try {
    const { userId, storeId, providerId, scenarioId, limit = 50, offset = 0 } = req.query;
    const where: any = {};
    if (userId) where.userId = userId;
    if (storeId) where.storeId = storeId;
    if (providerId) where.providerId = providerId;
    if (scenarioId) where.scenarioId = scenarioId;

    const { rows, count } = await AiUsageLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: Number(offset),
      include: [
        { model: AiProvider, as: 'provider' },
        { model: AiModel, as: 'model' },
        { model: AiScenario, as: 'scenario' },
      ],
    });
    res.json({ logs: rows, total: count });
  } catch (error) {
    logger.error({ err: error }, 'List AI usage logs error');
    res.status(500).json({ error: 'Internal server error' });
  }
});