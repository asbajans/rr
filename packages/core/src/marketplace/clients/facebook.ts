import axios from 'axios';
import { BaseMarketplaceClient, MarketplaceClient } from './base.js';
import { config as envConfig } from '../../config/env.js';

export const META_GRAPH_VERSION = (envConfig as any)?.meta?.graphVersion || process.env.META_GRAPH_VERSION || 'v26.0';
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

/**
 * TechProvider tracking helper — builds site URL with utm + fb attribution.
 * Storefront captures these via ?utm_source etc and stores in DropshippingOrder.attribution.
 */
export function buildTrackingUrl(baseUrl: string, source: string, extra: Record<string, string> = {}): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('utm_source', source);
    url.searchParams.set('utm_medium', 'social');
    const campaign = extra.utm_campaign || `${source}_product_${extra.productId || ''}`.replace(/__+/g, '_');
    if (campaign) url.searchParams.set('utm_campaign', campaign.replace(/^_+|_+$/g, ''));
    url.searchParams.set('utm_content', extra.utm_content || source);
    if (extra.fbclid) url.searchParams.set('fbclid', extra.fbclid);
    // rahatio tracking hint
    url.searchParams.set('rh_src', source);
    if (extra.productId) url.searchParams.set('rh_pid', String(extra.productId));
    return url.toString();
  } catch {
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}utm_source=${encodeURIComponent(source)}&utm_medium=social&rh_src=${encodeURIComponent(source)}`;
  }
}

/**
 * Minimal valid scopes for v26.0 — these are the only ones that pass
 * Facebook Login validation without an approved App Review.
 * `ads_management` and `manage_business_extension` are TechProvider-only
 * and must be requested after Business verification + review, otherwise
 * Graph returns "Invalid Scopes" (shown only to app admins).
 * Keep this list in sync with developers.facebook.com → App → Permissions.
 * Env override: META_OAUTH_SCOPES=comma,list
 */
export const META_OAUTH_SCOPES = ((envConfig as any)?.meta?.oauthScopes || process.env.META_OAUTH_SCOPES ||
  [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'pages_manage_metadata',
    'instagram_basic',
    'instagram_content_publish',
    'catalog_management',
    'business_management',
  ].join(',')) as string;

export interface MetaConfig {
  appId: string;
  appSecret?: string;
  redirectUri?: string;
  accessToken?: string;
  userAccessToken?: string;
  tokenExpiry?: number;
  userId?: string;
  pageId?: string;
  pageName?: string;
  pageAccessToken?: string;
  igUserId?: string;
  igUsername?: string;
  catalogId?: string;
  catalogName?: string;
  businessId?: string;
  storefrontBase?: string;
  pixelId?: string;
  pixelName?: string;
  capiAccessToken?: string;
  domainVerificationToken?: string;
  fbeExternalBusinessId?: string;
}

export interface MetaCatalogItem {
  retailer_id: string;
  name: string;
  description?: string;
  availability?: string;
  condition?: string;
  price?: string;
  currency?: string;
  url?: string;
  image_url?: string;
  additional_image_urls?: string[];
  brand?: string;
  quantity?: number;
  inventory?: number;
}

function stripHtml(value: string): string {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function asHttps(url: string): string {
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('//')) return `https:${u}`;
  if (u.startsWith('http://')) return `https://${u.slice(7)}`;
  return u;
}

function graphError(err: any): Error {
  const fb = err?.response?.data?.error;
  if (fb?.message) {
    const e = new Error(fb.message);
    (e as any).status = err.response?.status;
    (e as any).fb = fb;
    return e;
  }
  return err;
}

export class FacebookClient extends BaseMarketplaceClient implements MarketplaceClient {
  protected config: MetaConfig;

  constructor(config: MetaConfig, marketplaceName = 'facebook') {
    super(META_GRAPH_BASE);
    this.marketplaceName = marketplaceName;
    this.config = config;
  }

  protected token(): string {
    return this.config.pageAccessToken || this.config.userAccessToken || this.config.accessToken || '';
  }

  protected userToken(): string {
    return this.config.userAccessToken || this.config.accessToken || this.config.pageAccessToken || '';
  }

