import { Router, Request, Response } from 'express';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import { getQuotaStatus } from './service.js';
import { logger } from '../../utils/logger.js';

export const quotaRoutes: Router = Router();

quotaRoutes.get('/status', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const user = (req as any).user;
    const status = await getQuotaStatus(Number(user.id), Number(store.id));
    res.json(status);
  } catch (err) {
    logger.error({ err }, 'Quota status error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
