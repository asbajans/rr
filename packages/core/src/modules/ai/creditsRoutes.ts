import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { CreditLog } from '../../models/CreditLog.model.js';
import { User } from '../../models/User.model.js';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';
import { Op } from 'sequelize';

export const creditsRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

creditsRoutes.get('/logs', authMiddleware, requireStore, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('action').optional().isString(),
  query('module').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const where: any = { storeId: store.id };
    if (req.query.action) where.action = req.query.action;
    if (req.query.module) where.module = req.query.module;

    const { count, rows } = await CreditLog.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    });

    res.json({
      logs: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List credit logs error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

creditsRoutes.get('/stats', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const user = (req as any).user;

    const logs = await CreditLog.findAll({
      where: { storeId: store.id },
      attributes: ['amount'],
    });

    let totalConsumed = 0;
    let totalGranted = 0;

    for (const log of logs) {
      if (log.amount < 0) {
        totalConsumed += Math.abs(log.amount);
      } else {
        totalGranted += log.amount;
      }
    }

    res.json({
      currentCredits: user.aiCredits,
      totalConsumed,
      totalGranted,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Credits stats error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
