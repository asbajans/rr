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

  private async ensureToken(): Promise<string> {
    if (this.useApiKeyAuth) return '';
    if (this.bearerToken && Date.now() < this.tokenExpiry) return this.bearerToken;

    const tryBasic = async (): Promise<any> => {
      const res = await this.authClient.post<any>('', new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'merchantgatewayapi.fullaccess',
      }), {
        auth: { username: this.config.clientId, password: this.config.clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return res.data;
    };

    const tryBodyAuth = async (): Promise<any> => {
      const res = await this.authClient.post<any>('', new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'merchantgatewayapi.fullaccess',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return res.data;
    };

    const tryApiKey = async (): Promise<any> => {
      const res = await this.authClient.post<any>('', new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'merchantgatewayapi.fullaccess',
        client_id: this.config.apiKey,
        client_secret: this.config.clientSecret,
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return res.data;
    };

    let lastErr: any;

    for (const attempt of [tryBasic, tryBodyAuth, tryApiKey]) {
      try {
        const body = await attempt();
        if (body?.success === true && body?.data?.accessToken) {
          this.bearerToken = body.data.accessToken;
          this.tokenExpiry = Date.now() + ((body.data.expiresIn || 3600) - 60) * 1000;
          return this.bearerToken!;
        }
        if (body?.access_token) {
          this.bearerToken = body.access_token;
          this.tokenExpiry = Date.now() + ((body.expires_in || 3600) - 60) * 1000;
          return this.bearerToken!;
        }
        lastErr = new Error('unexpected response format: ' + JSON.stringify(body));
      } catch (err: any) {
        lastErr = err;
        if (err?.response?.status !== 400 && err?.response?.status !== 401) throw err;
      }
    }

    logger.warn('[pazarama] OAuth2 all 3 attempts failed, falling back to API key header auth');
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

  async getBrands(search?: string): Promise<{ id: number; name: string }[]> {
    const data = await this.requestWithAuth<any>('GET', '/brand/getBrands', {
      query: { page: 1, size: 100, name: search || '' },
      noAuth: true,
    });
    const items = data?.data || [];
    return (Array.isArray(items) ? items : []).map((b: any) => ({
      id: Number(b.id || b.brandId || 0),
      name: b.name || b.brandName || '',
    }));
  }

  // ─── Seller Delivery Addresses ───────────────────────────

  async getSellerDeliveries(): Promise<any[]> {
    const data = await this.requestWithAuth<any>('GET', '/sellerRegister/getSellerDelivery');
    return data?.data || [];
  }

  // ─── Products ────────────────────────────────────────────

  async getProducts(params: any = {}): Promise<{ products: any[]; hasMore: boolean }> {
    const body: Record<string, any> = {
      Page: params.page != null ? params.page + 1 : 1,
      Size: Math.min(params.size || params.Size || 250, 250),
    };
    if (params.code) body.Code = params.code;
    if (params.approved != null) body.Approved = params.approved;

    const data = await this.requestWithAuth<any>('POST', '/product/getProducts', { body });
    const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    const totalPages = data?.totalPages || data?.pageCount || 1;
    const currentPage = body.Page || 1;

    return {
      products: items,
      hasMore: items.length > 0 && currentPage < totalPages,
    };
  }

  async createProduct(product: any): Promise<any> {
    const payload: Record<string, any> = {
      Name: product.Name || product.title || '',
      DisplayName: product.DisplayName || product.displayName || product.title || '',
      Description: product.Description || product.description || '',
      BrandId: Number(product.BrandId || product.brandId || 0),
      Desi: Number(product.Desi || product.desi || product.dimensionalWeight || 1),
      Code: product.Code || product.code || product.sku || '',
      GroupCode: product.GroupCode || product.groupCode || product.mainSku || '',
      StockCount: Number(product.StockCount || product.stockCount || product.quantity || 0),
      VatRate: this.validateVatRate(product.VatRate || product.vatRate || 10),
      ListPrice: Number(product.ListPrice || product.listPrice || product.price || 0),
      SalePrice: Number(product.SalePrice || product.salePrice || product.price || 0),
      CategoryId: Number(product.CategoryId || product.categoryId || 0),
      images: Array.isArray(product.images || product.Images)
        ? (product.images || product.Images).map((u: any) => ({
            imageurl: typeof u === 'string' ? this.ensureHttps(u) : this.ensureHttps(u.imageurl || u.url || ''),
          })).filter((i: any) => i.imageurl)
        : [],
      attributes: Array.isArray(product.attributes || product.Attributes)
        ? (product.attributes || product.Attributes).map((a: any) => ({
            attributeId: Number(a.attributeId || a.id),
            attributeValueId: a.attributeValueId || a.valueId || null,
          })).filter((a: any) => a.attributeId)
        : [],
    };

    return this.requestWithAuth<any>('POST', '/product/CreateProduct', { body: payload });
  }

  async updateProduct(productId: string, product: any): Promise<any> {
    const payload: Record<string, any> = {};

    if (product.Name || product.title) payload.Name = product.Name || product.title;
    if (product.DisplayName || product.displayName) payload.DisplayName = product.DisplayName || product.displayName;
    if (product.Description || product.description) payload.Description = product.Description || product.description;
    if (product.BrandId || product.brandId) payload.BrandId = Number(product.BrandId || product.brandId);
    if (product.Desi || product.desi) payload.Desi = Number(product.Desi || product.desi);
    if (product.StockCount || product.quantity) payload.StockCount = Number(product.StockCount || product.quantity);
    if (product.VatRate || product.vatRate) payload.VatRate = this.validateVatRate(product.VatRate || product.vatRate);
    if (product.ListPrice || product.listPrice) payload.ListPrice = Number(product.ListPrice || product.listPrice);
    if (product.SalePrice || product.salePrice) payload.SalePrice = Number(product.SalePrice || product.salePrice);
    if (product.CategoryId || product.categoryId) payload.CategoryId = Number(product.CategoryId || product.categoryId);
    if (product.Code || product.code) payload.Code = product.Code || product.code;

    if (Object.keys(payload).length === 0) return { skipped: true };

    return this.requestWithAuth<any>('POST', '/product/UpdateProductAndStockByCode', { body: payload });
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
