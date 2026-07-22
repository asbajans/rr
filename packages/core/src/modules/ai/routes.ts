import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const aiRoutes: Router = Router();

const AI_TIMEOUT_MS = 25000;

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

aiRoutes.get('/credits', authMiddleware, requireStore, async (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({ credits: user.aiCredits });
});

aiRoutes.post('/process-image', authMiddleware, requireStore, [
  body('imageUrl').isURL(),
  body('category').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const store = (req as any).store;
    const { imageUrl, category } = req.body;

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;
    const response = await axios.post(`${aiServiceUrl}/ai/process-image`, {
      imageUrl,
      category: category || 'diger',
    }, { timeout: AI_TIMEOUT_MS });

    await deductCredits(user.id, store.id, 5, 'process_image', 'ai');

    res.json(response.data);
  } catch (error: any) {
    logger.error('AI process image error:', error);
    const status = error?.response?.status || 500;
    const upstream = error?.response?.data?.error || error.message;
    res.status(status).json({ error: upstream });
  }
});

aiRoutes.post('/analyze-product', authMiddleware, requireStore, [
  body('imageUrl').isURL(),
  body('category').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const store = (req as any).store;
    const { imageUrl, category } = req.body;

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;
    const response = await axios.post(`${aiServiceUrl}/ai/analyze-product`, {
      imageUrl,
      category: category || 'diger',
    }, { timeout: AI_TIMEOUT_MS });

    await deductCredits(user.id, store.id, 10, 'analyze_product', 'ai');

    res.json(response.data);
  } catch (error: any) {
    logger.error('AI analyze product error:', error);
    const status = error?.response?.status || 500;
    const upstream = error?.response?.data?.error || error.message;
    res.status(status).json({ error: upstream });
  }
});

aiRoutes.post('/generate-description', authMiddleware, requireStore, [
  body('title').isString().isLength({ min: 2 }),
  body('category').isString(),
  body('attributes').optional().isObject(),
  body('keywords').optional().isArray(),
], validate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const store = (req as any).store;

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;
    const response = await axios.post(`${aiServiceUrl}/ai/generate-description`, req.body, { timeout: AI_TIMEOUT_MS });

    await deductCredits(user.id, store.id, 3, 'generate_description', 'ai');

    res.json(response.data);
  } catch (error: any) {
    logger.error('AI generate description error:', error);
    const status = error?.response?.status || 500;
    const upstream = error?.response?.data?.error || error.message;
    res.status(status).json({ error: upstream });
  }
});

aiRoutes.post('/chat', authMiddleware, requireStore, [
  body('message').isString().isLength({ min: 1 }),
  body('history').optional().isArray(),
  body('storeInfo').optional().isObject(),
], validate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const store = (req as any).store;
    const { message, history, storeInfo } = req.body;

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;
    const response = await axios.post(`${aiServiceUrl}/ai/chat`, {
      message,
      history,
      storeInfo: { ...storeInfo, name: store.name, site_code: store.siteCode },
    }, { timeout: AI_TIMEOUT_MS });

    await deductCredits(user.id, store.id, 1, 'chat', 'ai');

    res.json(response.data);
  } catch (error: any) {
    logger.error('AI chat error:', error);
    const status = error?.response?.status || 500;
    const upstream = error?.response?.data?.error || error.message;
    res.status(status).json({ error: upstream });
  }
});

aiRoutes.post('/search', authMiddleware, requireStore, [
  body('query').isString().isLength({ min: 1 }),
  body('products').isArray(),
], validate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const store = (req as any).store;
    const { query, products } = req.body;

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;
    const response = await axios.post(`${aiServiceUrl}/ai/search`, { query, products }, { timeout: AI_TIMEOUT_MS });

    await deductCredits(user.id, store.id, 2, 'search', 'ai');

    res.json(response.data);
  } catch (error: any) {
    logger.error('AI search error:', error);
    const status = error?.response?.status || 500;
    const upstream = error?.response?.data?.error || error.message;
    res.status(status).json({ error: upstream });
  }
});

aiRoutes.post('/recommend', authMiddleware, requireStore, [
  body('product').optional().isObject(),
  body('allProducts').isArray(),
  body('type').optional().isIn(['similar', 'trending', 'cross-sell']),
], validate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const store = (req as any).store;
    const { product, allProducts, type } = req.body;

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;
    const response = await axios.post(`${aiServiceUrl}/ai/recommend`, { product, allProducts, type }, { timeout: AI_TIMEOUT_MS });

    await deductCredits(user.id, store.id, 2, 'recommend', 'ai');

    res.json(response.data);
  } catch (error: any) {
    logger.error('AI recommend error:', error);
    const status = error?.response?.status || 500;
    const upstream = error?.response?.data?.error || error.message;
    res.status(status).json({ error: upstream });
  }
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