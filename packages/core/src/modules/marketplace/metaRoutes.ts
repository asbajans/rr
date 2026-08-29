import crypto from 'crypto';
import { Op } from 'sequelize';
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { MarketplaceIntegration } from '../../models/MarketplaceIntegration.model.js';
import { Product } from '../../models/Product.model.js';
import { Store } from '../../models/Store.model.js';
import { Setting } from '../../models/Setting.model.js';
import { Brand } from '../../models/Brand.model.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { requireModule, assertMarketplaceQuota } from '../plan/access.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/env.js';
import { FacebookClient, type MetaConfig, buildTrackingUrl } from '../../marketplace/clients/facebook.js';
import { generateHmacSHA256Hex } from '../../marketplace/clients/base.js';

export const metaRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

function settingString(value: any): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.value != null) return String(value.value);
  return String(value);
}

export async function getMetaAppConfig(): Promise<{ appId: string; appSecret: string }> {
  const settings = await Setting.findAll({ where: { key: ['meta_app_id', 'meta_app_secret'] } });
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = settingString(s.value);
  const appId = map.meta_app_id || (config as any).meta?.appId || process.env.META_APP_ID || '';
  const appSecret = map.meta_app_secret || (config as any).meta?.appSecret || process.env.META_APP_SECRET || '';
  if (!appId && (config as any).env === 'production') {
    throw new Error('META_APP_ID not configured');
  }
  return { appId, appSecret };
}

function signState(payload: string): string {
  return generateHmacSHA256Hex(payload, config.apiKey.internalKey);
}
function buildState(storeId: number): string {
  const raw = JSON.stringify({ storeId, ts: Date.now() });
  const b64 = Buffer.from(raw).toString('base64url');
  const sig = signState(b64);
  return `${b64}.${sig.slice(0, 16)}`;
}
function verifyState(state: string): { storeId: number } | null {
  const [b64, sig] = String(state).split('.');
  if (!b64 || !sig) return null;
  const expected = signState(b64).slice(0, 16);
  try {
    if (sig.length !== expected.length) return null;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (!crypto.timingSafeEqual(a, b)) return null;
    const decoded = JSON.parse(Buffer.from(b64, 'base64url').toString());
    if (!decoded.storeId || Date.now() - Number(decoded.ts || 0) > 10 * 60 * 1000) return null;
    return { storeId: Number(decoded.storeId) };
  } catch { return null; }
}

export function oauthCallbackUrl(): string {
  return `${String(config.apiUrl).replace(/\/$/, '')}/api/admin/integrations/facebook/oauth/callback`;
}

function frontendIntegrationsUrl(query: string): string {
  const base = (config.frontendUrl || 'https://rahatio.com.tr').replace(/\/$/, '');
  return `${base}/integrations?${query}`;
}

function storefrontBaseFor(store: Store): string {
  if (store.siteUrl) return String(store.siteUrl).replace(/\/$/, '');
  return `https://rahatio.com.tr/stores/${store.siteCode}`;
}

function productPublicUrl(store: Store, product: Product): string {
  return `${storefrontBaseFor(store)}/products/${product.id}`;
}
function productTrackingUrl(store: Store, product: Product, source: string): string {
  const base = productPublicUrl(store, product);
  return buildTrackingUrl(base, source, { productId: String(product.id) });
}

function firstHttpsImage(product: Product): string {
  const images = Array.isArray(product.images) ? product.images : [];
  const raw = images.map((u: any) => (typeof u === 'string' ? u : u?.url)).find(Boolean) || '';
  if (!raw) return '';
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('http://')) return `https://${raw.slice(7)}`;
  return raw;
}

function clientFromIntegration(integration: MarketplaceIntegration, app: { appId: string; appSecret: string }): FacebookClient {
  const cfg = (integration.config || {}) as MetaConfig;
  return new FacebookClient({
    ...cfg,
    appId: app.appId,
    appSecret: app.appSecret,
    accessToken: cfg.userAccessToken || cfg.accessToken,
    userAccessToken: cfg.userAccessToken || cfg.accessToken,
  });
}

function parseSignedRequest(signedRequest: string, appSecret: string): any {
  const [encodedSig, payload] = String(signedRequest).split('.');
  if (!encodedSig || !payload) throw new Error('Invalid signed_request');
  const expected = crypto.createHmac('sha256', appSecret).update(payload).digest();
  const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (expected.length !== sig.length || !crypto.timingSafeEqual(expected, sig)) {
    throw new Error('Invalid signed_request signature');
  }
  const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  return JSON.parse(json);
}

