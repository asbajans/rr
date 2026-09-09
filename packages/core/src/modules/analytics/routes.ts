import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Op, fn, col, literal, QueryTypes } from 'sequelize';
import { query, body, param, validationResult } from 'express-validator';
import { Store } from '../../models/Store.model.js';
import { StoreAnalyticsEvent } from '../../models/StoreAnalyticsEvent.model.js';
import { Subscription } from '../../models/Subscription.model.js';
import { Plan } from '../../models/Plan.model.js';
import { User } from '../../models/User.model.js';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { Product } from '../../models/Product.model.js';
import { Setting } from '../../models/Setting.model.js';
import { sequelize } from '../../config/database.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

function hashIp(ip: string): string {
  const salt = process.env.ANALYTICS_SALT || 'rahatio-analytics-salt';
  return crypto.createHash('sha256').update(ip + salt).digest('hex').slice(0, 32);
}

function detectDevice(ua: string): string {
  const u = ua.toLowerCase();
  if (/mobile|android|iphone/.test(u)) return 'mobile';
  if (/tablet|ipad/.test(u)) return 'tablet';
  return 'desktop';
}

function isBot(ua: string): boolean {
  return /bot|crawl|spider|slurp|mediapartners|baidu|yandex|sogou|exabot|facebot|ia_archiver/i.test(ua);
}

// Public beacon: store site analytics (no auth) + platform SaaS beacon (storeId null)
export const analyticsPublicRoutes: Router = Router();

