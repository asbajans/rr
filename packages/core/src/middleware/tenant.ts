import { Request, Response, NextFunction } from 'express';
import { Store } from '../models/Store.model.js';
import { config } from '../config/env.js';

export const tenantMiddleware = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.path.startsWith('/health') || req.path.startsWith('/api/auth/register')) {
      return next();
    }

    const apiKey = req.headers['x-api-key'] as string;
    const domain = req.headers['x-store-domain'] as string;

    let store: Store | null = null;

    if (apiKey) {
      store = await Store.findOne({
        where: { apiKey: apiKey, isActive: true },
        include: [{ association: 'plan' }],
      });
    } else if (domain) {
      store = await Store.findOne({
        where: { domain: domain, isActive: true },
        include: [{ association: 'plan' }],
      });
    }

    if (store) {
      (req as any).store = store;
      (req as any).storeId = store.id;
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireStore = (req: Request, res: Response, next: NextFunction): void => {
  if (!(req as any).store) {
    res.status(401).json({ error: 'Unauthorized', message: 'Store context required' });
    return;
  }
  next();
};