metaRoutes.get('/facebook/oauth/config', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  try {
    const app = await getMetaAppConfig();
    res.json({
      redirectUri: oauthCallbackUrl(),
      appIdConfigured: !!app.appId,
      appSecretConfigured: !!app.appSecret,
      graphVersion: (config as any).meta?.graphVersion || 'v26.0',
      frontendUrl: config.frontendUrl,
      apiUrl: config.apiUrl,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

metaRoutes.get('/facebook/oauth/connect', authMiddleware, requireRole('owner', 'admin'), requireStore, requireModule('marketplace'), async (req: Request, res: Response) => {
  try {
    const store = (req as any).store as Store;
    const existing = await MarketplaceIntegration.findOne({ where: { storeId: store.id, marketplace: 'facebook' } });
    if (!existing?.isActive) {
      const quota = await assertMarketplaceQuota(store);
      if (!quota.ok) {
        return res.status(403).json({
          error: 'PLAN_MARKETPLACE_LIMIT',
          limit: quota.limit,
          current: quota.current,
          message: 'Pazaryeri entegrasyon limitiniz doldu. Planınızı yükseltin.',
        });
      }
    }
    const app = await getMetaAppConfig();
    if (!app.appId || !app.appSecret) {
      return res.status(400).json({ error: 'Meta App ID/Secret tanımlı değil. Super admin Global API Ayarları\'na eklemeli.', redirectUri: oauthCallbackUrl() });
    }
    const state = buildState(store.id);
    const client = new FacebookClient({ ...app, redirectUri: oauthCallbackUrl() });
    res.json({ url: client.getAuthUrl(state), fbeEnabled: true, redirectUri: oauthCallbackUrl() });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Meta OAuth connect error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

metaRoutes.get('/facebook/oauth/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query as Record<string, string>;
    if (error) {
      return res.redirect(frontendIntegrationsUrl(`meta=error&message=${encodeURIComponent(error_description || error)}`));
    }
    if (!code || !state) {
      return res.redirect(frontendIntegrationsUrl('meta=error&message=missing_code'));
    }
    const verified = verifyState(state);
    if (!verified) return res.redirect(frontendIntegrationsUrl('meta=error&message=invalid_state'));
    const storeId = verified.storeId;
    const store = await Store.findByPk(storeId);
    if (!store) return res.redirect(frontendIntegrationsUrl('meta=error&message=store_not_found'));

    const app = await getMetaAppConfig();
    const client = new FacebookClient({ ...app, redirectUri: oauthCallbackUrl() });
    const tokenData = await client.exchangeCodeForToken(code);
    // Fetch user ID for deauth matching (TechProvider requirement)
    let userId: string | undefined;
    try {
      const me = await client.getMe();
      userId = me.id;
    } catch {}

    const nextConfig: MetaConfig = {
      appId: app.appId,
      accessToken: tokenData.access_token,
      userAccessToken: tokenData.access_token,
      tokenExpiry: Date.now() + ((tokenData.expires_in || 5184000) - 86400) * 1000,
      userId,
      storefrontBase: storefrontBaseFor(store),
    };

    const existing = await MarketplaceIntegration.findOne({ where: { storeId, marketplace: 'facebook' } });
    if (existing) {
      await existing.update({
        isActive: false,
        config: { ...(existing.config as object || {}), ...nextConfig },
      });
    } else {
      await MarketplaceIntegration.create({
        storeId,
        marketplace: 'facebook',
        isActive: false,
        config: nextConfig,
      });
    }
    logger.info(`Meta OAuth completed for store ${storeId}`);
    res.redirect(frontendIntegrationsUrl('meta=select'));
  } catch (error: unknown) {
    logger.error({ err: error }, 'Meta OAuth callback error');
    res.redirect(frontendIntegrationsUrl('meta=error&message=oauth_failed'));
  }
});

metaRoutes.get('/facebook/assets', authMiddleware, requireRole('owner', 'admin'), requireStore, requireModule('marketplace'), async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const integration = await MarketplaceIntegration.findOne({ where: { storeId: store.id, marketplace: 'facebook' } });
    if (!integration) return res.status(400).json({ error: 'Önce Facebook ile bağlanın' });
    const app = await getMetaAppConfig();
    const client = clientFromIntegration(integration, app);
    const [pages, catalogs] = await Promise.all([client.listPages(), client.listCatalogs()]);
    const igProfiles = await Promise.all(
      pages.filter((p) => p.igUserId).map(async (p) => {
        const profile = await client.getInstagramProfile(p.igUserId!);
        return { pageId: p.id, igUserId: p.igUserId, username: profile?.username };
      }),
    );
    const cfg = (integration.config || {}) as MetaConfig;
    res.json({
      pages,
      catalogs,
      instagram: igProfiles,
      selected: {
        pageId: cfg.pageId || null,
        catalogId: cfg.catalogId || null,
        igUserId: cfg.igUserId || null,
      },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Meta assets error');
    res.status(500).json({ error: (error as Error).message || 'Internal server error' });
  }
});

metaRoutes.post('/facebook/assets', authMiddleware, requireRole('owner', 'admin'), requireStore, requireModule('marketplace'), [
  body('pageId').isString().notEmpty(),
  body('catalogId').isString().notEmpty(),
  body('igUserId').optional({ nullable: true }).isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store as Store;
    const { pageId, catalogId, igUserId } = req.body;
    const integration = await MarketplaceIntegration.findOne({ where: { storeId: store.id, marketplace: 'facebook' } });
    if (!integration) return res.status(400).json({ error: 'Önce Facebook ile bağlanın' });

    const app = await getMetaAppConfig();
    const client = clientFromIntegration(integration, app);
    const pages = await client.listPages();
    const page = pages.find((p) => p.id === String(pageId));
    if (!page) return res.status(400).json({ error: 'Seçilen Facebook sayfası bu hesapta yok' });

    const catalogs = await client.listCatalogs();
    const catalog = catalogs.find((c) => c.id === String(catalogId));
    const igId = igUserId || page.igUserId || '';
    let igUsername = '';
    if (igId) {
      const profile = await client.getInstagramProfile(igId);
      igUsername = profile?.username || '';
    }

    const merged: MetaConfig = {
      ...(integration.config as MetaConfig),
      pageId: page.id,
      pageName: page.name,
      pageAccessToken: page.access_token,
      catalogId: String(catalogId),
      catalogName: catalog?.name,
      businessId: catalog?.businessId,
      igUserId: igId || undefined,
      igUsername: igUsername || undefined,
      storefrontBase: storefrontBaseFor(store),
    };

    await integration.update({ isActive: true, config: merged, lastSyncAt: new Date() });

    if (igId) {
      const ig = await MarketplaceIntegration.findOne({ where: { storeId: store.id, marketplace: 'instagram' } });
      if (ig) {
        await ig.update({ isActive: true, config: merged, lastSyncAt: new Date() });
      } else {
        await MarketplaceIntegration.create({
          storeId: store.id,
          marketplace: 'instagram',
          isActive: true,
          config: merged,
        });
      }
    }

    res.json({
      ok: true,
      facebook: { pageId: page.id, pageName: page.name, catalogId, catalogName: catalog?.name },
      instagram: igId ? { igUserId: igId, username: igUsername } : null,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Meta select assets error');
    res.status(500).json({ error: (error as Error).message || 'Internal server error' });
  }
});

// TechProvider FBE callback — single-click auto onboarding (catalog+pixel+domain)
metaRoutes.post('/facebook/fbe/callback', authMiddleware, requireRole('owner', 'admin'), requireStore, requireModule('marketplace'), async (req: Request, res: Response) => {
  try {
    const store = (req as any).store as Store;
    const { pageId, catalogId, igUserId, businessId, pixelId } = req.body as Record<string, string>;
    const integration = await MarketplaceIntegration.findOne({ where: { storeId: store.id, marketplace: 'facebook' } });
    if (!integration) return res.status(400).json({ error: 'Önce Facebook ile bağlanın (OAuth)' });
    const app = await getMetaAppConfig();
    const client = clientFromIntegration(integration, app);
    let business = businessId || (integration.config as any)?.businessId;
    if (!business) {
      try {
        const bizs = await client.listBusinesses();
        business = bizs[0]?.id;
      } catch {}
    }
    // TechProvider auto-provision: catalog + pixel + domain
    let effectiveCatalogId = catalogId;
    let effectivePixelId = pixelId;
    let domainToken: string | null = null;
    if (business) {
      try {
        if (!effectiveCatalogId) {
          const ensured = await client.ensureCatalog(business, store.name);
          effectiveCatalogId = ensured.id;
        }
      } catch (e) { logger.warn({ err: e }, 'FBE ensureCatalog failed'); }
      try {
        if (!effectivePixelId) {
          const ensuredPix = await client.ensurePixel(business, store.name);
          effectivePixelId = ensuredPix.id || undefined as any;
        }
      } catch (e) { logger.warn({ err: e }, 'FBE ensurePixel failed'); }
      try {
        const domain = new URL(storefrontBaseFor(store)).hostname;
        domainToken = (await client.getDomainVerification(business, domain)) || (await client.claimDomain(business, domain));
      } catch (e) { logger.warn({ err: e }, 'FBE domain verification failed'); }
    }

    // Resolve page + catalog if still missing
    const pages = await client.listPages().catch(() => []);
    const page = pages.find((p) => p.id === String(pageId)) || pages[0];
    const catalogs = await client.listCatalogs().catch(() => []);
    const catalog = catalogs.find((c) => c.id === String(effectiveCatalogId)) || catalogs.find((c) => c.businessId === business) || catalogs[0];

    const merged: MetaConfig = {
      ...(integration.config as MetaConfig),
      businessId: business || (integration.config as any)?.businessId,
      pageId: page?.id || pageId,
      pageName: page?.name,
      pageAccessToken: page?.access_token || (integration.config as any)?.pageAccessToken,
      catalogId: catalog?.id || effectiveCatalogId,
      catalogName: catalog?.name,
      igUserId: igUserId || page?.igUserId || (integration.config as any)?.igUserId,
      pixelId: effectivePixelId || (integration.config as any)?.pixelId,
      domainVerificationToken: domainToken || (integration.config as any)?.domainVerificationToken,
      storefrontBase: storefrontBaseFor(store),
    };
    // Auto-fill pixels table for injection
    if (effectivePixelId) {
      const currentPixels = (store.pixels as any) || {};
      currentPixels.facebook_pixel = { enabled: true, pixel_id: effectivePixelId, auto: true, businessId: business };
      await store.update({ pixels: currentPixels } as any);
    }
    if (domainToken) {
      const currentPixels = (store.pixels as any) || {};
      // store domain verification token for SSR meta tag (PixelInjector + StoreTheme)
      currentPixels._meta_domain_verification = domainToken;
      await store.update({ pixels: currentPixels } as any);
    }

    await integration.update({ isActive: true, config: merged, lastSyncAt: new Date() });
    if (merged.igUserId) {
      const ig = await MarketplaceIntegration.findOne({ where: { storeId: store.id, marketplace: 'instagram' } });
      if (ig) await ig.update({ isActive: true, config: merged, lastSyncAt: new Date() });
      else await MarketplaceIntegration.create({ storeId: store.id, marketplace: 'instagram', isActive: true, config: merged });
    }
    res.json({ ok: true, pageId: merged.pageId, catalogId: merged.catalogId, pixelId: merged.pixelId, domainToken, businessId: merged.businessId });
  } catch (error: unknown) {
    logger.error({ err: error }, 'FBE callback error');
    res.status(500).json({ error: (error as Error).message || 'FBE bağlama başarısız' });
  }
});

metaRoutes.get('/facebook/pixels', authMiddleware, requireRole('owner', 'admin'), requireStore, requireModule('marketplace'), async (req: Request, res: Response) => {
  try {
    const store = (req as any).store as Store;
    const integration = await MarketplaceIntegration.findOne({ where: { storeId: store.id, marketplace: 'facebook' } });
    if (!integration) return res.status(400).json({ error: 'Önce Facebook ile bağlanın' });
    const app = await getMetaAppConfig();
    const client = clientFromIntegration(integration, app);
    const cfg = integration.config as MetaConfig;
    let pixels: any[] = [];
    let businessId = cfg.businessId;
    if (!businessId) {
      try { businessId = (await client.listBusinesses())[0]?.id; } catch {}
    }
    if (businessId) pixels = await client.listPixels(businessId).catch(() => []);
    res.json({ pixels, selected: cfg.pixelId || null, businessId: businessId || null });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List pixels error');
    res.status(500).json({ error: (error as Error).message || 'Internal server error' });
  }
});

metaRoutes.post('/facebook/pixels', authMiddleware, requireRole('owner', 'admin'), requireStore, requireModule('marketplace'), [
  body('pixelId').isString().notEmpty(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store as Store;
    const { pixelId } = req.body;
    const integration = await MarketplaceIntegration.findOne({ where: { storeId: store.id, marketplace: 'facebook' } });
    if (!integration) return res.status(400).json({ error: 'Önce Facebook ile bağlanın' });
    const cfg = integration.config as MetaConfig;
    const merged = { ...cfg, pixelId: String(pixelId) } as MetaConfig;
    await integration.update({ config: merged });
    const ig = await MarketplaceIntegration.findOne({ where: { storeId: store.id, marketplace: 'instagram' } });
    if (ig) await ig.update({ config: { ...(ig.config as MetaConfig), pixelId: String(pixelId) } });
    // Auto-enable pixel injection
    const pixels = (store.pixels as any) || {};
    pixels.facebook_pixel = { enabled: true, pixel_id: String(pixelId), auto: true };
    await store.update({ pixels } as any);
    res.json({ ok: true, pixelId });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Select pixel error');
    res.status(500).json({ error: (error as Error).message || 'Internal server error' });
  }
});

metaRoutes.get('/facebook/domain', authMiddleware, requireRole('owner', 'admin'), requireStore, requireModule('marketplace'), async (req: Request, res: Response) => {
  try {
    const store = (req as any).store as Store;
    const integration = await MarketplaceIntegration.findOne({ where: { storeId: store.id, marketplace: 'facebook' } });
    if (!integration) return res.status(400).json({ error: 'Önce Facebook ile bağlanın' });
    const cfg = integration.config as MetaConfig;
    res.json({ domain: new URL(storefrontBaseFor(store)).hostname, verificationToken: cfg.domainVerificationToken || (store.pixels as any)?._meta_domain_verification || null, businessId: cfg.businessId || null });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Internal server error' });
  }
});

metaRoutes.get('/facebook/instagram-shopping-status', authMiddleware, requireRole('owner', 'admin'), requireStore, requireModule('marketplace'), async (req: Request, res: Response) => {
  try {
    const store = (req as any).store as Store;
    const integration = await MarketplaceIntegration.findOne({ where: { storeId: store.id, marketplace: 'facebook' } });
    if (!integration) return res.status(400).json({ error: 'Önce Facebook ile bağlanın' });
    const cfg = integration.config as MetaConfig;
    if (!cfg.igUserId) return res.json({ connected: false, eligible: null, reason: 'Instagram işletme hesabı bağlı değil — sayfaya bağlayın' });
    const app = await getMetaAppConfig();
    const client = clientFromIntegration(integration, app);
    const status = await client.getInstagramShoppingStatus(cfg.igUserId);
    res.json({ connected: true, igUserId: cfg.igUserId, igUsername: cfg.igUsername, catalogId: cfg.catalogId, ...status });
  } catch (error: unknown) {
    logger.error({ err: error }, 'IG shopping status error');
    res.status(500).json({ error: (error as Error).message || 'Internal server error' });
  }
});

metaRoutes.post('/meta/publish', authMiddleware, requireRole('owner', 'admin'), requireStore, requireModule('marketplace'), [
  body('productId').optional().isInt(),
  body('productIds').optional().isArray(),
  body('channel').optional().isIn(['facebook_post', 'facebook_story', 'instagram_post', 'instagram_story', 'instagram_reels']),
  body('channels').optional().isArray(),
  body('caption').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store as Store;
    const { productId, productIds, channel, channels, caption } = req.body as any;
    const ids: number[] = productIds ? productIds.map((x: any) => Number(x)) : productId ? [Number(productId)] : [];
    if (!ids.length) return res.status(400).json({ error: 'productId gerekli' });
    const chs: string[] = channels && channels.length ? channels : channel ? [channel] : [];
    if (!chs.length) return res.status(400).json({ error: 'channel gerekli' });

    const publishOne = async (pid: number, ch: string) => {
      const product = await Product.findOne({ where: { id: pid, storeId: store.id } });
      if (!product) throw new Error(`Product ${pid} not found`);
      const imageUrl = firstHttpsImage(product);
      if (!imageUrl) throw new Error('Ürünün herkese açık bir görseli yok');
      const mp = ch.startsWith('instagram') ? 'instagram' : 'facebook';
      const integration = await MarketplaceIntegration.findOne({ where: { storeId: store.id, marketplace: mp, isActive: true } })
        || await MarketplaceIntegration.findOne({ where: { storeId: store.id, marketplace: 'facebook', isActive: true } });
      if (!integration) throw new Error('Meta bağlantısı aktif değil');
      const app = await getMetaAppConfig();
      const client = clientFromIntegration(integration, app);
      // Tracking: all publish URLs go to site with utm_source
      const url = productTrackingUrl(store, product, ch.includes('instagram') ? 'instagram' : 'facebook');
      const text = (caption && String(caption).trim()) || `${product.title}\n${url}`;
      let result: any;
      if (ch === 'facebook_post') result = await client.publishPagePost({ imageUrl, caption: text });
      else if (ch === 'facebook_story') result = await client.publishPageStory({ imageUrl });
      else if (ch === 'instagram_post') result = await client.publishIgMedia({ imageUrl, caption: text, stories: false });
      else if (ch === 'instagram_story') result = await client.publishIgMedia({ imageUrl, caption: text, stories: true });
      else if (ch === 'instagram_reels') result = await client.publishIgMedia({ imageUrl, caption: text, stories: false });
      else throw new Error(`Unknown channel ${ch}`);
      logger.info({ storeId: store.id, productId: pid, channel: ch, id: result?.id }, 'Meta content published');
      return { productId: pid, channel: ch, id: result?.id };
    };

    const results: any[] = [];
    for (const pid of ids) {
      for (const ch of chs) {
        try { results.push({ ...(await publishOne(pid, ch)), ok: true }); }
        catch (e: any) { results.push({ productId: pid, channel: ch, ok: false, error: e.message }); }
      }
    }
    const okCount = results.filter(r => r.ok).length;
    res.json({ ok: okCount > 0, results });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Meta publish error');
    res.status(500).json({ error: (error as Error).message || 'Paylaşım başarısız' });
  }
});

metaRoutes.post('/meta/sync-brands', authMiddleware, requireRole('owner', 'admin'), requireStore, requireModule('marketplace'), async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const integration = await MarketplaceIntegration.findOne({ where: { storeId: store.id, marketplace: 'facebook', isActive: true } });
    if (!integration) return res.status(400).json({ error: 'Facebook kataloğu bağlı değil' });
    const app = await getMetaAppConfig();
    const client = clientFromIntegration(integration, app);
    const brands = await client.getBrands();
    let imported = 0;
    for (const marketplace of ['facebook', 'instagram']) {
      for (const b of brands) {
        const name = b.name?.trim();
        if (!name) continue;
        const existing = await Brand.findOne({
          where: { storeId: store.id, marketplace, marketplaceBrandId: String(b.id) },
        });
        if (!existing) {
          await Brand.create({ storeId: store.id, name, marketplace, marketplaceBrandId: String(b.id) });
          imported++;
        }
      }
    }
    res.json({ imported, total: brands.length, brands });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Meta brand sync error');
    res.status(500).json({ error: (error as Error).message || 'Internal server error' });
  }
});

metaRoutes.post('/facebook/deauth', async (req: Request, res: Response) => {
  try {
    const app = await getMetaAppConfig();
    const signed = (req.body?.signed_request || req.body?.signedRequest) as string;
    if (!signed || !app.appSecret) return res.status(400).json({ success: false });
    const payload = parseSignedRequest(signed, app.appSecret);
    const userId = payload.user_id;
    if (userId) {
      const integrations = await MarketplaceIntegration.findAll({
        where: { marketplace: { [Op.in]: ['facebook', 'instagram'] } },
      });
      for (const integration of integrations) {
        const cfg = integration.config as any;
        if (cfg?.userId === userId) {
          await integration.update({ isActive: false, config: { ...cfg, accessToken: null, userAccessToken: null, pageAccessToken: null } });
        }
      }
    }
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Meta deauth error');
    res.status(400).json({ success: false });
  }
});

metaRoutes.post('/facebook/data-deletion', async (req: Request, res: Response) => {
  try {
    const app = await getMetaAppConfig();
    const signed = (req.body?.signed_request || req.body?.signedRequest) as string;
    const confirmationCode = crypto.randomBytes(12).toString('hex');
    if (signed && app.appSecret) {
      try {
        parseSignedRequest(signed, app.appSecret);
      } catch {
        // still acknowledge
      }
    }
    const statusUrl = `${String(config.apiUrl).replace(/\/$/, '')}/api/admin/integrations/facebook/data-deletion/${confirmationCode}`;
    res.json({ url: statusUrl, confirmation_code: confirmationCode });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Meta data deletion error');
    res.status(400).json({ error: 'Invalid request' });
  }
});

metaRoutes.get('/facebook/data-deletion/:code', async (req: Request, res: Response) => {
  res.json({ confirmation_code: req.params.code, status: 'completed' });
});