  protected async graph<T>(method: string, path: string, opts: { params?: Record<string, any>; data?: any; token?: string } = {}): Promise<T> {
    const token = opts.token || this.token();
    if (!token) throw new Error('Meta access token missing. Reconnect Facebook.');
    try {
      const response = await this.client.request<T>({
        method,
        url: path.startsWith('http') ? path : path,
        params: { ...(opts.params || {}), access_token: token },
        data: opts.data,
      });
      return response.data;
    } catch (err) {
      throw graphError(err);
    }
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.appId,
      redirect_uri: this.config.redirectUri || '',
      state,
      response_type: 'code',
      scope: META_OAUTH_SCOPES,
    });
    return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<{ access_token: string; token_type?: string; expires_in?: number }> {
    const short = await axios.get(`${META_GRAPH_BASE}/oauth/access_token`, {
      params: {
        client_id: this.config.appId,
        client_secret: this.config.appSecret,
        redirect_uri: this.config.redirectUri,
        code,
      },
    });
    const shortToken = short.data.access_token as string;
    const longLived = await this.exchangeLongLived(shortToken);
    this.config.accessToken = longLived.access_token;
    this.config.userAccessToken = longLived.access_token;
    this.config.tokenExpiry = Date.now() + ((longLived.expires_in || 5184000) - 86400) * 1000;
    return longLived;
  }

  async exchangeLongLived(shortToken: string): Promise<{ access_token: string; expires_in?: number }> {
    const res = await axios.get(`${META_GRAPH_BASE}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: this.config.appId,
        client_secret: this.config.appSecret,
        fb_exchange_token: shortToken,
      },
    });
    return res.data;
  }

  async listPages(): Promise<Array<{ id: string; name: string; access_token: string; igUserId?: string }>> {
    const data = await this.graph<any>('GET', '/me/accounts', {
      token: this.userToken(),
      params: { fields: 'id,name,access_token,instagram_business_account', limit: 100 },
    });
    return (data.data || []).map((p: any) => ({
      id: String(p.id),
      name: p.name,
      access_token: p.access_token,
      igUserId: p.instagram_business_account?.id ? String(p.instagram_business_account.id) : undefined,
    }));
  }

  async listCatalogs(): Promise<Array<{ id: string; name: string; product_count?: number; businessId?: string }>> {
    const catalogs: Array<{ id: string; name: string; product_count?: number; businessId?: string }> = [];
    const seen = new Set<string>();
    const push = (rows: any[], businessId?: string) => {
      for (const c of rows || []) {
        const id = String(c.id);
        if (seen.has(id)) continue;
        seen.add(id);
        catalogs.push({ id, name: c.name, product_count: c.product_count, businessId });
      }
    };

    try {
      const owned = await this.graph<any>('GET', '/me/businesses', {
        token: this.userToken(),
        params: { fields: 'id,name,owned_product_catalogs{id,name,product_count}', limit: 50 },
      });
      for (const biz of owned.data || []) {
        push(biz.owned_product_catalogs?.data, String(biz.id));
      }
    } catch {
      // user may not have business_management yet
    }

    try {
      const assigned = await this.graph<any>('GET', '/me/assigned_product_catalogs', {
        token: this.userToken(),
        params: { fields: 'id,name,product_count', limit: 50 },
      });
      push(assigned.data);
    } catch {
      // optional edge
    }

    return catalogs;
  }

  async getInstagramProfile(igUserId: string): Promise<{ id: string; username?: string } | null> {
    try {
      const data = await this.graph<any>('GET', `/${igUserId}`, {
        token: this.userToken(),
        params: { fields: 'id,username' },
      });
      return { id: String(data.id), username: data.username };
    } catch {
      return null;
    }
  }

  async getMe(): Promise<{ id: string; name?: string }> {
    const data = await this.graph<any>('GET', '/me', { token: this.userToken(), params: { fields: 'id,name' } });
    return { id: String(data.id), name: data.name };
  }

  async listBusinesses(): Promise<Array<{ id: string; name: string }>> {
    const data = await this.graph<any>('GET', '/me/businesses', { token: this.userToken(), params: { fields: 'id,name', limit: 50 } });
    return (data.data || []).map((b: any) => ({ id: String(b.id), name: b.name }));
  }

  async listPixels(businessId?: string): Promise<Array<{ id: string; name: string }>> {
    try {
      if (businessId) {
        const data = await this.graph<any>('GET', `/${businessId}/adspixels`, { token: this.userToken(), params: { fields: 'id,name', limit: 50 } });
        return (data.data || []).map((p: any) => ({ id: String(p.id), name: p.name }));
      }
    } catch {}
    try {
      const data = await this.graph<any>('GET', '/me/adaccounts', { token: this.userToken(), params: { fields: 'id,name', limit: 10 } });
      // fallback: pixels via adaccounts not directly needed
      return [];
    } catch { return []; }
  }

  async getPixel(pixelId: string): Promise<any> {
    return this.graph<any>('GET', `/${pixelId}`, { token: this.userToken(), params: { fields: 'id,name,last_fired_time,is_created_via_business_manager' } });
  }

  async getInstagramShoppingStatus(igUserId: string): Promise<{ eligible: boolean | null; raw: any; error?: string }> {
    try {
      const data = await this.graph<any>('GET', `/${igUserId}`, {
        token: this.userToken(),
        params: { fields: 'id,username,shopping_review_status,shopping_product_tag_eligibility' },
      });
      const eligible = (data.shopping_review_status === 'approved' || data.shopping_review_status === 'APPROVED')
        ? true
        : data.shopping_review_status
          ? false
          : (Array.isArray(data.shopping_product_tag_eligibility) ? data.shopping_product_tag_eligibility.length > 0 : null);
      return { eligible, raw: data };
    } catch (e: any) {
      return { eligible: null, raw: null, error: e.message };
    }
  }

  async createCatalog(businessId: string, name: string): Promise<{ id: string; name: string }> {
    const data = await this.graph<any>('POST', `/${businessId}/owned_product_catalogs`, { token: this.userToken(), data: { name } });
    return { id: String(data.id), name: name };
  }

  async createPixel(businessId: string, name: string): Promise<{ id: string; name: string }> {
    const data = await this.graph<any>('POST', `/${businessId}/adspixels`, { token: this.userToken(), data: { name } });
    return { id: String(data.id || data.pixel_id || data.id), name: name };
  }

  async ensureCatalog(businessId: string, storeName: string): Promise<{ id: string; name: string; existed: boolean }> {
    const catalogs = await this.listCatalogs();
    const existing = catalogs.find((c) => c.businessId === businessId);
    if (existing) return { ...existing, existed: true };
    if (catalogs.length) return { ...catalogs[0], existed: true };
    const created = await this.createCatalog(businessId, `Rahatio - ${storeName}`.slice(0, 80));
    return { ...created, existed: false };
  }

  async ensurePixel(businessId: string, storeName: string): Promise<{ id: string; name: string; existed: boolean }> {
    const pixels = await this.listPixels(businessId);
    if (pixels.length) return { ...pixels[0], existed: true };
    try {
      const created = await this.createPixel(businessId, `Rahatio Pixel - ${storeName}`.slice(0, 80));
      return { ...created, existed: false };
    } catch {
      return { id: '', name: '', existed: false };
    }
  }

  async getDomainVerification(businessId: string, domain: string): Promise<string | null> {
    try {
      const data = await this.graph<any>('GET', `/${businessId}/domains`, { token: this.userToken(), params: { limit: 50 } });
      const hit = (data.data || []).find((d: any) => String(d.name || d.domain_name || '').toLowerCase() === domain.toLowerCase());
      return hit?.verification_code || hit?.verification_token || null;
    } catch { return null; }
  }

  async claimDomain(businessId: string, domain: string): Promise<string | null> {
    try {
      const data = await this.graph<any>('POST', `/${businessId}/domains`, { token: this.userToken(), data: { domain_name: domain } });
      return data.verification_code || data.verification_token || null;
    } catch { return null; }
  }

  private catalogId(): string {
    if (!this.config.catalogId) throw new Error('Meta catalog not selected');
    return this.config.catalogId;
  }

  private toItemPayload(product: any): Record<string, any> {
    const mapped = product.retailer_id ? product : product;
    const retailerId = String(mapped.retailer_id || mapped.sku || '');
    const images = Array.isArray(mapped.additional_image_urls) ? mapped.additional_image_urls : [];
    // v26.0: price must be integer (cents), currency separate. Example 999.00 TRY -> price=99900, currency=TRY
    const rawPrice = mapped.price != null ? String(mapped.price).replace(/[^0-9.]/g, '') : '';
    const numericPrice = rawPrice ? parseFloat(rawPrice) : (mapped.price != null ? Number(mapped.price) : 0);
    const priceCents = Number.isFinite(numericPrice) ? Math.round(numericPrice * 100) : 0;
    const currency = String(mapped.currency || 'TRY').toUpperCase();
    const payload: Record<string, any> = {
      retailer_id: retailerId,
      name: mapped.name || mapped.title,
      description: stripHtml(mapped.description || mapped.name || ''),
      availability: mapped.availability || ((mapped.quantity ?? mapped.inventory ?? 0) > 0 ? 'in stock' : 'out of stock'),
      condition: mapped.condition || 'new',
      price: priceCents,
      currency,
      url: asHttps(mapped.url || ''),
      image_url: asHttps(mapped.image_url || ''),
      brand: mapped.brand || undefined,
    };
    if (images.length) payload.additional_image_urls = images.map(asHttps).filter(Boolean);
    if (mapped.inventory != null || mapped.quantity != null) {
      payload.inventory = Number(mapped.inventory ?? mapped.quantity ?? 0);
    }
    // Shopify parity: variant grouping
    if (mapped.item_group_id) payload.item_group_id = String(mapped.item_group_id);
    else if (mapped.variant_group_id) payload.item_group_id = String(mapped.variant_group_id);
    return payload;
  }

  async batchUpsertProducts(products: any[]): Promise<any> {
    if (!products.length) return { success: true };
    const requests = products.map((p) => {
      const payload = this.toItemPayload(p);
      return { method: 'UPDATE', retailer_id: payload.retailer_id, data: payload };
    });
    // Graph allows up to 1000 in one items_batch, we chunk 100
    const chunks: any[][] = [];
    for (let i = 0; i < requests.length; i += 100) chunks.push(requests.slice(i, i + 100));
    let last: any = null;
    for (const chunk of chunks) {
      last = await this.graph<any>('POST', `/${this.catalogId()}/items_batch`, {
        token: this.userToken(),
        data: { item_type: 'PRODUCT_ITEM', allow_upsert: true, requests: JSON.stringify(chunk) },
      });
    }
    return last;
  }

  async getCategories(): Promise<any[]> {
    return [];
  }

  async getBrands(): Promise<{ id: number | string; name: string }[]> {
    const products = await this.getProducts({ page: 0, size: 200 });
    const names = new Set<string>();
    for (const p of products.products) {
      const brand = p.brand || p.brand_name;
      if (brand) names.add(String(brand));
    }
    return [...names].map((name) => ({ id: name, name }));
  }

  async getProducts(params: any = {}): Promise<{ products: any[]; hasMore: boolean }> {
    const size = params.size ?? params.limit ?? 50;
    const after = params.after;
    const data = await this.graph<any>('GET', `/${this.catalogId()}/products`, {
      token: this.userToken(),
      params: {
        fields: 'id,retailer_id,name,description,brand,price,availability,image_url,url,inventory',
        limit: size,
        ...(after ? { after } : {}),
      },
    });
    const products = data.data || [];
    return { products, hasMore: Boolean(data.paging?.next || data.paging?.cursors?.after) };
  }

  async createProduct(product: any): Promise<any> {
    const payload = this.toItemPayload(product);
    if (!payload.image_url) {
      throw new Error('Meta katalog için herkese açık HTTPS görsel URL gerekir');
    }
    if (!payload.url) {
      throw new Error('Meta katalog için ürün sayfası URL gerekir');
    }
    try {
      return await this.graph<any>('POST', `/${this.catalogId()}/products`, {
        token: this.userToken(),
        data: payload,
      });
    } catch (err: any) {
      // Already exists → update by retailer_id
      if (String(err.message || '').toLowerCase().includes('already') || err.fb?.code === 10800) {
        await this.updateProduct(payload.retailer_id, payload);
        return { id: payload.retailer_id, retailer_id: payload.retailer_id };
      }
      throw err;
    }
  }

  async updateProduct(productId: string, product: any): Promise<any> {
    const payload = this.toItemPayload({ ...product, retailer_id: product.retailer_id || productId });
    return this.graph<any>('POST', `/${this.catalogId()}/items_batch`, {
      token: this.userToken(),
      data: {
        item_type: 'PRODUCT_ITEM',
        allow_upsert: true,
        requests: JSON.stringify([
          { method: 'UPDATE', retailer_id: payload.retailer_id, data: payload },
        ]),
      },
    });
  }

  async updatePrice(productId: string, price: number): Promise<any> {
    const cents = Math.round(Number(price) * 100);
    return this.updateProduct(productId, { retailer_id: productId, price: cents, currency: 'TRY' });
  }

  async updateStock(productId: string, quantity: number): Promise<any> {
    return this.updateProduct(productId, {
      retailer_id: productId,
      inventory: quantity,
      availability: quantity > 0 ? 'in stock' : 'out of stock',
    });
  }

  async getOrders(_params: any = {}): Promise<any[]> {
    return [];
  }

  async getOrder(_orderId: string): Promise<any> {
    return null;
  }

  async publishPagePost(opts: { imageUrl: string; caption: string }): Promise<any> {
    if (!this.config.pageId) throw new Error('Facebook sayfası seçilmedi');
    const imageUrl = asHttps(opts.imageUrl);
    if (imageUrl) {
      return this.graph<any>('POST', `/${this.config.pageId}/photos`, {
        token: this.config.pageAccessToken,
        data: { url: imageUrl, caption: opts.caption, published: true },
      });
    }
    return this.graph<any>('POST', `/${this.config.pageId}/feed`, {
      token: this.config.pageAccessToken,
      data: { message: opts.caption },
    });
  }

  async publishPageStory(opts: { imageUrl: string }): Promise<any> {
    if (!this.config.pageId) throw new Error('Facebook sayfası seçilmedi');
    const photo = await this.graph<any>('POST', `/${this.config.pageId}/photos`, {
      token: this.config.pageAccessToken,
      data: { url: asHttps(opts.imageUrl), published: false },
    });
    return this.graph<any>('POST', `/${this.config.pageId}/photo_stories`, {
      token: this.config.pageAccessToken,
      data: { photo_id: photo.id },
    });
  }

  async publishIgMedia(opts: { imageUrl: string; caption?: string; stories?: boolean }): Promise<any> {
    if (!this.config.igUserId) throw new Error('Instagram işletme hesabı seçilmedi');
    const create = await this.graph<any>('POST', `/${this.config.igUserId}/media`, {
      token: this.config.pageAccessToken || this.userToken(),
      data: {
        image_url: asHttps(opts.imageUrl),
        caption: opts.caption || '',
        ...(opts.stories ? { media_type: 'STORIES' } : {}),
      },
    });
    const creationId = create.id;
    for (let i = 0; i < 12; i++) {
      const status = await this.graph<any>('GET', `/${creationId}`, {
        token: this.config.pageAccessToken || this.userToken(),
        params: { fields: 'status_code,status' },
      });
      if (status.status_code === 'FINISHED' || status.status_code === 'PUBLISHED') break;
      if (status.status_code === 'ERROR') throw new Error(status.status || 'Instagram media container failed');
      await new Promise((r) => setTimeout(r, 2000));
    }
    return this.graph<any>('POST', `/${this.config.igUserId}/media_publish`, {
      token: this.config.pageAccessToken || this.userToken(),
      data: { creation_id: creationId },
    });
  }
}

export class InstagramClient extends FacebookClient {
  constructor(config: MetaConfig) {
    super(config, 'instagram');
  }
}
