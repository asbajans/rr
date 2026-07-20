import { Router, Request, Response } from 'express';
import { Plan } from '../../models/Plan.model.js';
import { serializePlans } from '../planSerializer.js';

export const publicPlanRoutes: Router = Router();

publicPlanRoutes.get('/plans', async (_req: Request, res: Response) => {
  try {
    const plans = await Plan.findAll({ where: { isActive: true }, order: [['price', 'ASC']] });
    res.json({ plans: serializePlans(plans) });
  } catch (error) {
    console.error('Public plans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
