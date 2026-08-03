import axios, { AxiosInstance } from 'axios';
import { BaseMarketplaceClient, MarketplaceClient } from './base.js';
import { logger } from '../../utils/logger.js';

export interface PazaramaConfig {
  clientId: string;
  clientSecret: string;
  apiKey: string;
}

export class PazaramaClient extends BaseMarketplaceClient implements MarketplaceClient {
  private config: PazaramaConfig;
  private authClient: AxiosInstance;
  private bearerToken: string | null = null;
  private tokenExpiry: number = 0;
  private useApiKeyAuth: boolean = false;

  private static tokenCache = new Map<string, { token: string; expiry: number }>();

  constructor(config: PazaramaConfig) {
    super('https://isortagimapi.pazarama.com');
    this.marketplaceName = 'pazarama';
    this.config = config;
    this.authClient = axios.create({
      baseURL: 'https://isortagimgiris.pazarama.com/connect/token',
      timeout: 30000,
    });
    this.client.defaults.timeout = 60000;
  }

  private static readonly SCOPE = 'merchantgatewayapi.fullaccess';

  private async requestToken(auth?: { username: string; password: string }, bodyClientId?: string, bodyClientSecret?: string): Promise<any> {
    const params: Record<string, string> = {
      grant_type: 'client_credentials',
      scope: PazaramaClient.SCOPE,
    };
    if (bodyClientId) params.client_id = bodyClientId;
    if (bodyClientSecret) params.client_secret = bodyClientSecret;

    const res = await this.authClient.post<any>('', new URLSearchParams(params), {
      auth,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return res.data;
  }

  private cacheToken(body: any): string | null {
    const token = body?.data?.accessToken || body?.access_token;
    if (!token) return null;
    const expires = body?.data?.expiresIn || body?.expires_in || 3600;
    const expiry = Date.now() + (Number(expires) - 60) * 1000;
    this.bearerToken = token;
    this.tokenExpiry = expiry;
    const key = this.tokenCacheKey();
    if (key) PazaramaClient.tokenCache.set(key, { token, expiry });
    return token;
  }

  private tokenCacheKey(): string | null {
    const id = this.config.apiKey || this.config.clientId;
    if (!id) return null;
    return `${id}:${this.config.clientSecret || ''}`;
  }

  private async ensureToken(): Promise<string> {
    if (this.useApiKeyAuth) return '';
    if (this.bearerToken && Date.now() < this.tokenExpiry) return this.bearerToken;

    const key = this.tokenCacheKey();
    if (key) {
      const cached = PazaramaClient.tokenCache.get(key);
      if (cached && Date.now() < cached.expiry) {
        this.bearerToken = cached.token;
        this.tokenExpiry = cached.expiry;
        return cached.token;
      }
    }

    // Pazarama: client_id = API Key, client_secret = Client Secret (Basic veya body).
    // clientId as credentials is a fallback for stores that stored them differently.
    const attempts: Array<() => Promise<any>> = [
      () => this.requestToken({ username: this.config.apiKey, password: this.config.clientSecret }),
      () => this.requestToken(undefined, this.config.apiKey, this.config.clientSecret),
      () => this.requestToken({ username: this.config.clientId, password: this.config.clientSecret }),
      () => this.requestToken(undefined, this.config.clientId, this.config.clientSecret),
    ];

    let lastErr: any;
    for (const attempt of attempts) {
      try {
        const body = await attempt();
        if (this.cacheToken(body)) return this.bearerToken!;
        lastErr = new Error('unexpected token response format: ' + JSON.stringify(body));
      } catch (err: any) {
        lastErr = err;
        if (err?.response?.status !== 400 && err?.response?.status !== 401) throw err;
      }
    }

    logger.warn('[pazarama] OAuth2 token attempts failed (%s), falling back to API key header auth', lastErr?.message || lastErr);
    this.useApiKeyAuth = true;
    return '';
  }

  private async requestWithAuth<T>(method: string, path: string, opts?: {
    query?: Record<string, any>;
    body?: any;
    noAuth?: boolean;
  }): Promise<T> {
    const headers: Record<string, string> = {};
    if (!opts?.noAuth) {
      const token = await this.ensureToken();
      if (this.useApiKeyAuth) {
        headers['clientId'] = this.config.clientId;
        headers['clientSecret'] = this.config.clientSecret;
        headers['apiKey'] = this.config.apiKey;
      } else if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await this.client.request<T>({
      method,
      url: path,
      params: opts?.query,
      data: opts?.body,
      headers,
    });

    return response.data;
  }

  // ─── Auth-less endpoints ─────────────────────────────────

  async getCategories(): Promise<any[]> {
    const data = await this.requestWithAuth<any>('GET', '/category/getCategoryTree', { noAuth: true });
    const list = data?.data || data || [];
    return Array.isArray(list) ? list : [];
  }

  async getCategoryWithAttributes(categoryId: number): Promise<any> {
    return this.requestWithAuth<any>('GET', '/category/getCategoryWithAttributes', {
      query: { Id: categoryId },
      noAuth: true,
    });
  }

  async getCities(): Promise<any[]> {
    const data = await this.requestWithAuth<any>('GET', '/parameter/cities', { noAuth: true });
    return data?.data || data || [];
  }

  // ─── Brands ──────────────────────────────────────────────

  async getBrands(search?: string): Promise<{ id: number | string; name: string }[]> {
    const all: { id: number | string; name: string }[] = [];
    const size = 100000;
    let page = 1;
    while (page <= 5) {
      const query: Record<string, any> = { Page: page, Size: size };
      if (search) query.Name = search;
      const data = await this.requestWithAuth<any>('GET', '/brand/getBrands', {
        query,
        noAuth: false,
      });
      const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      if (items.length === 0) break;
      for (const b of items) {
        const rawId = b.id ?? b.brandId ?? b.marketplaceBrandId ?? '';
        const id = rawId ? String(rawId) : 0;
        const name = b.name ?? b.brandName ?? '';
        if (name) all.push({ id, name });
      }
      if (items.length < size) break;
      page++;
    }
    return all;
  }

  // ─── Seller Delivery Addresses ───────────────────────────

  async getSellerDeliveries(): Promise<any[]> {
    const data = await this.requestWithAuth<any>('GET', '/sellerRegister/getSellerDelivery');
    return data?.data || [];
  }

  // ─── Products ────────────────────────────────────────────

  async getProducts(params: any = {}): Promise<{ products: any[]; hasMore: boolean }> {
    const query: Record<string, any> = {
      Page: params.page != null ? params.page + 1 : 1,
      Size: Math.min(params.size || params.Size || 250, 250),
    };
    if (params.code) query.Code = params.code;
    if (params.approved == null) query.Approved = true;
    else query.Approved = params.approved;

    const data = await this.requestWithAuth<any>('GET', '/product/products', { query });
    const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    const totalPages = data?.totalPages || 0;
    const currentPage = query.Page || 1;

    if (items.length === 0 && query.Approved === true) {
      query.Approved = false;
      const data2 = await this.requestWithAuth<any>('GET', '/product/products', { query });
      const items2 = Array.isArray(data2?.data) ? data2.data : Array.isArray(data2) ? data2 : [];
      items.push(...items2);
    }

    return {
      products: items,
      hasMore: data?.hasNextPage === true || (items.length > 0 && currentPage < totalPages),
    };
  }

  /** Per-product detail. Unlike the list endpoint, this returns image URLs even for approved products. */
  async getProductDetail(code: string): Promise<any> {
    const data = await this.requestWithAuth<any>('POST', '/product/getProductDetail', { body: { Code: code } });
    return data?.data ?? data;
  }

  async createProduct(product: any): Promise<any> {
    const payload = this.buildProductPayload(product);
    return this.requestWithAuth<any>('POST', '/product/create', { body: { products: [payload] } });
  }

  async updateProduct(productId: string, product: any): Promise<any> {
    const payload = this.buildProductPayload(product);
    if (Object.keys(payload).length === 0) return { skipped: true };
    return this.requestWithAuth<any>('POST', '/product/create', { body: { products: [payload] } });
  }

  async updatePrice(externalId: string, price: number): Promise<any> {
    return this.requestWithAuth<any>('POST', '/product/updatePrice', {
      body: { code: externalId, salePrice: price },
    });
  }

  /** Bulk price update: [{ code, salePrice }] */
  async updatePrices(items: { code: string; salePrice: number }[]): Promise<any> {
    return this.requestWithAuth<any>('POST', '/product/updatePrice', { body: items });
  }

  async updateStock(externalId: string, quantity: number): Promise<any> {
    return this.requestWithAuth<any>('POST', '/product/updateStock', {
      body: { code: externalId, stockCount: quantity },
    });
  }

  /** Bulk stock update: [{ code, stockCount }] */
  async updateStocks(items: { code: string; stockCount: number }[]): Promise<any> {
    return this.requestWithAuth<any>('POST', '/product/updateStock', { body: items });
  }

  // ─── Batch Request ───────────────────────────────────────

  async getProductBatchResult(batchRequestId: string): Promise<any> {
    return this.requestWithAuth<any>('GET', '/product/getProductBatchResult', {
      query: { BatchRequestId: batchRequestId },
    });
  }

  // ─── Orders ──────────────────────────────────────────────

  async getOrders(params: any = {}): Promise<any[]> {
    const body: Record<string, any> = {
      StartDate: params.startDate || params.StartDate || new Date(Date.now() - 30 * 86400000).toISOString(),
      EndDate: params.endDate || params.EndDate || new Date().toISOString(),
      Page: params.page != null ? params.page + 1 : 1,
      Size: Math.min(params.size || params.Size || 100, 100),
    };

    const data = await this.requestWithAuth<any>('POST', '/order/getOrdersForApi', { body });
    return data?.data || [];
  }

  async getOrder(orderId: string): Promise<any> {
    const data = await this.requestWithAuth<any>('GET', `/order/getOrder/${orderId}`);
    return data?.data || data;
  }

  // ─── Helpers ─────────────────────────────────────────────

  private buildProductPayload(product: any): Record<string, any> {
    const images = Array.isArray(product.images || product.Images)
      ? (product.images || product.Images)
          .map((u: any) => ({
            imageurl: typeof u === 'string' ? this.ensureHttps(u) : this.ensureHttps(u.imageurl || u.url || ''),
          }))
          .filter((i: any) => i.imageurl)
      : [];

    const attributes = Array.isArray(product.attributes || product.Attributes)
      ? (product.attributes || product.Attributes)
          .map((a: any) => ({
            attributeId: Number(a.attributeId || a.id),
            attributeValueId: a.attributeValueId || a.valueId || null,
          }))
          .filter((a: any) => a.attributeId)
      : [];

    return {
      Name: product.Name || product.title || '',
      DisplayName: product.DisplayName || product.displayName || product.title || '',
      Description: product.Description || product.description || '',
      BrandId: product.BrandId || product.brandId || '',
      Desi: Number(product.Desi || product.desi || product.dimensionalWeight || 1),
      Code: product.Code || product.code || product.sku || '',
      GroupCode: product.GroupCode || product.groupCode || product.mainSku || '',
      StockCount: Number(product.StockCount || product.stockCount || product.quantity || 0),
      VatRate: this.validateVatRate(product.VatRate || product.vatRate || 10),
      ListPrice: Number(product.ListPrice || product.listPrice || product.price || 0),
      SalePrice: Number(product.SalePrice || product.salePrice || product.price || 0),
      CategoryId: product.CategoryId || product.categoryId || '',
      images,
      attributes,
    };
  }

  private validateVatRate(rate: number): number {
    const valid = [0, 1, 10, 20];
    return valid.includes(Number(rate)) ? Number(rate) : 10;
  }

  private ensureHttps(url: string): string {
    if (!url) return url;
    return url.replace(/^http:\/\//i, 'https://');
  }
}

export function createPazaramaClient(config: PazaramaConfig): PazaramaClient {
  return new PazaramaClient(config);
}
