import { BaseMarketplaceClient, MarketplaceClient } from './base.js';

interface EtsyConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
}

interface EtsyListing {
  title: string;
  description: string;
  quantity: number;
  price: number;
  currency_code: string;
  tags: string[];
  materials: string[];
  taxonomy_id: number;
  who_made: string;
  is_supply: string;
  when_made: string;
  style?: string[];
  shop_section_id?: number;
  images?: Array<{ url: string }>;
}

interface EtsyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export class EtsyClient extends BaseMarketplaceClient implements MarketplaceClient {
  private config: EtsyConfig;

  constructor(config: EtsyConfig) {
    super('https://openapi.etsy.com/v3/application');
    this.config = config;
  }

  private async ensureToken(): Promise<void> {
    if (this.config.accessToken && this.config.tokenExpiry && Date.now() < this.config.tokenExpiry) return;

    if (!this.config.refreshToken) {
      throw new Error('Etsy refresh token not available. Complete OAuth flow first.');
    }

    const axios = require('axios');
    const response = await axios.post('https://api.etsy.com/v3/public/oauth/token', new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.config.refreshToken,
      client_id: this.config.clientId,
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    this.config.accessToken = response.data.access_token;
    this.config.refreshToken = response.data.refresh_token;
    this.config.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
  }

  private async authenticatedRequest<T>(method: string, path: string, data?: any, params?: any): Promise<T> {
    await this.ensureToken();
    const response = await this.client.request<T>({
      method,
      url: path,
      data,
      params,
      headers: { Authorization: `Bearer ${this.config.accessToken}`, 'Content-Type': 'application/json' },
    });
    return response.data;
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: 'listings_r listings_w transactions_r transactions_w profile_r profile_w shops_r shops_w',
      state,
    });
    return `https://www.etsy.com/oauth/connect?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<EtsyTokenResponse> {
    const axios = require('axios');
    const response = await axios.post('https://api.etsy.com/v3/public/oauth/token', new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    this.config.accessToken = response.data.access_token;
    this.config.refreshToken = response.data.refresh_token;
    this.config.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
    return response.data;
  }

  async getShopId(): Promise<number> {
    const data = await this.authenticatedRequest<any>('GET', '/shops');
    return data.results?.[0]?.shop_id;
  }

  async getCategories(): Promise<any[]> { return []; }

  async getProducts(params: any = {}): Promise<{ products: any[]; hasMore: boolean }> {
    const shopId = await this.getShopId();
    const data = await this.authenticatedRequest<any>('GET', `/shops/${shopId}/listings/active`, { params: { limit: params.limit || 50, offset: params.offset || 0 } });
    return { products: data.results || [], hasMore: !!data.pagination?.next_offset };
  }

  async createProduct(product: EtsyListing): Promise<any> {
    const shopId = await this.getShopId();
    return this.authenticatedRequest<any>('POST', `/shops/${shopId}/listings`, product);
  }

  async updateProduct(listingId: string, product: Partial<EtsyListing>): Promise<any> {
    const shopId = await this.getShopId();
    return this.authenticatedRequest<any>('PUT', `/shops/${shopId}/listings/${listingId}`, product);
  }

  async updatePrice(listingId: string, price: number): Promise<any> {
    return this.updateProduct(listingId, { price, currency_code: 'TRY' });
  }

  async updateStock(listingId: string, quantity: number): Promise<any> {
    return this.updateProduct(listingId, { quantity });
  }

  async getOrders(params: any = {}): Promise<any[]> {
    const shopId = await this.getShopId();
    const data = await this.authenticatedRequest<any>('GET', `/shops/${shopId}/receipts`, { params });
    return data.results || [];
  }

  async getOrder(receiptId: string): Promise<any> {
    const shopId = await this.getShopId();
    return this.authenticatedRequest<any>('GET', `/shops/${shopId}/receipts/${receiptId}`);
  }
}

export function createEtsyClient(config: EtsyConfig): EtsyClient {
  return new EtsyClient(config);
}