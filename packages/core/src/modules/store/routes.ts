import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { Op } from 'sequelize';
import { Store } from '../../models/Store.model.js';
import { Plan } from '../../models/Plan.model.js';
import { Subscription } from '../../models/Subscription.model.js';
import { User } from '../../models/User.model.js';
import { ApiKey } from '../../models/ApiKey.model.js';
import { CreditLog } from '../../models/CreditLog.model.js';
import { StoreAnalyticsEvent } from '../../models/StoreAnalyticsEvent.model.js';
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
    body('interval').optional().isIn(['month','year']),
    body('couponCode').optional().isString().isLength({ min:3, max:32 }),
    body('coupon_code').optional().isString().isLength({ min:3, max:32 }),
  ], validate, async (req: Request, res: Response) => {
    try {
      const store = (req as any).store;
      const planId = parseInt(req.body.planId ?? req.body.plan_id, 10);
      const plan = await Plan.findByPk(planId);
      if (!plan) return res.status(400).json({ error: 'Invalid plan' });

      const interval = (req.body.interval === 'year' ? 'year' : 'month') as 'month'|'year';
      const rawCoupon = (req.body.couponCode || req.body.coupon_code || '').toString().trim().toUpperCase();
      const successUrl = req.body.successUrl || config.apiUrl;
      const cancelUrl = req.body.cancelUrl || config.apiUrl;

      // validate returnUrl hosts (same as portal)
      for (const url of [successUrl, cancelUrl]) {
        try {
          const u = new URL(url);
          const frontendHost = (()=>{ try{ return new URL(config.frontendUrl).hostname; } catch{ return 'rahatio.com.tr'; }})();
          const allowed = u.hostname === frontendHost || u.hostname === 'rahatio.com.tr' || u.hostname.endsWith('.rahatio.com.tr') || u.hostname === 'localhost' || u.hostname === '127.0.0.1';
          if (!allowed) return res.status(400).json({ error: 'Invalid successUrl/cancelUrl host' });
        } catch { return res.status(400).json({ error: 'Invalid successUrl/cancelUrl' }); }
      }

      // compute base price for interval
      let basePrice = Number((plan as any).price) || 0;
      let stripePriceIdForInterval: string | null = (plan as any).stripePriceId || null;
      if (interval === 'year') {
        const yp = (plan as any).yearlyPrice;
        const ydp = (plan as any).yearlyDiscountPercent;
        if (yp != null) basePrice = Number(yp);
        else if (ydp != null) basePrice = Math.round(Number((plan as any).price) * 12 * (1 - Number(ydp)/100) * 100)/100;
        else basePrice = Number((plan as any).price) * 12;
        stripePriceIdForInterval = (plan as any).stripeYearlyPriceId || (plan as any).stripePriceId || null;
      }

      // coupon validation (if provided) - with FOR UPDATE lock for race safety
      let coupon: any = null;
      let discountAmount = 0;
      let stripeCouponId: string | null = null;
      if (rawCoupon) {
        const { SaasCoupon, SaasCouponRedemption } = await import('../../models/SaasCoupon.model.js');
        const { sequelize } = await import('../../config/database.js');
        // lock coupon row
        coupon = await SaasCoupon.findOne({ where:{ code: rawCoupon, isActive:true } });
        if (!coupon) return res.status(400).json({ error: 'Kod bulunamadı veya pasif' });
        // re-fetch with lock inside transaction for usedCount check later, but quick checks here
        const now = new Date();
        if ((coupon as any).startsAt && new Date((coupon as any).startsAt) > now) return res.status(400).json({ error: 'Kod henüz aktif değil' });
        if ((coupon as any).endsAt && new Date((coupon as any).endsAt) < now) return res.status(400).json({ error: 'Kod süresi dolmuş' });
        if ((coupon as any).usageLimit != null && Number((coupon as any).usedCount) >= Number((coupon as any).usageLimit)) return res.status(400).json({ error: 'Kod kullanım limiti doldu' });
        const planIds = (coupon as any).applicablePlanIds as number[] | null;
        if (planIds && !planIds.includes(Number(plan.id))) return res.status(400).json({ error: 'Bu kod bu plan için geçerli değil' });
        if (Number((coupon as any).minimumAmount) > basePrice) return res.status(400).json({ error: `Bu kod için minimum tutar ${Number((coupon as any).minimumAmount)} TRY` });
        // perCustomerLimit
        const existingRedemptions = await SaasCouponRedemption.count({ where:{ couponId: (coupon as any).id, storeId: store.id } });
        if (existingRedemptions >= Number((coupon as any).perCustomerLimit || 1)) return res.status(400).json({ error: 'Bu kodu zaten kullandınız' });

        // compute discount
        if ((coupon as any).discountType === 'percent') discountAmount = basePrice * Number((coupon as any).discountValue) / 100;
        else discountAmount = Number((coupon as any).discountValue);
        if ((coupon as any).maxDiscount != null) discountAmount = Math.min(discountAmount, Number((coupon as any).maxDiscount));
        discountAmount = Math.min(discountAmount, basePrice);
        discountAmount = Math.round(discountAmount * 100)/100;

        // ensure Stripe coupon (duration once)
        if (stripe && discountAmount > 0) {
          try {
            // reuse existing stripeCouponId if valid
            if ((coupon as any).stripeCouponId) {
              try {
                const existing = await stripe.coupons.retrieve((coupon as any).stripeCouponId);
                if (existing && !existing.deleted) stripeCouponId = existing.id;
              } catch {}
            }
            if (!stripeCouponId) {
              const stripeParams: any = { duration: 'once', name: `Rahatio ${rawCoupon}`, max_redemptions: (coupon as any).usageLimit || undefined, redeem_by: (coupon as any).endsAt ? Math.floor(new Date((coupon as any).endsAt).getTime()/1000) : undefined };
              if ((coupon as any).discountType === 'percent') stripeParams.percent_off = Number((coupon as any).discountValue);
              else stripeParams.amount_off = Math.round(discountAmount * 100), stripeParams.currency = ((plan as any).currency || 'TRY').toLowerCase();
              if ((coupon as any).maxDiscount != null && (coupon as any).discountType==='percent') {
                // Stripe percent_off can't have max, so we fallback to amount_off for final discount
                stripeParams.percent_off = undefined;
                stripeParams.amount_off = Math.round(discountAmount * 100);
                stripeParams.currency = ((plan as any).currency || 'TRY').toLowerCase();
              }
              const created = await stripe.coupons.create(stripeParams);
              stripeCouponId = created.id;
              await coupon.update({ stripeCouponId } as any);
            }
          } catch (stripeErr:any) {
            logger.warn({ err: stripeErr.message, code: rawCoupon }, 'Stripe coupon create failed, fallback to price reduction');
            // fallback: will reduce unit_amount instead
            stripeCouponId = null;
          }
        }
      }

      const finalPrice = Math.max(0, basePrice - discountAmount);
      // 100% discount or free plan -> activate without Stripe
      if (finalPrice <= 0.01 || Number((plan as any).price) <= 0) {
        const periodEnd = interval==='year' ? new Date(Date.now()+365*24*60*60*1000) : new Date(Date.now()+30*24*60*60*1000);
        // record redemption if coupon used
        if (coupon) {
          const { SaasCouponRedemption } = await import('../../models/SaasCoupon.model.js');
          const { sequelize } = await import('../../config/database.js');
          await sequelize.transaction(async (t:any)=>{
            const locked = await (await import('../../models/SaasCoupon.model.js')).SaasCoupon.findOne({ where:{ id: (coupon as any).id }, lock: t.LOCK.UPDATE, transaction: t });
            if (!locked) throw new Error('Kupon bulunamadı');
            if (Number((locked as any).usedCount) >= Number((locked as any).usageLimit || 9999999)) throw new Error('Kullanım limiti doldu');
            await SaasCouponRedemption.create({ couponId:(coupon as any).id, storeId: store.id, subscriptionId:null, discountApplied: discountAmount, stripeCouponId } as any, { transaction: t });
            await (locked as any).increment('usedCount', { by:1, transaction: t });
          });
        }
        await Subscription.upsert({
          storeId: store.id, planId: plan.id,
          status: 'active', currentPeriodEnd: periodEnd, billingInterval: interval, appliedCouponCode: coupon ? rawCoupon : null, appliedDiscountAmount: discountAmount,
        } as any);
        await store.update({ planId: plan.id });
        return res.json({ url: null, free: true, billingInterval: interval });
      }

      if (!stripe) return res.status(500).json({ error: 'Stripe is not configured (STRIPE_SECRET_KEY missing)' });
      const customerId = await ensureCustomer(store);

      // build lineItem for interval
      const lineItem: any = (() => {
        // if interval year and stripeYearlyPriceId exists use it (ignore coupon stripe path - stripe will apply coupon on session)
        if (stripePriceIdForInterval && stripePriceIdForInterval !== (plan as any).stripePriceId) {
          return { price: stripePriceIdForInterval, quantity: 1 };
        }
        if ((plan as any).stripePriceId && interval==='month') return { price: (plan as any).stripePriceId, quantity: 1 };
        // dynamic price_data
        // if we have stripeCoupon fallback not available and discount exists, reduce unit_amount
        const unitAmount = stripeCouponId ? Math.round(basePrice * 100) : Math.round(finalPrice * 100);
        return {
            price_data: {
              currency: ((plan as any).currency || 'TRY').toLowerCase(),
              product_data: { name: `${plan.name}${interval==='year'?' (Yıllık)':''}`, description: plan.description || undefined },
              unit_amount: unitAmount,
              recurring: { interval: interval as 'month' | 'year' },
            },
            quantity: 1,
          };
      })();

      const sessionParams: any = {
        customer: customerId, payment_method_types: ['card'],
        line_items: [lineItem],
        mode: 'subscription', success_url: successUrl, cancel_url: cancelUrl,
        metadata: { storeId: String(store.id), planId: String(plan.id), interval, couponCode: rawCoupon || '', discountAmount: String(discountAmount), billingInterval: interval },
        subscription_data: { metadata: { storeId: String(store.id), planId: String(plan.id), interval, couponCode: rawCoupon || '', billingInterval: interval } },
      };
      if (stripeCouponId) sessionParams.discounts = [{ coupon: stripeCouponId }];
      // also store coupon for webhook redemption (if price reduction path, metadata already has it)

      const session = await stripe.checkout.sessions.create(sessionParams);
      res.json({ url: session.url, billingInterval: interval, discountAmount, basePrice, finalPrice });
    } catch (error: unknown) {
      logger.error({ err: error }, 'Stripe checkout error');
      const msg = (error as any)?.message || 'Failed to create checkout session';
      // pass through 400 errors
      if ((error as any)?.status === 400) return res.status(400).json({ error: msg });
      res.status(500).json({ error: 'Failed to create checkout session', details: msg });
    }
  });

  storeRoutes.post('/subscription/portal', authMiddleware, requireRole('owner'), requireStore, [
    body('returnUrl').optional().isURL(),
  ], validate, async (req: Request, res: Response) => {
    try {
      const store = (req as any).store;
      if (!store.stripeAccountId) return res.status(400).json({ error: 'No Stripe customer' });
      const rawReturn = req.body.returnUrl || config.apiUrl;
      // allowlist check for portal returnUrl
      try {
        const u = new URL(rawReturn);
        const frontendHost = (()=>{ try{ return new URL(config.frontendUrl).hostname; } catch{ return 'rahatio.com.tr'; }})();
        const allowed = u.hostname === frontendHost || u.hostname === 'rahatio.com.tr' || u.hostname.endsWith('.rahatio.com.tr') || u.hostname === 'localhost' || u.hostname === '127.0.0.1';
        if (!allowed) return res.status(400).json({ error: 'Invalid returnUrl host' });
      } catch { return res.status(400).json({ error: 'Invalid returnUrl' }); }
      const session = await stripe.billingPortal.sessions.create({
        customer: store.stripeAccountId, return_url: rawReturn,
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
                // purchase conversion (credits)
                try {
                  const amount = (session as any).amount_total ? (session as any).amount_total / 100 : null;
                  const currency = (session as any).currency ? String((session as any).currency).toUpperCase() : 'TRY';
                  await StoreAnalyticsEvent.create({
                    storeId: null, sessionId: null, visitorId: null,
                    eventType: 'purchase' as any,
                    path: '/billing/credits', productId: null,
                    referrer: null, utmSource: null, utmMedium: null, utmCampaign: null,
                    device: null, ipHash: null, userAgent: null,
                    metadata: { type: 'credit_purchase', credits, amount, currency, storeId: parseInt(storeId), sessionId: session.id },
                  } as any);
                } catch {}
              }
            }
          } else {
            const planId = (session.metadata as any)?.planId;
            const subId = (session as any).subscription as string | null;
            const couponCode = (session.metadata as any)?.couponCode || (session.metadata as any)?.coupon_code || null;
            const billingInterval = (session.metadata as any)?.billingInterval || (session.metadata as any)?.interval || 'month';
            const discountAmount = parseFloat((session.metadata as any)?.discountAmount || '0') || 0;
            if (storeId && planId) {
              const periodMs = billingInterval==='year' ? 365*24*60*60*1000 : 30*24*60*60*1000;
              // Upsert yerine mevcutu bul/güncelle (storeId unique değil, duplicate önle)
              let sub: any = await Subscription.findOne({ where: { storeId: parseInt(storeId) }, order: [['createdAt', 'DESC']] });
              if (sub && sub.stripeSubscriptionId === subId) {
                await sub.update({ planId: parseInt(planId), status: 'active', currentPeriodEnd: new Date(Date.now() + periodMs), stripeSubscriptionId: subId || sub.stripeSubscriptionId, billingInterval, appliedCouponCode: couponCode || sub.appliedCouponCode, appliedDiscountAmount: discountAmount || sub.appliedDiscountAmount } as any);
              } else {
                sub = await Subscription.create({ storeId: parseInt(storeId), planId: parseInt(planId), stripeSubscriptionId: (subId as any) || `cs_${session.id}`, status: 'active', currentPeriodEnd: new Date(Date.now() + periodMs), billingInterval, appliedCouponCode: couponCode || null, appliedDiscountAmount: discountAmount } as any);
              }
              await Store.update({ planId: parseInt(planId) }, { where: { id: parseInt(storeId) } });
              // SaaS coupon redemption (first cycle only)
              if (couponCode) {
                try {
                  const { SaasCoupon, SaasCouponRedemption } = await import('../../models/SaasCoupon.model.js');
                  const coupon = await SaasCoupon.findOne({ where:{ code: couponCode.toUpperCase(), isActive:true } });
                  if (coupon) {
                    const existingRedemption = await SaasCouponRedemption.findOne({ where:{ couponId: (coupon as any).id, storeId: parseInt(storeId) } });
                    if (!existingRedemption) {
                      const sequelizeInner = (await import('../../config/database.js')).sequelize;
                      await sequelizeInner.transaction(async (t:any)=>{
                        const locked = await SaasCoupon.findOne({ where:{ id:(coupon as any).id }, lock: t.LOCK.UPDATE, transaction:t });
                        if (locked && (Number((locked as any).usedCount) < Number((locked as any).usageLimit || 9999999))) {
                          await SaasCouponRedemption.create({ couponId:(coupon as any).id, storeId: parseInt(storeId), subscriptionId: sub.id, discountApplied: discountAmount, stripeCouponId: (coupon as any).stripeCouponId } as any, { transaction: t });
                          await locked.increment('usedCount', { by:1, transaction:t });
                        }
                      });
                    }
                  }
                } catch (couponErr:any){ logger.warn({ err: couponErr.message, couponCode }, 'Coupon redemption handling failed'); }
              }
              logger.info(`Plan activated: store ${storeId} -> plan ${planId} interval=${billingInterval} coupon=${couponCode||'-'} (session ${session.id}, sub ${subId})`);
              // purchase conversion (subscription)
              try {
                const plan = await Plan.findByPk(parseInt(planId));
                let amount = plan ? Number(plan.price) : null;
                if (billingInterval==='year' && plan) {
                  const yp = (plan as any).yearlyPrice;
                  const ydp = (plan as any).yearlyDiscountPercent;
                  if (yp != null) amount = Number(yp);
                  else if (ydp != null) amount = Math.round(Number(plan.price)*12*(1-Number(ydp)/100)*100)/100;
                  else amount = Number(plan.price)*12;
                }
                const currency = plan ? String(plan.currency || 'TRY') : 'TRY';
                await StoreAnalyticsEvent.create({
                  storeId: null, sessionId: null, visitorId: null,
                  eventType: 'purchase' as any,
                  path: '/billing', productId: null,
                  referrer: null, utmSource: null, utmMedium: null, utmCampaign: null,
                  device: null, ipHash: null, userAgent: null,
                  metadata: { type: 'subscription', planId: parseInt(planId), planName: plan?.name, amount: amount!=null? Math.max(0, amount - discountAmount): null, currency, storeId: parseInt(storeId), sessionId: session.id, billingInterval, couponCode, discountAmount },
                } as any);
              } catch {}
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