import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../../models/User.model.js';
import { Store } from '../../models/Store.model.js';
import { config } from '../../config/env.js';

export interface JwtPayload {
  userId: number;
  storeId: number;
  role: string;
  type: 'access' | 'refresh';
}

export const generateAccessToken = (user: User, store: Store): string => {
  return jwt.sign(
    { userId: user.id, storeId: store.id, role: user.role, type: 'access' },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry as any }
  );
};

export const generateRefreshToken = (user: User, store: Store): string => {
  return jwt.sign(
    { userId: user.id, storeId: store.id, role: user.role, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiry as any }
  );
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
};

export const generateApiKey = (): { key: string; keyHash: string; keyPrefix: string } => {
  const crypto = require('crypto');
  const randomBytes = crypto.randomBytes(32);
  const key = `rah_${randomBytes.toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const keyPrefix = `rah_${key.substring(4, 12)}`;
  return { key, keyHash, keyPrefix };
};

export const generateHmacSignature = (payload: string, secret: string): string => {
  const crypto = require('crypto');
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
};

export const verifyHmacSignature = (payload: string, signature: string, secret: string): boolean => {
  const expected = generateHmacSignature(payload, secret);
  const crypto = require('crypto');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.substring(7);
    let payload: JwtPayload;

    try {
      payload = verifyAccessToken(token);
    } catch {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired access token' });
      return;
    }

    const user = await User.findByPk(payload.userId, {
      include: [{ model: Store, as: 'store', required: true }],
    });

    if (!user || !user.isActive || !user.store || !user.store.isActive) {
      res.status(401).json({ error: 'Unauthorized', message: 'User or store inactive' });
      return;
    }

    (req as any).user = user;
    (req as any).store = user.store;
    next();
  } catch (error) {
    next(error);
  }
};

export const apiKeyMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const signature = req.headers['x-signature'] as string;
    const timestamp = req.headers['x-timestamp'] as string;

    if (!apiKey) {
      res.status(401).json({ error: 'Unauthorized', message: 'Missing X-API-Key header' });
      return;
    }

    if (!timestamp || Math.abs(Date.now() - parseInt(timestamp)) > 300000) {
      res.status(401).json({ error: 'Unauthorized', message: 'Timestamp expired or invalid' });
      return;
    }

    const crypto = require('crypto');
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const ApiKeyModel = (await import('../../models/ApiKey.model.js')).ApiKey;
    const keyRecord = await ApiKeyModel.findOne({ where: { keyHash }, include: [{ model: Store, as: 'store' }] });

    if (!keyRecord || !keyRecord.store || !keyRecord.store.isActive) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
      res.status(401).json({ error: 'API key expired' });
      return;
    }

    if (keyRecord.allowedIps && keyRecord.allowedIps.length > 0) {
      const clientIp = req.ip || req.socket.remoteAddress;
      if (!keyRecord.allowedIps.some((ip: string) => ip === clientIp || ip.includes('/'))) {
        res.status(403).json({ error: 'IP not allowed' });
        return;
      }
    }

    if (signature) {
      const expectedSignature = crypto.createHmac('sha256', config.apiKey.internalKey)
        .update(`${timestamp}.${JSON.stringify(req.body)}`)
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    await keyRecord.update({ lastUsedAt: new Date() });

    (req as any).store = keyRecord.store;
    (req as any).apiKey = keyRecord;
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const payload = verifyAccessToken(token);
        const user = await User.findByPk(payload.userId, {
          include: [{ model: Store, as: 'store' }],
        });
        if (user && user.isActive && user.store && user.store.isActive) {
          (req as any).user = user;
          (req as any).store = user.store;
        }
      } catch {
        // ignore invalid token
      }
    }
    next();
  } catch {
    next();
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      if (user?.role === 'superadmin') return next();
      res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
      return;
    }
    next();
  };
};

export const requireStore = (req: Request, res: Response, next: NextFunction): void => {
  if (!(req as any).store) {
    res.status(401).json({ error: 'Unauthorized', message: 'Store context required' });
    return;
  }
  next();
};