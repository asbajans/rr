import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config/env.js';

export const apiKeyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  // Simple HMAC verification - in production check against DB
  const timestamp = req.headers['x-timestamp'] as string;
  const signature = req.headers['x-signature'] as string;
  
  if (!timestamp || !signature) {
    return res.status(401).json({ error: 'Missing timestamp or signature' });
  }

  const expectedSig = crypto
    .createHmac('sha256', config.rahAT_INTERNAL_KEY || 'change-me')
    .update(`${timestamp}.${JSON.stringify(req.body)}`)
    .digest('hex');

  if (signature !== expectedSig) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
};