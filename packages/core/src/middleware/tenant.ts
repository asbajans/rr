import { Request, Response, NextFunction } from 'express';
import { Store } from '../models/Store.model.js';
import { config } from '../config/env.js';

export const tenantMiddleware = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.path.startsWith('/health') || req.path.startsWith('/api/auth/register') || req.path.startsWith('/api/slave')) {
      return next();
    }

    const apiKey = req.headers['x-api-key'] as string;
    const domain = req.headers['x-store-domain'] as string;

    let store: Store | null = null;

    if (apiKey) {
      try {
        const cryptoMod: any = await import('crypto');
        const cryptoObj = cryptoMod.default ?? cryptoMod;
        const { ApiKey } = await import('../models/ApiKey.model.js');
        const keyHash = cryptoObj.createHash('sha256').update(apiKey).digest('hex');
        const apiKeyRow: any = await (ApiKey as any).findOne({ where: { keyHash } });
        if (apiKeyRow) {
          store = await Store.findOne({ where: { id: (apiKeyRow as any).storeId, isActive: true }, include: [{ association: 'plan' }] });
        }
      } catch {}
      // Fallback: if ApiKey not found, do not throw 500 — just continue without store
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