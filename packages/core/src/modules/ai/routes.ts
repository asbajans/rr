import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const aiRoutes = Router();

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

    await deductCredits(user.id, store.id, 5, 'process_image', 'ai');

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;
    const response = await axios.post(`${aiServiceUrl}/ai/process-image`, {
      imageUrl,
      category: category || 'diger',
    });

    res.json(response.data);
  } catch (error: any) {
    logger.error('AI process image error:', error);
    res.status(500).json({ error: 'AI processing failed', message: error.message });
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

    await deductCredits(user.id, store.id, 10, 'analyze_product', 'ai');

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;
    const response = await axios.post(`${aiServiceUrl}/ai/analyze-product`, {
      imageUrl,
      category: category || 'diger',
    });

    res.json(response.data);
  } catch (error: any) {
    logger.error('AI analyze product error:', error);
    res.status(500).json({ error: 'AI processing failed', message: error.message });
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

    await deductCredits(user.id, store.id, 3, 'generate_description', 'ai');

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;
    const response = await axios.post(`${aiServiceUrl}/ai/generate-description`, req.body);

    res.json(response.data);
  } catch (error: any) {
    logger.error('AI generate description error:', error);
    res.status(500).json({ error: 'AI processing failed', message: error.message });
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

    await deductCredits(user.id, store.id, 1, 'chat', 'ai');

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;
    const response = await axios.post(`${aiServiceUrl}/ai/chat`, {
      message,
      history,
      storeInfo: { ...storeInfo, name: store.name, site_code: store.siteCode },
    });

    res.json(response.data);
  } catch (error: any) {
    logger.error('AI chat error:', error);
    res.status(500).json({ error: 'AI processing failed', message: error.message });
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

    await deductCredits(user.id, store.id, 2, 'search', 'ai');

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;
    const response = await axios.post(`${aiServiceUrl}/ai/search`, { query, products });

    res.json(response.data);
  } catch (error: any) {
    logger.error('AI search error:', error);
    res.status(500).json({ error: 'AI processing failed', message: error.message });
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

    await deductCredits(user.id, store.id, 2, 'recommend', 'ai');

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    const axios = (await import('axios')).default;
    const response = await axios.post(`${aiServiceUrl}/ai/recommend`, { product, allProducts, type });

    res.json(response.data);
  } catch (error: any) {
    logger.error('AI recommend error:', error);
    res.status(500).json({ error: 'AI processing failed', message: error.message });
  }
});