// POST /api/store/:siteCode/track  (storefront beacon)
analyticsPublicRoutes.post(
  '/:siteCode/track',
  [
    body('eventType').isIn(['page_view', 'product_view', 'add_to_cart', 'checkout_started', 'purchase', 'search', 'signup', 'lead', 'whatsapp_click', 'blog_view', 'cta_click']),
    body('path').optional().isString().isLength({ max: 500 }),
    body('productId').optional().isInt({ min: 1 }),
    body('referrer').optional().isString().isLength({ max: 500 }),
    body('utmSource').optional().isString().isLength({ max: 100 }),
    body('utm_source').optional().isString().isLength({ max: 100 }),
    body('utmMedium').optional().isString().isLength({ max: 100 }),
    body('utm_medium').optional().isString().isLength({ max: 100 }),
    body('utmCampaign').optional().isString().isLength({ max: 100 }),
    body('utm_campaign').optional().isString().isLength({ max: 100 }),
    body('sessionId').optional().isString().isLength({ max: 64 }),
    body('visitorId').optional().isString().isLength({ max: 64 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const ua = String(req.headers['user-agent'] || '');
      if (ua && isBot(ua)) return res.json({ ok: true, skipped: 'bot' });
      const siteCode = String(req.params.siteCode);
      const store = await Store.findOne({ where: { siteCode, isActive: true } });
      if (!store) return res.status(404).json({ error: 'STORE_NOT_FOUND' });
      const b: any = req.body || {};
      const eventType = String(b.eventType);
      // simple dedup: product_view same session+product within 5min -> skip
      if (eventType === 'product_view' && b.sessionId && b.productId) {
        const recent = await StoreAnalyticsEvent.findOne({
          where: {
            storeId: store.id,
            eventType: 'product_view',
            sessionId: String(b.sessionId),
            productId: Number(b.productId),
            createdAt: { [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) },
          },
        });
        if (recent) return res.json({ ok: true, deduped: true });
      }
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
      await StoreAnalyticsEvent.create({
        storeId: store.id,
        sessionId: b.sessionId ? String(b.sessionId).slice(0, 64) : null,
        visitorId: b.visitorId ? String(b.visitorId).slice(0, 64) : null,
        eventType,
        path: b.path ? String(b.path).slice(0, 500) : null,
        productId: b.productId ? Number(b.productId) : null,
        referrer: b.referrer ? String(b.referrer).slice(0, 500) : null,
        utmSource: (b.utmSource || b.utm_source) ? String(b.utmSource || b.utm_source).slice(0, 100) : null,
        utmMedium: (b.utmMedium || b.utm_medium) ? String(b.utmMedium || b.utm_medium).slice(0, 100) : null,
        utmCampaign: (b.utmCampaign || b.utm_campaign) ? String(b.utmCampaign || b.utm_campaign).slice(0, 100) : null,
        device: detectDevice(ua),
        ipHash: ip ? hashIp(ip) : null,
        userAgent: ua ? ua.slice(0, 500) : null,
        metadata: b.metadata || null,
      } as any);
      res.json({ ok: true });
    } catch (e) {
      logger.error({ err: e }, 'Store track error');
      res.json({ ok: true });
    }
  },
);

// POST /api/analytics/platform/track  (SaaS landing beacon, no auth, storeId null)
export const saasBeaconRoutes: Router = Router();
// Public SaaS pixels (no auth) — landing / marketing injector fetches enabled pixels
saasBeaconRoutes.get('/platform/pixels', async (_req: Request, res: Response) => {
  try {
    const row = await Setting.findByPk('saas_pixels');
    const pixels = (row?.value as any) || {};
    res.json({ pixels });
  } catch (e) {
    logger.error({ err: e }, 'Public SaaS pixels fetch error');
    res.json({ pixels: {} });
  }
});
saasBeaconRoutes.post(
  '/platform/track',
  [
    body('eventType').optional().isIn(['platform_view', 'whatsapp_click', 'cta_click', 'signup', 'purchase', 'lead', 'checkout_started', 'search', 'blog_view']),
    body('path').optional().isString().isLength({ max: 500 }),
    body('referrer').optional().isString().isLength({ max: 500 }),
    body('utmSource').optional().isString().isLength({ max: 100 }),
    body('utm_source').optional().isString().isLength({ max: 100 }),
    body('utmMedium').optional().isString().isLength({ max: 100 }),
    body('utm_medium').optional().isString().isLength({ max: 100 }),
    body('utmCampaign').optional().isString().isLength({ max: 100 }),
    body('utm_campaign').optional().isString().isLength({ max: 100 }),
    body('sessionId').optional().isString().isLength({ max: 64 }),
    body('metadata').optional().isObject(),
  ],
  async (req: Request, res: Response) => {
    try {
      const ua = String(req.headers['user-agent'] || '');
      if (ua && isBot(ua)) return res.json({ ok: true, skipped: 'bot' });
      const b: any = req.body || {};
      const rawType = b.eventType ? String(b.eventType) : 'platform_view';
      const allowed = new Set(['platform_view', 'whatsapp_click', 'cta_click', 'signup', 'purchase', 'lead', 'checkout_started', 'search', 'blog_view']);
      const eventType = allowed.has(rawType) ? rawType : 'platform_view';
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
      await StoreAnalyticsEvent.create({
        storeId: null,
        sessionId: b.sessionId ? String(b.sessionId).slice(0, 64) : null,
        visitorId: null,
        eventType,
        path: b.path ? String(b.path).slice(0, 500) : '/',
        productId: null,
        referrer: b.referrer ? String(b.referrer).slice(0, 500) : null,
        utmSource: (b.utmSource || b.utm_source) ? String(b.utmSource || b.utm_source).slice(0, 100) : null,
        utmMedium: (b.utmMedium || b.utm_medium) ? String(b.utmMedium || b.utm_medium).slice(0, 100) : null,
        utmCampaign: (b.utmCampaign || b.utm_campaign) ? String(b.utmCampaign || b.utm_campaign).slice(0, 100) : null,
        device: detectDevice(ua),
        ipHash: ip ? hashIp(ip) : null,
        userAgent: ua ? ua.slice(0, 500) : null,
        metadata: b.metadata || null,
      } as any);
      res.json({ ok: true });
    } catch (e) {
      logger.error({ err: e }, 'Platform track error');
      res.json({ ok: true });
    }
  },
);

// Seller analytics: store-scoped stats
export const sellerAnalyticsRoutes: Router = Router();
sellerAnalyticsRoutes.use(authMiddleware, requireStore);

sellerAnalyticsRoutes.get(
  '/overview',
  [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('days').optional().isInt({ min: 1, max: 365 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const store = (req as any).store;
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      let from: Date, to: Date;
      if (req.query.from || req.query.to) {
        from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - days * 24 * 3600 * 1000);
        to = req.query.to ? new Date(req.query.to as string) : new Date();
      } else {
        to = new Date();
        from = new Date(Date.now() - days * 24 * 3600 * 1000);
      }
      const baseWhere: any = { storeId: store.id, createdAt: { [Op.gte]: from, [Op.lte]: to } };

      const [totalPageViews, totalProductViews, totalAddToCart, totalPurchases, uniqueVisitors, revenueAgg, totalSignups] = await Promise.all([
        StoreAnalyticsEvent.count({ where: { ...baseWhere, eventType: 'page_view' } }),
        StoreAnalyticsEvent.count({ where: { ...baseWhere, eventType: 'product_view' } }),
        StoreAnalyticsEvent.count({ where: { ...baseWhere, eventType: 'add_to_cart' } }),
        StoreAnalyticsEvent.count({ where: { ...baseWhere, eventType: 'purchase' } }),
        StoreAnalyticsEvent.count({ where: baseWhere, distinct: true, col: 'sessionId' }),
        DropshippingOrder.findAll({
          where: { storeId: store.id, marketplace: 'storefront', createdAt: { [Op.gte]: from, [Op.lte]: to } },
          attributes: [[fn('COALESCE', fn('SUM', col('totalAmount')), 0), 'total'], [fn('COUNT', col('id')), 'cnt']],
          raw: true,
        } as any).then((r: any) => ({ total: parseFloat(r[0]?.total || 0), cnt: parseInt(r[0]?.cnt || 0) })),
        StoreAnalyticsEvent.count({ where: { ...baseWhere, eventType: 'signup' } }),
      ]);

      // Daily series (last N days)
      const daily: any[] = await sequelize.query(
        `SELECT date_trunc('day', "createdAt")::date as d, "eventType", COUNT(*)::int as c
         FROM store_analytics_events
         WHERE "storeId" = :storeId AND "createdAt" BETWEEN :from AND :to
         GROUP BY d, "eventType" ORDER BY d ASC`,
        { replacements: { storeId: store.id, from, to }, type: QueryTypes.SELECT },
      );
      const dayMap = new Map<string, any>();
      for (const r of daily) {
        const d = String((r as any).d).slice(0, 10);
        if (!dayMap.has(d)) dayMap.set(d, { date: d, page_view: 0, product_view: 0, add_to_cart: 0, purchase: 0, signup: 0 });
        dayMap.get(d)[(r as any).eventType] = Number((r as any).c);
      }
      // fill missing days
      const series: any[] = [];
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const k = d.toISOString().slice(0, 10);
        series.push(dayMap.get(k) || { date: k, page_view: 0, product_view: 0, add_to_cart: 0, purchase: 0, signup: 0 });
      }

      // Top products by product_view
      const topProducts: any[] = await sequelize.query(
        `SELECT "productId", COUNT(*)::int as views
         FROM store_analytics_events
         WHERE "storeId" = :storeId AND "eventType" = 'product_view' AND "createdAt" BETWEEN :from AND :to AND "productId" IS NOT NULL
         GROUP BY "productId" ORDER BY views DESC LIMIT 10`,
        { replacements: { storeId: store.id, from, to }, type: QueryTypes.SELECT },
      );
      let topProductsEnriched: any[] = [];
      if (topProducts.length) {
        const ids = topProducts.map((p: any) => p.productId);
        const prods = await Product.findAll({ where: { id: ids as any }, attributes: ['id', 'title', 'sku', 'images'] });
        const pmap = new Map(prods.map((p: any) => [p.id, p]));
        topProductsEnriched = topProducts.map((p: any) => {
          const prod: any = pmap.get(Number(p.productId));
          return { productId: p.productId, views: p.views, title: prod?.title || `#${p.productId}`, sku: prod?.sku || '', image: Array.isArray(prod?.images) ? prod.images[0] : null };
        });
      }

      // Source breakdown
      const sources: any[] = await sequelize.query(
        `SELECT COALESCE("utmSource",'direct') as src, COUNT(*)::int as c
         FROM store_analytics_events
         WHERE "storeId" = :storeId AND "createdAt" BETWEEN :from AND :to
         GROUP BY src ORDER BY c DESC LIMIT 10`,
        { replacements: { storeId: store.id, from, to }, type: QueryTypes.SELECT },
      );

      const conversion = totalPageViews > 0 ? Number(((totalPurchases / totalPageViews) * 100).toFixed(2)) : 0;

      res.json({
        kpi: {
          pageViews: totalPageViews,
          productViews: totalProductViews,
          addToCarts: totalAddToCart,
          purchases: totalPurchases,
          signups: totalSignups,
          uniqueVisitors,
          revenue: revenueAgg.total,
          orderCount: revenueAgg.cnt,
          conversion,
        },
        series,
        topProducts: topProductsEnriched,
        sources,
        from: from.toISOString(),
        to: to.toISOString(),
      });
    } catch (e) {
      logger.error({ err: e }, 'Seller analytics overview error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Superadmin SaaS analytics (platform)
export const saasAnalyticsRoutes: Router = Router();
saasAnalyticsRoutes.use(authMiddleware, requireRole('superadmin'));

saasAnalyticsRoutes.get(
  '/saas/overview',
  [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('days').optional().isInt({ min: 1, max: 365 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      let from: Date, to: Date;
      if (req.query.from || req.query.to) {
        from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - days * 24 * 3600 * 1000);
        to = req.query.to ? new Date(req.query.to as string) : new Date();
      } else {
        to = new Date();
        from = new Date(Date.now() - days * 24 * 3600 * 1000);
      }

      const platformWhere: any = { storeId: null, eventType: 'platform_view', createdAt: { [Op.gte]: from, [Op.lte]: to } };
      const whatsappWhere: any = { storeId: null, eventType: 'whatsapp_click', createdAt: { [Op.gte]: from, [Op.lte]: to } };
      const signupEventWhere: any = { storeId: null, eventType: 'signup', createdAt: { [Op.gte]: from, [Op.lte]: to } };
      const purchaseEventWhere: any = { storeId: null, eventType: 'purchase', createdAt: { [Op.gte]: from, [Op.lte]: to } };

      const [platformViews, platformUnique, whatsappClicks, signupEvents, purchaseEvents, totalUsers, newUsers, totalStores, newStores] = await Promise.all([
        StoreAnalyticsEvent.count({ where: platformWhere }),
        StoreAnalyticsEvent.count({ where: platformWhere, distinct: true, col: 'sessionId' }),
        StoreAnalyticsEvent.count({ where: whatsappWhere }),
        StoreAnalyticsEvent.count({ where: signupEventWhere }),
        StoreAnalyticsEvent.count({ where: purchaseEventWhere }),
        User.count({}),
        User.count({ where: { createdAt: { [Op.gte]: from, [Op.lte]: to } } }),
        Store.count({}),
        Store.count({ where: { createdAt: { [Op.gte]: from, [Op.lte]: to } } }),
      ]);

      // Subscriptions / package sales
      const [activeSubs, totalSubs, trialSubs, canceledSubs] = await Promise.all([
        Subscription.count({ where: { status: 'active' } }),
        Subscription.count({}),
        Subscription.count({ where: { status: 'trialing' } }),
        Subscription.count({ where: { status: 'canceled' } }),
      ]);
      // Revenue not tracked via stripe amount here; use plan price join for active subs as estimate
      let revenueEstimate = 0;
      try {
        const subsWithPlan: any[] = await sequelize.query(
          `SELECT p.price FROM subscriptions s JOIN plans p ON p.id = s."planId" WHERE s.status = 'active'`,
          { type: QueryTypes.SELECT },
        );
        revenueEstimate = subsWithPlan.reduce((sum, r: any) => sum + parseFloat(r.price || 0), 0);
      } catch {}

      // Churn / not renewed: canceled + past_due + unpaid where currentPeriodEnd < now - 7d
      const churnCount = await Subscription.count({
        where: {
          status: { [Op.in]: ['canceled', 'past_due', 'unpaid'] },
          currentPeriodEnd: { [Op.lt]: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
        } as any,
      });
      // Expiring soon: active/trialing where currentPeriodEnd within next 7 days
      const expiringSoon = await Subscription.count({
        where: {
          status: { [Op.in]: ['active', 'trialing'] },
          currentPeriodEnd: { [Op.gte]: new Date(), [Op.lte]: new Date(Date.now() + 7 * 24 * 3600 * 1000) },
        } as any,
      });

      // Per-plan sales breakdown
      const planBreakdown: any[] = await sequelize.query(
        `SELECT p.name, p.slug, p.price, COUNT(s.id)::int as cnt
         FROM subscriptions s JOIN plans p ON p.id = s."planId"
         WHERE s.status IN ('active','trialing')
         GROUP BY p.id, p.name, p.slug, p.price ORDER BY cnt DESC`,
        { type: QueryTypes.SELECT },
      );

      // Platform visit sources
      const platformSources: any[] = await sequelize.query(
        `SELECT COALESCE("utmSource",'direct') as src, COUNT(*)::int as c
         FROM store_analytics_events
         WHERE "storeId" IS NULL AND "eventType"='platform_view' AND "createdAt" BETWEEN :from AND :to
         GROUP BY src ORDER BY c DESC LIMIT 10`,
        { replacements: { from, to }, type: QueryTypes.SELECT },
      );

      // Daily platform visits series
      const platformDaily: any[] = await sequelize.query(
        `SELECT date_trunc('day', "createdAt")::date as d, COUNT(*)::int as c
         FROM store_analytics_events
         WHERE "storeId" IS NULL AND "eventType"='platform_view' AND "createdAt" BETWEEN :from AND :to
         GROUP BY d ORDER BY d ASC`,
        { replacements: { from, to }, type: QueryTypes.SELECT },
      );
      const pDayMap = new Map<string, number>();
      for (const r of platformDaily) pDayMap.set(String((r as any).d).slice(0, 10), Number((r as any).c));
      const platformSeries: any[] = [];
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const k = d.toISOString().slice(0, 10);
        platformSeries.push({ date: k, views: pDayMap.get(k) || 0 });
      }
      // Daily whatsapp clicks
      const whatsappDaily: any[] = await sequelize.query(
        `SELECT date_trunc('day', "createdAt")::date as d, COUNT(*)::int as c
         FROM store_analytics_events
         WHERE "storeId" IS NULL AND "eventType"='whatsapp_click' AND "createdAt" BETWEEN :from AND :to
         GROUP BY d ORDER BY d ASC`,
        { replacements: { from, to }, type: QueryTypes.SELECT },
      );
      const wDayMap = new Map<string, number>();
      for (const r of whatsappDaily) wDayMap.set(String((r as any).d).slice(0, 10), Number((r as any).c));
      const whatsappSeries: any[] = [];
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const k = d.toISOString().slice(0, 10);
        whatsappSeries.push({ date: k, clicks: wDayMap.get(k) || 0 });
      }
      // Daily signup / purchase (platform conversions)
      const signupDaily: any[] = await sequelize.query(
        `SELECT date_trunc('day', "createdAt")::date as d, COUNT(*)::int as c
         FROM store_analytics_events
         WHERE "storeId" IS NULL AND "eventType"='signup' AND "createdAt" BETWEEN :from AND :to
         GROUP BY d ORDER BY d ASC`,
        { replacements: { from, to }, type: QueryTypes.SELECT },
      );
      const purchaseDaily: any[] = await sequelize.query(
        `SELECT date_trunc('day', "createdAt")::date as d, COUNT(*)::int as c
         FROM store_analytics_events
         WHERE "storeId" IS NULL AND "eventType"='purchase' AND "createdAt" BETWEEN :from AND :to
         GROUP BY d ORDER BY d ASC`,
        { replacements: { from, to }, type: QueryTypes.SELECT },
      );
      const sDayMap = new Map<string, number>();
      for (const r of signupDaily) sDayMap.set(String((r as any).d).slice(0, 10), Number((r as any).c));
      const puDayMap = new Map<string, number>();
      for (const r of purchaseDaily) puDayMap.set(String((r as any).d).slice(0, 10), Number((r as any).c));
      const signupSeries: any[] = [];
      const purchaseSeries: any[] = [];
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const k = d.toISOString().slice(0, 10);
        signupSeries.push({ date: k, count: sDayMap.get(k) || 0 });
        purchaseSeries.push({ date: k, count: puDayMap.get(k) || 0 });
      }

      // Daily new users/stores series
      const userDaily: any[] = await sequelize.query(
        `SELECT date_trunc('day', "createdAt")::date as d, COUNT(*)::int as c FROM users WHERE "createdAt" BETWEEN :from AND :to GROUP BY d ORDER BY d ASC`,
        { replacements: { from, to }, type: QueryTypes.SELECT },
      );
      const storeDaily: any[] = await sequelize.query(
        `SELECT date_trunc('day', "createdAt")::date as d, COUNT(*)::int as c FROM stores WHERE "createdAt" BETWEEN :from AND :to GROUP BY d ORDER BY d ASC`,
        { replacements: { from, to }, type: QueryTypes.SELECT },
      );
      const uMap = new Map(userDaily.map((r: any) => [String(r.d).slice(0, 10), Number(r.c)]));
      const sMap = new Map(storeDaily.map((r: any) => [String(r.d).slice(0, 10), Number(r.c)]));
      const growthSeries: any[] = [];
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const k = d.toISOString().slice(0, 10);
        growthSeries.push({ date: k, newUsers: uMap.get(k) || 0, newStores: sMap.get(k) || 0 });
      }

      // Top stores by revenue/orders (for drilldown but SaaS page shows aggregate)
      const topStores: any[] = await sequelize.query(
        `SELECT s."storeId", st."siteCode", st.name, COUNT(*)::int as orders, COALESCE(SUM(s."totalAmount"),0)::float as revenue
         FROM dropshipping_orders s JOIN stores st ON st.id=s."storeId"
         WHERE s."createdAt" BETWEEN :from AND :to
         GROUP BY s."storeId", st."siteCode", st.name
         ORDER BY revenue DESC LIMIT 10`,
        { replacements: { from, to }, type: QueryTypes.SELECT },
      );

      res.json({
        platform: { views: platformViews, uniqueVisitors: platformUnique, whatsappClicks, signupEvents, purchaseEvents, sources: platformSources, series: platformSeries, whatsappSeries, signupSeries, purchaseSeries },
        users: { total: totalUsers, new: newUsers },
        stores: { total: totalStores, new: newStores },
        subscriptions: { total: totalSubs, active: activeSubs, trialing: trialSubs, canceled: canceledSubs, churn: churnCount, expiringSoon, revenueEstimate, planBreakdown, topStores },
        growthSeries,
        from: from.toISOString(),
        to: to.toISOString(),
      });
    } catch (e) {
      logger.error({ err: e }, 'SaaS analytics overview error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// SaaS / Platform marketing pixels (superadmin — yönetilen landing takibi)
// Stored in settings table as key='saas_pixels' (JSONB). Same shape as store pixels but global.
const PLATFORM_PIXEL_PLATFORMS = [
  'google_analytics',
  'google_tag_manager',
  'google_ads',
  'facebook_pixel',
  'tiktok_pixel',
  'custom_head',
  'custom_body',
];

function cleanPlatformPixels(incoming: any): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const platform of PLATFORM_PIXEL_PLATFORMS) {
    const p = incoming[platform];
    if (p && typeof p === 'object') {
      clean[platform] = {
        enabled: !!p.enabled,
        ...(p.measurement_id ? { measurement_id: String(p.measurement_id) } : {}),
        ...(p.container_id ? { container_id: String(p.container_id) } : {}),
        ...(p.pixel_id ? { pixel_id: String(p.pixel_id) } : {}),
        ...(p.conversion_id ? { conversion_id: String(p.conversion_id) } : {}),
        ...(p.conversion_label ? { conversion_label: String(p.conversion_label) } : {}),
        ...(p.merchant_id ? { merchant_id: String(p.merchant_id) } : {}),
        ...(p.business_account_id ? { business_account_id: String(p.business_account_id) } : {}),
        ...(p.domain_verification ? { domain_verification: String(p.domain_verification) } : {}),
        ...(p.code ? { code: String(p.code) } : {}),
      };
    }
  }
  return clean;
}

saasAnalyticsRoutes.get('/pixels', async (_req: Request, res: Response) => {
  try {
    const row = await Setting.findByPk('saas_pixels');
    const pixels = (row?.value as any) || {};
    res.json({ pixels });
  } catch (error) {
    logger.error({ err: error }, 'Get SaaS pixels error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

saasAnalyticsRoutes.put(
  '/pixels',
  [body('pixels').isObject()],
  validate,
  async (req: Request, res: Response) => {
    try {
      const incoming = (req.body as any).pixels || {};
      const clean = cleanPlatformPixels(incoming);
      await Setting.upsert({ key: 'saas_pixels', value: clean } as any);
      logger.info(`SaaS pixels updated by ${(req as any).user?.email}`);
      res.json({ pixels: clean });
    } catch (error) {
      logger.error({ err: error }, 'Update SaaS pixels error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);
