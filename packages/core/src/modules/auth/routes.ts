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
import { serializePlan } from '../planSerializer.js';
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
    if (user.role === 'superadmin') return next();
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
  body('storeName').optional({ values: 'falsy' }).isString().isLength({ min: 2, max: 255 }),
  body('siteCode').optional({ values: 'falsy' }).isString().isLength({ min: 2, max: 50 }).matches(/^[a-z0-9-]+$/),
], validate, async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    const storeName = req.body.storeName || `${name}'s Store`;
    const siteCode = req.body.siteCode || name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Conflict', message: 'Email already registered' });
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

    // Seed default legal pages + footer menus (non-blocking; ignore errors)
    try {
      const { seedLegalPagesForStore } = await import('../page/legalTemplates.js');
      await seedLegalPagesForStore(store.id, { name: store.name, email: store.email, siteCode: store.siteCode });
    } catch (e) {
      logger.warn({ err: e }, 'Failed to seed legal pages for new store');
    }

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

    const token = generateAccessToken(user, store);
    const refreshToken = generateRefreshToken(user, store);

    logger.info(`New store registered: ${store.siteCode} (${store.id})`);

    res.status(201).json({
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        is_admin: user.role === 'superadmin',
        store_id: user.storeId,
        ai_credits: user.aiCredits,
      },
      store: {
        id: store.id,
        name: store.name,
        site_code: store.siteCode,
        domain: store.domain,
        email: store.email,
        plan: serializePlan(freePlan),
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

    const token = generateAccessToken(user, user.store);
    const refreshToken = generateRefreshToken(user, user.store);

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        is_admin: user.role === 'superadmin',
        store_id: user.storeId,
        ai_credits: user.aiCredits,
      },
      store: {
        id: user.store.id,
        name: user.store.name,
        site_code: user.store.siteCode,
        domain: user.store.domain,
        email: user.store.email,
        plan: user.store.plan ? serializePlan(user.store.plan as any) : null,
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
      is_admin: user.role === 'superadmin',
      store_id: user.storeId,
      ai_credits: user.aiCredits,
    },
    store: {
      id: store.id,
      name: store.name,
      site_code: store.siteCode,
      domain: store.domain,
      email: store.email,
      currency: store.currency,
      is_active: store.isActive,
      published: store.published,
      theme: store.theme,
      plan: store.plan ? serializePlan(store.plan) : null,
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

router.post('/fcm-token', [
  body('token').isString().isLength({ min: 10, max: 512 }),
], authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const token = req.body.token;
    if (!user || !user.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await User.update({ fcmToken: token }, { where: { id: user.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'FCM token register error');
    res.status(500).json({ error: 'Internal server error' });
  }
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

/**
 * POST /api/auth/delete-my-account
 * KVKK m.11 / GDPR erasure: kullanıcının kendi hesabını pasife alması.
 * Panel + /deletemyaccount sayfasından çağrılır. 3 adımlı UI onayı sonrası
 * password + "SİL" doğrulamasıyla tetiklenir; kullanıcıyı pasife alır.
 */
router.post('/delete-my-account', authMiddleware, [
  body('password').isString().isLength({ min: 1, max: 200 }),
  body('confirmation').isString().isLength({ min: 1, max: 20 }),
], validate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as User;
    const store = (req as any).store as Store;
    const { password, confirmation } = req.body as { password: string; confirmation: string };

    const normalized = String(confirmation).trim().toLocaleUpperCase('tr-TR');
    const isConfirmed = normalized === 'SİL' || normalized === 'SIL' || normalized === 'SİL';
    if (!isConfirmed) {
      return res.status(400).json({ error: 'Onay metni hatalı. Lütfen SİL yazın.' });
    }

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Şifre hatalı' });
    }

    // Son süper yöneticiyi silmeye izin verme
    if (user.role === 'superadmin') {
      const superCount = await User.count({ where: { role: 'superadmin', isActive: true } });
      if (superCount <= 1) {
        return res.status(403).json({ error: 'Son süper yönetici hesabı silinemez. Önce başka bir süper yönetici ekleyin.' });
      }
    }

    // Owner ise ve mağazada tek aktif owner kaldıysa, mağazayı da pasife al
    let storeDeactivated = false;
    if (user.role === 'owner') {
      const activeOwnerCount = await User.count({ where: { storeId: user.storeId, role: 'owner', isActive: true } });
      if (activeOwnerCount <= 1) {
        await store.update({ isActive: false, published: false } as any);
        storeDeactivated = true;
        logger.warn({ userId: user.id, storeId: store.id }, 'Store deactivated because last owner self-deleted');
      }
    }

    await user.update({ isActive: false } as any);
    logger.info({ userId: user.id, storeId: user.storeId, storeDeactivated }, 'User self-deleted (set inactive) via delete-my-account');

    // API anahtarlarını da iptal et (güvenlik)
    try {
      await ApiKey.destroy({ where: { storeId: user.storeId } } as any);
    } catch { /* ignore */ }

    res.json({
      success: true,
      message: storeDeactivated
        ? 'Hesabınız ve mağazanız pasife alındı. Verileriniz mevzuat gereği saklama süresi boyunca korunur, ardından silinir/anonimleşir.'
        : 'Hesabınız pasife alındı. Girişiniz kapatıldı. Verileriniz mevzuat gereği saklama süresi sonunda silinecektir.',
      storeDeactivated,
    });
  } catch (error) {
    logger.error({ err: error }, 'Delete-my-account error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/google/config
 * Public — returns Google OAuth client ID for frontend (GIS).
 */
router.get('/google/config', async (_req: Request, res: Response) => {
  const clientId = config.google?.clientId || '';
  const clientIds: string[] = (config.google as any)?.clientIds || (clientId ? [clientId] : []);
  res.json({ enabled: !!clientId, clientId: clientId || null, clientIds });
});

/**
 * Helper: verify Google ID token via tokeninfo endpoint (best-effort).
 * Returns decoded payload or throws.
 */
async function verifyGoogleIdToken(idToken: string): Promise<{ sub: string; email: string; name: string; picture?: string; email_verified: boolean; aud: string; iss: string }> {
  const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  const data: any = await resp.json().catch(() => ({}));
  if (!resp.ok || data.error || data.error_description) {
    const msg = data.error_description || data.error || `Google token verification failed (${resp.status})`;
    throw new Error(msg);
  }
  const expMs = Number(data.exp) * 1000;
  if (expMs && expMs < Date.now()) throw new Error('Google token expired');
  if (!data.email) throw new Error('Google token missing email');
  const verified = data.email_verified === true || data.email_verified === 'true';
  if (!verified) throw new Error('Google email not verified');
  const audOk = (() => {
    const allowed: string[] = (config.google as any)?.clientIds || [];
    if (!allowed.length) return true; // dev: skip check if not configured
    return allowed.includes(data.aud);
  })();
  if (!audOk) throw new Error('Invalid Google token audience');
  const iss = String(data.iss || '');
  if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') {
    throw new Error('Invalid Google token issuer');
  }
  return {
    sub: String(data.sub),
    email: String(data.email).toLowerCase(),
    name: String(data.name || data.given_name || data.email.split('@')[0]),
    picture: data.picture ? String(data.picture) : undefined,
    email_verified: true,
    aud: String(data.aud),
    iss,
  };
}

async function verifyGoogleAccessToken(accessToken: string): Promise<{ sub: string; email: string; name: string; picture?: string }> {
  const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data: any = await resp.json().catch(() => ({}));
  if (!resp.ok || data.error) {
    throw new Error(data.error_description || data.error || `Google userinfo failed (${resp.status})`);
  }
  if (!data.email) throw new Error('Google userinfo missing email');
  if (data.email_verified === false || data.email_verified === 'false') throw new Error('Google email not verified');
  return {
    sub: String(data.sub || data.id || data.email),
    email: String(data.email).toLowerCase(),
    name: String(data.name || data.given_name || data.email.split('@')[0]),
    picture: data.picture ? String(data.picture) : undefined,
  };
}

/**
 * POST /api/auth/google
 * Body: { idToken?: string, credential?: string, accessToken?: string }
 * Verifies Google identity, finds or creates user+store, returns JWT pair.
 */
router.post('/google', [
  body('idToken').optional().isString(),
  body('credential').optional().isString(),
  body('accessToken').optional().isString(),
  body('access_token').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const idToken: string | undefined = req.body.idToken || req.body.credential;
    const accessToken: string | undefined = req.body.accessToken || req.body.access_token;
    if (!idToken && !accessToken) {
      return res.status(400).json({ error: 'Google token required (idToken or accessToken)' });
    }

    let google: { sub: string; email: string; name: string; picture?: string };
    if (idToken) {
      google = await verifyGoogleIdToken(idToken);
    } else {
      google = await verifyGoogleAccessToken(accessToken!);
    }

    const email = google.email;
    const googleId = google.sub;
    const displayName = google.name || email.split('@')[0];

    // Try find by googleId first, then by email
    let user: User | null = null;
    try {
      user = await User.findOne({ where: { googleId } as any, include: [{ model: Store, as: 'store', include: [{ model: Plan, as: 'plan' }] }] });
    } catch { /* column may not exist yet */ }
    if (!user) {
      user = await User.findOne({ where: { email, isActive: true }, include: [{ model: Store, as: 'store', include: [{ model: Plan, as: 'plan' }] }] });
    }

    let store: Store;
    if (user && user.store) {
      store = user.store as Store;
      // Link googleId if not set
      if (!(user as any).googleId) {
        try { await user.update({ googleId, authProvider: 'google' } as any); } catch { /* ignore */ }
      }
      if (!store.isActive) {
        return res.status(403).json({ error: 'Store is inactive' });
      }
    } else if (user && !user.store) {
      // Orphan user (should not happen) — load store separately
      const s = await Store.findByPk((user as any).storeId, { include: [{ model: Plan, as: 'plan' }] });
      if (!s) return res.status(500).json({ error: 'Store not found for existing user' });
      store = s as Store;
      if (!(user as any).googleId) {
        try { await user.update({ googleId, authProvider: 'google' } as any); } catch {}
      }
    } else {
      // New user — create store + user + subscription (same as register)
      const freePlan = await Plan.findOne({ where: { name: 'Free' } });
      if (!freePlan) return res.status(500).json({ error: 'Server configuration error' });

      const baseSlug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'store';
      const siteCode = `${baseSlug}-${Date.now().toString(36)}`;
      store = await Store.create({
        name: `${displayName}'s Store`,
        siteCode,
        email,
        planId: freePlan.id,
        isActive: true,
      } as any);

      try {
        const { seedLegalPagesForStore } = await import('../page/legalTemplates.js');
        await seedLegalPagesForStore(store.id, { name: store.name, email: store.email, siteCode: store.siteCode });
      } catch (e) {
        logger.warn({ err: e }, 'Failed to seed legal pages for Google user store');
      }

      const randomPass = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPass, 12);
      user = await User.create({
        storeId: store.id,
        email,
        passwordHash,
        name: displayName,
        role: 'owner',
        isActive: true,
        aiCredits: freePlan.aiCredits,
        googleId,
        authProvider: 'google',
      } as any);

      await Subscription.create({
        storeId: store.id,
        planId: freePlan.id,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      } as any);

      logger.info(`New Google store registered: ${store.siteCode} (${store.id}) via ${email}`);
    }

    // Ensure we have fresh store with plan
    const freshStore = await Store.findByPk((store as any).id, { include: [{ model: Plan, as: 'plan' }] });
    const effectiveStore = freshStore || store;
    const token = generateAccessToken(user as User, effectiveStore as Store);
    const refreshToken = generateRefreshToken(user as User, effectiveStore as Store);

    res.json({
      token,
      refreshToken,
      user: {
        id: (user as any).id,
        name: (user as any).name,
        email: (user as any).email,
        is_admin: (user as any).role === 'superadmin',
        store_id: (user as any).storeId,
        ai_credits: (user as any).aiCredits,
      },
      store: {
        id: (effectiveStore as any).id,
        name: (effectiveStore as any).name,
        site_code: (effectiveStore as any).siteCode,
        domain: (effectiveStore as any).domain,
        email: (effectiveStore as any).email,
        plan: (effectiveStore as any).plan ? serializePlan((effectiveStore as any).plan) : null,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Google auth error');
    const msg = error?.message || 'Google authentication failed';
    const status = /audience|issuer|expired|verified|missing/i.test(msg) ? 401 : 500;
    res.status(status).json({ error: msg });
  }
});

/**
 * POST /api/auth/change-password
 * Authenticated user changes own password.
 * Google users may set a password without currentPassword (they authenticate via Google JWT).
 */
router.post('/change-password', authMiddleware, [
  body('currentPassword').optional().isString(),
  body('current_password').optional().isString(),
  body('newPassword').optional().isString(),
  body('new_password').optional().isString(),
  body('password').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as User;
    // Normalize field names (support snake_case from older clients)
    const currentPassword: string | undefined = req.body.currentPassword ?? req.body.current_password;
    const newPassword: string | undefined = req.body.newPassword ?? req.body.new_password ?? req.body.password;

    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: 'Yeni şifre en az 8 karakter olmalı' });
    }
    if (String(newPassword).length > 128) {
      return res.status(400).json({ error: 'Yeni şifre en fazla 128 karakter olabilir' });
    }

    const isGoogleUser = !!(user as any).googleId;

    if (!isGoogleUser) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Mevcut şifre gerekli' });
      }
      const ok = await bcrypt.compare(String(currentPassword), (user as any).passwordHash);
      if (!ok) {
        return res.status(401).json({ error: 'Mevcut şifre hatalı' });
      }
    } else if (currentPassword) {
      // If Google user supplied currentPassword, verify it when possible (optional hardening)
      const ok = await bcrypt.compare(String(currentPassword), (user as any).passwordHash).catch(() => false);
      if (!ok) {
        // Don't block Google users who don't know the random hash — allow without currentPassword.
        // If they did supply a wrong currentPassword, treat as bad request only if they clearly tried.
        // We allow empty currentPassword to set a new one; if they gave wrong one, tell them.
        return res.status(401).json({ error: 'Mevcut şifre hatalı (Google hesabınız için mevcut şifreyi boş bırakabilirsiniz)' });
      }
    }

    // Prevent reusing same password when current is known
    if (currentPassword) {
      const same = await bcrypt.compare(String(newPassword), (user as any).passwordHash).catch(() => false);
      if (same) {
        return res.status(400).json({ error: 'Yeni şifre mevcut şifreyle aynı olamaz' });
      }
    }

    const hash = await bcrypt.hash(String(newPassword), 12);
    await (user as any).update({ passwordHash: hash, authProvider: 'local' } as any);
    logger.info({ userId: (user as any).id }, 'Password changed via change-password');

    res.json({ success: true, message: 'Şifre başarıyla güncellendi' });
  } catch (error) {
    logger.error({ err: error }, 'Change-password error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as authRoutes, authMiddleware, requireRole };