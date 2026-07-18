import { BaseMarketplaceClient, MarketplaceClient } from './base.js';

interface PazaramaConfig {
  clientId: string;
  clientSecret: string;
  apiKey: string;
}

interface PazaramaTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export class PazaramaClient extends BaseMarketplaceClient implements MarketplaceClient {
  private config: PazaramaConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: PazaramaConfig) {
    super('https://api.pazarama.com/v1');
    this.config = config;
  }

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return;

    const axios = require('axios');
    const response = await axios.post('https://api.pazarama.com/oauth/token', new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: 'read write',
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    this.accessToken = response.data.access_token;
    this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
  }

  private async authenticatedRequest<T>(method: string, path: string, data?: any): Promise<T> {
    await this.ensureToken();
    const response = await this.client.request<T>({
      method,
      url: path,
      data,
      headers: { Authorization: `Bearer ${this.accessToken}`, 'X-Api-Key': this.config.apiKey },
    });
    return response.data;
  }

  async getCategories(): Promise<any[]> {
    const data = await this.authenticatedRequest<any>('GET', '/categories');
    return data.categories || [];
  }

  async getProducts(params: any = {}): Promise<{ products: any[]; hasMore: boolean }> {
    const data = await this.authenticatedRequest<any>('GET', '/products', { params });
    return { products: data.products || [], hasMore: data.hasMore || false };
  }

  async createProduct(product: any): Promise<any> {
    return this.authenticatedRequest<any>('POST', '/products', product);
  }

  async updateProduct(productId: string, product: any): Promise<any> {
    return this.authenticatedRequest<any>('PUT', `/products/${productId}`, product);
  }

  async updatePrice(productId: string, price: number): Promise<any> {
    return this.authenticatedRequest<any>('PATCH', `/products/${productId}/price`, { price });
  }

  async updateStock(productId: string, quantity: number): Promise<any> {
    return this.authenticatedRequest<any>('PATCH', `/products/${productId}/stock`, { quantity });
  }

  async getOrders(params: any = {}): Promise<any[]> {
    const data = await this.authenticatedRequest<any>('GET', '/orders', { params });
    return data.orders || [];
  }

  async getOrder(orderId: string): Promise<any> {
    return this.authenticatedRequest<any>('GET', `/orders/${orderId}`);
  }
}

export function createPazaramaClient(config: PazaramaConfig): PazaramaClient {
  return new PazaramaClient(config);
}