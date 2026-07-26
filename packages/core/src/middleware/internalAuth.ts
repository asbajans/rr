import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';

export function requireInternalKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-internal-key'] as string;
  if (!key || key !== config.apiKey.internalKey) {
    res.status(401).json({ error: 'Invalid internal key' });
    return;
  }
  next();
}