import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../../models/User.model.js';
import { Store } from '../../models/Store.model.js';
import { Plan } from '../../models/Plan.model.js';
import { ApiKey } from '../../models/ApiKey.model.js';
import { Subscription } from '../../models/Subscription.model.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

function generateAccessToken(user: User, store: Store): string {
  return jwt.sign(
    { userId: user.id, storeId: store.id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry as any }
  );
}

function generateRefreshToken(user: User, store: Store): string {
  return jwt.sign(
    { userId: user.id, storeId: store.id, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiry as any }
  );
}

function generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const key = `rah_${randomPart}`;
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const keyPrefix = `rah_${randomPart.slice(0, 8)}`;
  return { key, keyHash, keyPrefix };
}

const authMiddleware = async (req: Request, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: number; storeId: number; role: string };

    const user = await User.findByPk(decoded.userId, {
      include: [{ model: Store, as: 'store', include: [{ model: Plan, as: 'plan' }] }],
    });

    if (!user || !user.isActive || !user.store || !user.store.isActive) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
    }

    (req as any).user = user;
    (req as any).store = user.store;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
};

const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: Function) => {
    const user = (req as any).user;
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
    }
    next();
  };
};

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').isString().isLength({ min: 2, max: 100 }),
  body('storeName').isString().isLength({ min: 2, max: 255 }),
  body('siteCode').isString().isLength({ min: 2, max: 50 }).matches(/^[a-z0-9-]+$/),
], validate, async (req: Request, res: Response) => {
  try {
    const { email, password, name, storeName, siteCode } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Conflict', message: 'Email already registered' });
    }

    const existingStore = await Store.findOne({ where: { siteCode } });
    if (existingStore) {
      return res.status(409).json({ error: 'Conflict', message: 'Site code already taken' });
    }

    const freePlan = await Plan.findOne({ where: { name: 'Free' } });
    if (!freePlan) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const store = await Store.create({
      name: storeName,
      siteCode,
      email,
      planId: freePlan.id,
      isActive: true,
    });

    const user = await User.create({
      storeId: store.id,
      email,
      passwordHash,
      name,
      role: 'owner',
      isActive: true,
      aiCredits: freePlan.aiCredits,
    });

    await Subscription.create({
      storeId: store.id,
      planId: freePlan.id,
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const accessToken = generateAccessToken(user, store);
    const refreshToken = generateRefreshToken(user, store);

    logger.info(`New store registered: ${store.siteCode} (${store.id})`);

    res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        aiCredits: user.aiCredits,
      },
      store: {
        id: store.id,
        name: store.name,
        siteCode: store.siteCode,
        plan: { id: freePlan.id, name: freePlan.name },
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Register error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      where: { email, isActive: true },
      include: [{ model: Store, as: 'store', include: [{ model: Plan, as: 'plan' }] }],
    });

    if (!user || !user.store || !user.store.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user, user.store);
    const refreshToken = generateRefreshToken(user, user.store);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        aiCredits: user.aiCredits,
      },
      store: {
        id: user.store.id,
        name: user.store.name,
        siteCode: user.store.siteCode,
        domain: user.store.domain,
        plan: user.store.plan ? { id: user.store.plan.id, name: user.store.plan.name } : null,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Login error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as { userId: number; storeId: number; type: string };
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const user = await User.findByPk(decoded.userId, {
      include: [{ model: Store, as: 'store', include: [{ model: Plan, as: 'plan' }] }],
    });

    if (!user || !user.isActive || !user.store || !user.store.isActive || user.store.id !== decoded.storeId) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const accessToken = generateAccessToken(user, user.store);
    const newRefreshToken = generateRefreshToken(user, user.store);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const store = (req as any).store;

  const subscription = await Subscription.findOne({
    where: { storeId: store.id, status: 'active' },
    order: [['createdAt', 'DESC']],
  });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      aiCredits: user.aiCredits,
      fcmToken: user.fcmToken,
    },
    store: {
      id: store.id,
      name: store.name,
      siteCode: store.siteCode,
      domain: store.domain,
      email: store.email,
      currency: store.currency,
      isActive: store.isActive,
      theme: store.theme,
      plan: store.plan ? { id: store.plan.id, name: store.plan.name, price: store.plan.price } : null,
      subscription: subscription ? {
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        canceledAt: subscription.canceledAt,
      } : null,
    },
  });
});

router.post('/logout', authMiddleware, (_req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

router.post('/api-keys', authMiddleware, requireRole('owner', 'admin'), [
  body('name').isString().isLength({ min: 2, max: 100 }),
  body('allowedIps').optional().isArray(),
  body('expiresAt').optional().isISO8601(),
], validate, async (req: Request, res: Response) => {
  try {
    const { name, allowedIps, expiresAt } = req.body;
    const store = (req as any).store;

    const { key, keyHash, keyPrefix } = generateApiKey();

    const apiKey = await ApiKey.create({
      storeId: store.id,
      keyHash,
      keyPrefix,
      name,
      allowedIps: allowedIps || [],
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    logger.info(`API key created for store ${store.id}: ${name}`);

    res.status(201).json({
      id: apiKey.id,
      key,
      keyPrefix,
      name: apiKey.name,
      allowedIps: apiKey.allowedIps,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    });
  } catch (error) {
    logger.error({ err: error }, 'Create API key error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api-keys', authMiddleware, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const keys = await ApiKey.findAll({
      where: { storeId: store.id },
      attributes: { exclude: ['keyHash'] },
      order: [['createdAt', 'DESC']],
    });
    res.json(keys);
  } catch (error) {
    logger.error({ err: error }, 'List API keys error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/api-keys/:id', authMiddleware, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { id } = req.params;

    const key = await ApiKey.findOne({ where: { id, storeId: store.id } });
    if (!key) {
      return res.status(404).json({ error: 'Not found', message: 'API key not found' });
    }

    await key.destroy();
    logger.info(`API key revoked: ${key.keyPrefix} (store: ${store.id})`);
    res.json({ message: 'API key revoked' });
  } catch (error) {
    logger.error({ err: error }, 'Revoke API key error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as authRoutes, authMiddleware, requireRole };