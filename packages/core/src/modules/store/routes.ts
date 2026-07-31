import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
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
      id: store.id, name: store.name, siteCode: store.siteCode, domain: store.domain,
      email: store.email, isActive: store.isActive, currency: store.currency,
      theme: store.theme, taxSettings: store.taxSettings, shippingSettings: store.shippingSettings,
    },
    subscription: subscription ? serializeSubscription(subscription) : null,
  });
});

storeRoutes.put('/me', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('name').optional().isString().isLength({ min: 2, max: 255 }),
  body('domain').optional().isString().isLength({ max: 255 }),
  body('email').optional().isEmail(),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }),
  body('theme').optional().isObject(),
  body('taxSettings').optional().isObject(),
  body('shippingSettings').optional().isObject(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { name, domain, email, currency, theme, taxSettings, shippingSettings } = req.body;

    if (domain && domain !== store.domain) {
      const existing = await Store.findOne({ where: { domain } });
      if (existing) return res.status(409).json({ error: 'Domain already taken' });
    }

    await store.update({ name, domain, email, currency, theme, taxSettings, shippingSettings });
    logger.info(`Store updated: ${store.id}`);
    res.json({ message: 'Settings updated', store: { id: store.id, name: store.name, siteCode: store.siteCode } });
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
  const CREDIT_PACKS = [
    { credits: 50, price: 50 },
    { credits: 200, price: 150 },
    { credits: 500, price: 300 },
  ];

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

      if (!plan.stripePriceId || Number(plan.price) <= 0) {
        await Subscription.upsert({
          storeId: store.id, planId: plan.id,
          status: 'active', currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        await store.update({ planId: plan.id });
        return res.json({ url: null });
      }

      const customerId = await ensureCustomer(store);

      const session = await stripe.checkout.sessions.create({
        customer: customerId, payment_method_types: ['card'],
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        mode: 'subscription', success_url: successUrl, cancel_url: cancelUrl,
        metadata: { storeId: store.id, planId: plan.id },
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

  storeRoutes.post('/subscription/purchase-credits', authMiddleware, requireRole('owner', 'admin'), requireStore, [
    body('credits').isInt({ min: 1 }),
    body('successUrl').optional().isURL(), body('cancelUrl').optional().isURL(),
  ], validate, async (req: Request, res: Response) => {
    try {
      const store = (req as any).store;
      const credits = parseInt(req.body.credits, 10);
      const pack = CREDIT_PACKS.find(p => p.credits === credits);
      if (!pack) return res.status(400).json({ error: 'Invalid credit package' });

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
    let event;
    try { event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret); }
    catch (err: any) { return res.status(400).send(`Webhook Error: ${err.message}`); }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const storeId = session.metadata?.storeId;
          if (session.metadata?.action === 'credit_purchase') {
            const credits = parseInt(session.metadata.credits || '0', 10);
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
                });
              }
            }
            break;
          }
          const planId = session.metadata?.planId;
          if (storeId && planId) {
            await Subscription.upsert({
              storeId: parseInt(storeId), planId: parseInt(planId),
              stripeSubscriptionId: session.subscription as string,
              status: 'active', currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            });
            await Store.update({ planId: parseInt(planId) }, { where: { id: storeId } });
          }
          break;
        }
        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          await Subscription.update(
            { status: sub.status, currentPeriodEnd: new Date(sub.current_period_end * 1000) },
            { where: { stripeSubscriptionId: sub.id } }
          );
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          await Subscription.update({ status: 'canceled', canceledAt: new Date() }, { where: { stripeSubscriptionId: sub.id } });
          const s = await Subscription.findOne({ where: { stripeSubscriptionId: sub.id } });
          if (s) {
            const freePlan = await Plan.findOne({ where: { name: 'Free' } });
            if (freePlan) await Store.update({ planId: freePlan.id }, { where: { id: s.storeId } });
          }
          break;
        }
      }
      res.json({ received: true });
} catch (error: unknown) {
    logger.error({ err: error }, 'Stripe webhook processing error');
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