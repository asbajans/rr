import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { Op } from 'sequelize';
import { Store } from '../../models/Store.model.js';
import { Plan } from '../../models/Plan.model.js';
import { Subscription } from '../../models/Subscription.model.js';
import { User } from '../../models/User.model.js';
import { ApiKey } from '../../models/ApiKey.model.js';
import { CreditLog } from '../../models/CreditLog.model.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { authMiddleware, requireRole, requireStore, generateApiKey } from '../auth/middleware.js';
import Stripe from 'stripe';

const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey, { apiVersion: '2024-04-10' }) : null;

export const storeRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

storeRoutes.get('/plans', async (_req: Request, res: Response) => {
  const plans = await Plan.findAll({ where: { isActive: true }, order: [['price', 'ASC']] });
  const { serializePlans } = await import('../planSerializer.js');
  res.json({ plans: serializePlans(plans) });
});

storeRoutes.post('/plans', authMiddleware, requireRole('owner'), [
  body('name').isString().isLength({ min: 2, max: 100 }),
  body('price').isFloat({ min: 0 }),
  body('productLimit').isInt({ min: 1 }),
  body('aiCredits').isInt({ min: 0 }),
  body('features').optional().isObject(),
  body('stripePriceId').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const plan = await Plan.create(req.body);
    res.status(201).json({ plan });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create plan error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

storeRoutes.get('/me', authMiddleware, requireStore, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const subscription = await Subscription.findOne({
    where: { storeId: store.id },
    order: [['createdAt', 'DESC']],
    include: [{ model: Plan, as: 'plan' }],
  });

  const { serializeSubscription } = await import('../planSerializer.js');

  res.json({
    store: {
      id: store.id, name: store.name, siteCode: store.siteCode, domain: store.domain, siteUrl: store.siteUrl,
      email: store.email, isActive: store.isActive, published: store.published, currency: store.currency,
      theme: store.theme, homepage: store.homepage, taxSettings: store.taxSettings, shippingSettings: store.shippingSettings,
    },
    subscription: subscription ? serializeSubscription(subscription) : null,
  });
});

storeRoutes.get('/me/check-site-code', authMiddleware, requireStore, [
  query('code').isString().isLength({ min: 2, max: 50 }).matches(/^[a-z0-9-]+$/),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const code = (req.query.code as string).toLowerCase();
    const existing = await Store.findOne({ where: { siteCode: code, id: { [Op.ne]: store.id } } });
    res.json({ available: !existing });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Check site code error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

storeRoutes.put('/me', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('name').optional().isString().isLength({ min: 2, max: 255 }),
  body('domain').optional().isString().isLength({ max: 255 }),
  body('email').optional().isEmail(),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }),
  body('theme').optional().isObject(),
  body('homepage').optional().isObject(),
  body('taxSettings').optional().isObject(),
  body('shippingSettings').optional().isObject(),
  body('siteCode').optional().isString().isLength({ min: 2, max: 50 }).matches(/^[a-z0-9-]+$/),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { name, domain, email, currency, theme, homepage, taxSettings, shippingSettings, siteCode } = req.body;

    if (domain && domain !== store.domain) {
      const existing = await Store.findOne({ where: { domain } });
      if (existing) return res.status(409).json({ error: 'Domain already taken' });
    }

    if (siteCode && siteCode.toLowerCase() !== String(store.siteCode).toLowerCase()) {
      const normalized = siteCode.toLowerCase();
      const existing = await Store.findOne({ where: { siteCode: normalized, id: { [Op.ne]: store.id } } });
      if (existing) {
        return res.status(409).json({ error: 'Bu site adresi başka bir mağaza tarafından kullanılıyor. Lütfen başka bir adres seçin.', message: 'Site address already taken' });
      }
      store.siteCode = normalized;
    }

    await store.update({ name, domain, email, currency, theme, homepage, taxSettings, shippingSettings, siteCode: store.siteCode });
    logger.info(`Store updated: ${store.id}`);
    res.json({
      message: 'Settings updated',
      store: {
        id: store.id, name: store.name, siteCode: store.siteCode, domain: store.domain, siteUrl: store.siteUrl,
        email: store.email, isActive: store.isActive, published: store.published, currency: store.currency,
        theme: store.theme, homepage: store.homepage, taxSettings: store.taxSettings, shippingSettings: store.shippingSettings,
      },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update store error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

storeRoutes.get('/users', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const users = await User.findAll({
    where: { storeId: store.id },
    attributes: { exclude: ['passwordHash'] },
    order: [['createdAt', 'DESC']],
  });
  res.json({ users });
});

storeRoutes.post('/users', authMiddleware, requireRole('owner'), requireStore, [
  body('email').isEmail().normalizeEmail(),
  body('name').isString().isLength({ min: 2, max: 100 }),
  body('password').isString().isLength({ min: 8 }),
  body('role').isIn(['admin', 'staff']),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { email, name, password, role } = req.body;

    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.default.hash(password, 12);

    const user = await User.create({ storeId: store.id, email, name, passwordHash, role, isActive: true });
    res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create user error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

storeRoutes.delete('/users/:id', authMiddleware, requireRole('owner'), requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const user = await User.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!user) return res.status(404).json({ error: 'Not found' });
    if (user.role === 'owner') return res.status(403).json({ error: 'Cannot delete owner' });
    await user.destroy();
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete user error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

if (stripe) {
  // Kredi paketleri DB'den gelir (Setting key=credit_packs), yoksa default'a düşer
  const getPacks = async () => {
    const { getCreditPacks } = await import('../credits/packs.js');
    return getCreditPacks();
  };

  const ensureCustomer = async (store: any): Promise<string> => {
    let customerId = store.stripeAccountId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: store.email, metadata: { storeId: store.id } });
      customerId = customer.id;
      await store.update({ stripeAccountId: customerId });
    }
    return customerId;
  };

  storeRoutes.post('/subscription/checkout', authMiddleware, requireRole('owner'), requireStore, [
    body('planId').optional().isInt(), body('plan_id').optional().isInt(),
    body('successUrl').optional().isURL(), body('cancelUrl').optional().isURL(),
  ], validate, async (req: Request, res: Response) => {
    try {
      const store = (req as any).store;
      const planId = parseInt(req.body.planId ?? req.body.plan_id, 10);
      const plan = await Plan.findByPk(planId);
      if (!plan) return res.status(400).json({ error: 'Invalid plan' });

      const successUrl = req.body.successUrl || config.apiUrl;
      const cancelUrl = req.body.cancelUrl || config.apiUrl;

      // Ücretsiz plan (price <=0) doğrudan aktif edilir — Stripe'a gitmez
      if (Number(plan.price) <= 0) {
        await Subscription.upsert({
          storeId: store.id, planId: plan.id,
          status: 'active', currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        await store.update({ planId: plan.id });
        return res.json({ url: null });
      }

      if (!stripe) return res.status(500).json({ error: 'Stripe is not configured (STRIPE_SECRET_KEY missing)' });
      const customerId = await ensureCustomer(store);

      // stripePriceId varsa onu kullan, yoksa plan.price üzerinden dinamik price_data oluştur (Laravel ile aynı)
      const lineItem: any = plan.stripePriceId
        ? { price: plan.stripePriceId, quantity: 1 }
        : {
            price_data: {
              currency: (plan.currency || 'TRY').toLowerCase(),
              product_data: { name: plan.name, description: plan.description || undefined },
              unit_amount: Math.round(Number(plan.price) * 100),
              recurring: { interval: 'month' as const },
            },
            quantity: 1,
          };

      const session = await stripe.checkout.sessions.create({
        customer: customerId, payment_method_types: ['card'],
        line_items: [lineItem],
        mode: 'subscription', success_url: successUrl, cancel_url: cancelUrl,
        metadata: { storeId: String(store.id), planId: String(plan.id) },
        subscription_data: { metadata: { storeId: String(store.id), planId: String(plan.id) } },
      });
      res.json({ url: session.url });
    } catch (error: unknown) {
      logger.error({ err: error }, 'Stripe checkout error');
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  storeRoutes.post('/subscription/portal', authMiddleware, requireRole('owner'), requireStore, [
    body('returnUrl').optional().isURL(),
  ], validate, async (req: Request, res: Response) => {
    try {
      const store = (req as any).store;
      if (!store.stripeAccountId) return res.status(400).json({ error: 'No Stripe customer' });
      const session = await stripe.billingPortal.sessions.create({
        customer: store.stripeAccountId, return_url: req.body.returnUrl || config.apiUrl,
      });
      res.json({ url: session.url });
} catch (error: unknown) {
    logger.error({ err: error }, 'Stripe portal error');
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

  storeRoutes.post('/subscription/cancel', authMiddleware, requireRole('owner'), requireStore, async (req: Request, res: Response) => {
    try {
      const store = (req as any).store;
      const sub = await Subscription.findOne({ where: { storeId: store.id }, order: [['createdAt', 'DESC']] });
      if (!sub) return res.status(404).json({ error: 'No subscription found' });
      if (sub.stripeSubscriptionId) {
        await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
      }
      await sub.update({ status: 'canceled', canceledAt: new Date() });
      res.json({ message: 'Subscription canceled' });
    } catch (error: unknown) {
      logger.error({ err: error }, 'Stripe cancel error');
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  });

  // Public: mevcut kredi paketlerini getir (billing/credits sayfaları için)
  storeRoutes.get('/subscription/credit-packs', authMiddleware, requireStore, async (_req: Request, res: Response) => {
    try {
      const packs = await getPacks();
      res.json({ packs });
    } catch (error: any) {
      logger.error({ err: error }, 'Get credit packs error');
      res.status(500).json({ error: 'Failed to load packs' });
    }
  });

  storeRoutes.post('/subscription/purchase-credits', authMiddleware, requireRole('owner', 'admin'), requireStore, [
    body('credits').isInt({ min: 1 }),
    body('successUrl').optional().isURL(), body('cancelUrl').optional().isURL(),
  ], validate, async (req: Request, res: Response) => {
    try {
      const store = (req as any).store;
      const credits = parseInt(req.body.credits, 10);
      const packs = await getPacks();
      const pack = packs.find(p => p.credits === credits);
      if (!pack) return res.status(400).json({ error: 'Invalid credit package — süperadmin panelden paketleri kontrol edin' });

      const customerId = await ensureCustomer(store);
      const session = await stripe.checkout.sessions.create({
        customer: customerId, payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'try',
            product_data: { name: `${credits} AI Kredisi` },
            unit_amount: pack.price * 100,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: req.body.successUrl || config.apiUrl,
        cancel_url: req.body.cancelUrl || config.apiUrl,
        metadata: { storeId: String(store.id), action: 'credit_purchase', credits: String(credits) },
      });
      res.json({ url: session.url });
    } catch (error: unknown) {
      logger.error({ err: error }, 'Stripe credits checkout error');
      res.status(500).json({ error: 'Failed to create credit checkout session' });
    }
  });

  storeRoutes.post('/webhook/stripe', async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;
    if (!sig || !config.stripe.webhookSecret) return res.status(400).send('Missing signature or secret');
    let event: Stripe.Event;
    try { event = stripe.webhooks.constructEvent(req.body as any, sig, config.stripe.webhookSecret); }
    catch (err: any) { return res.status(400).send(`Webhook Error: ${err.message}`); }

    // Idempotency: stripe_processed_events tablosu (Stripe event id tekil)
    const sequelize = (await import('../../config/database.js')).sequelize;
    try {
      await sequelize.query(`CREATE TABLE IF NOT EXISTS stripe_processed_events ("eventId" VARCHAR(200) PRIMARY KEY, type VARCHAR(100), "createdAt" TIMESTAMP DEFAULT NOW())`);
    } catch {}
    try {
      const [dup]: any = await sequelize.query(`SELECT "eventId" FROM stripe_processed_events WHERE "eventId" = $1`, { bind: [event.id] });
      if (Array.isArray(dup) && dup.length > 0) {
        logger.info(`Stripe webhook duplicate ignored: ${event.id} (${event.type})`);
        return res.json({ received: true, duplicate: true });
      }
    } catch {}

    const markProcessed = async () => {
      try { await sequelize.query(`INSERT INTO stripe_processed_events ("eventId", type) VALUES ($1,$2) ON CONFLICT ("eventId") DO NOTHING`, { bind: [event.id, event.type] }); } catch {}
    };

    // Subscription status mapping (Stripe -> local). Stripe status enum geniştir, locale map et.
    const mapStatus = (s: string): string => {
      const m: Record<string, string> = {
        active: 'active', trialing: 'trialing', past_due: 'past_due', canceled: 'canceled', unpaid: 'unpaid',
        paused: 'canceled', incomplete: 'past_due', incomplete_expired: 'canceled',
      };
      return m[s] || 'active';
    };
    const handleSubscriptionChange = async (sub: Stripe.Subscription) => {
      const status = mapStatus((sub as any).status);
      const periodEnd = (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      // Önce stripeSubscriptionId ile bul, yoksa customer üzerinden store'u bulup planı da metadata'dan almayı dene
      const existing = await Subscription.findOne({ where: { stripeSubscriptionId: sub.id } });
      if (existing) {
        await existing.update({ status, currentPeriodEnd: periodEnd, ...(status === 'canceled' ? { canceledAt: new Date() } : {}) });
        return existing;
      }
      // Fallback: checkout.session.completed henüz gelmediyse (race), subscription metadata'sından oluştur
      const meta: any = (sub as any).metadata || {};
      const storeId = meta.storeId;
      const planId = meta.planId;
      const customerId = typeof (sub as any).customer === 'string' ? (sub as any).customer : (sub as any).customer?.id;
      let sid: number | null = storeId ? parseInt(storeId) : null;
      let pid: number | null = planId ? parseInt(planId) : null;
      if (!sid && customerId) {
        const st = await Store.findOne({ where: { stripeAccountId: customerId } as any });
        if (st) sid = (st as any).id;
      }
      if (sid && pid) {
        const created = await Subscription.create({ storeId: sid, planId: pid, stripeSubscriptionId: sub.id, status, currentPeriodEnd: periodEnd } as any);
        await Store.update({ planId: pid }, { where: { id: sid } });
        return created;
      }
      logger.warn(`Stripe subscription ${sub.id} için store/plan çözülemedi (metadata eksik, customer=${customerId})`);
      return null;
    };

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          // Sadece ödeme tamamlandıysa işle (Stripe'da completed ama payment_status unpaid olabilir)
          if ((session as any).payment_status && (session as any).payment_status !== 'paid' && (session as any).mode !== 'subscription') {
            // subscription modunda payment_status bazen null olur, metadata'ya güven
            logger.info(`Checkout session ${session.id} payment_status=${(session as any).payment_status} — yine de metadata'ya göre işleniyor`);
          }
          const storeId = (session.metadata as any)?.storeId || (session as any).metadata?.storeId;
          const action = (session.metadata as any)?.action;
          if (action === 'credit_purchase') {
            const credits = parseInt((session.metadata as any)?.credits || '0', 10);
            if (storeId && credits > 0) {
              const owner = await User.findOne({ where: { storeId: parseInt(storeId), role: 'owner' } });
              if (owner) {
                const before = owner.aiCredits || 0;
                const after = before + credits;
                await owner.update({ aiCredits: after });
                await CreditLog.create({
                  userId: owner.id, storeId: parseInt(storeId),
                  action: 'grant', module: 'credit_purchase',
                  amount: credits, balanceBefore: before, balanceAfter: after,
                } as any);
                logger.info(`Credit grant: store ${storeId} +${credits} (session ${session.id})`);
              }
            }
          } else {
            const planId = (session.metadata as any)?.planId;
            const subId = (session as any).subscription as string | null;
            if (storeId && planId) {
              // Upsert yerine mevcutu bul/güncelle (storeId unique değil, duplicate önle)
              let sub = await Subscription.findOne({ where: { storeId: parseInt(storeId) }, order: [['createdAt', 'DESC']] });
              if (sub && sub.stripeSubscriptionId === subId) {
                await sub.update({ planId: parseInt(planId), status: 'active', currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), stripeSubscriptionId: subId || sub.stripeSubscriptionId } as any);
              } else {
                await Subscription.create({ storeId: parseInt(storeId), planId: parseInt(planId), stripeSubscriptionId: (subId as any) || `cs_${session.id}`, status: 'active', currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } as any);
              }
              await Store.update({ planId: parseInt(planId) }, { where: { id: parseInt(storeId) } });
              logger.info(`Plan activated: store ${storeId} -> plan ${planId} (session ${session.id}, sub ${subId})`);
            }
          }
          break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.resumed':
        case 'customer.subscription.paused': {
          const sub = event.data.object as Stripe.Subscription;
          const result = await handleSubscriptionChange(sub);
          // Paused ise store'u Free'ye düşür (opsiyonel politika)
          if (event.type === 'customer.subscription.paused' && result) {
            const freePlan = await Plan.findOne({ where: { name: 'Free' } });
            if (freePlan) await Store.update({ planId: freePlan.id }, { where: { id: (result as any).storeId } });
            await (result as any).update({ status: 'canceled', canceledAt: new Date() });
          }
          break;
        }
        case 'customer.subscription.pending_update_applied':
        case 'customer.subscription.pending_update_expired': {
          const sub = event.data.object as Stripe.Subscription;
          await handleSubscriptionChange(sub);
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const existing = await Subscription.findOne({ where: { stripeSubscriptionId: sub.id } });
          if (existing) {
            await existing.update({ status: 'canceled', canceledAt: new Date() });
            const freePlan = await Plan.findOne({ where: { name: 'Free' } });
            if (freePlan) await Store.update({ planId: freePlan.id }, { where: { id: existing.storeId } });
          } else {
            await handleSubscriptionChange(sub);
          }
          break;
        }
        default: {
          // Seçili eventler dışında gelenleri logla ama 200 dön
          logger.info(`Stripe webhook ignored (unhandled type): ${event.type}`);
          break;
        }
      }
      await markProcessed();
      res.json({ received: true });
} catch (error: unknown) {
    logger.error({ err: error, eventType: (event as any)?.type, eventId: (event as any)?.id }, 'Stripe webhook processing error');
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});
}

storeRoutes.get('/api-keys', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const keys = await ApiKey.findAll({ where: { storeId: store.id }, order: [['createdAt', 'DESC']] });
  res.json({ keys: keys.map(k => ({ id: k.id, name: k.name, keyPrefix: k.keyPrefix, allowedIps: k.allowedIps, expiresAt: k.expiresAt, lastUsedAt: k.lastUsedAt, createdAt: k.createdAt })) });
});

storeRoutes.post('/api-keys', authMiddleware, requireRole('owner'), requireStore, [
  body('name').isString().isLength({ min: 2, max: 100 }),
  body('allowedIps').optional().isArray(),
  body('expiresAt').optional().isISO8601(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { name, allowedIps, expiresAt } = req.body;
    const { key, keyHash, keyPrefix } = generateApiKey();
    const apiKey = await ApiKey.create({ storeId: store.id, keyHash, keyPrefix, name, allowedIps, expiresAt });
    res.status(201).json({ key, keyPrefix: apiKey.keyPrefix, id: apiKey.id });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create API key error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

storeRoutes.delete('/api-keys/:id', authMiddleware, requireRole('owner'), requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const apiKey = await ApiKey.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!apiKey) return res.status(404).json({ error: 'Not found' });
    await apiKey.destroy();
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete API key error');
    res.status(500).json({ error: 'Internal server error' });
  }
});