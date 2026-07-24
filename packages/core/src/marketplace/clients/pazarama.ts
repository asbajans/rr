import axios, { AxiosInstance } from 'axios';
import { BaseMarketplaceClient, MarketplaceClient } from './base.js';

export interface PazaramaConfig {
  clientId: string;
  clientSecret: string;
  apiKey: string;
}

export class PazaramaClient extends BaseMarketplaceClient implements MarketplaceClient {
  private config: PazaramaConfig;
  private authClient: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: PazaramaConfig) {
    super('https://isortagimapi.pazarama.com');
    this.marketplaceName = 'pazarama';
    this.config = config;
    this.authClient = axios.create({
      baseURL: 'https://isortagimgiris.pazarama.com/connect/token',
      timeout: 30000,
    });
  }

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return;

    const response = await this.authClient.post('', new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'merchantgatewayapi.fullaccess',
    }), {
      auth: { username: this.config.clientId, password: this.config.clientSecret },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    this.accessToken = response.data.access_token;
    this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
  }

  private async authenticatedRequest<T>(method: string, path: string, query?: any, body?: any): Promise<T> {
    await this.ensureToken();
    const response = await this.client.request<T>({
      method,
      url: path,
      params: query,
      data: body,
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    return response.data;
  }

  async getCategories(): Promise<any[]> {
    const data = await this.authenticatedRequest<any>('GET', '/category/getCategoryTree');
    return data?.data || [];
  }

  async getProducts(params: any = {}): Promise<{ products: any[]; hasMore: boolean }> {
    const data = await this.authenticatedRequest<any>('GET', '/product/getProducts', params);
    return { products: data?.data || [], hasMore: data?.hasMore || false };
  }

  async createProduct(product: any): Promise<any> {
    return this.authenticatedRequest<any>('POST', '/product/create', undefined, product);
  }

  async updateProduct(productId: string, product: any): Promise<any> {
    return this.authenticatedRequest<any>('PUT', `/product/update/${productId}`, undefined, product);
  }

  async updatePrice(productId: string, price: number): Promise<any> {
    return this.authenticatedRequest<any>('POST', '/product/updatePrice', undefined, { code: productId, salePrice: price });
  }

  async updateStock(productId: string, quantity: number): Promise<any> {
    return this.authenticatedRequest<any>('POST', '/product/updateStock', undefined, { code: productId, stockCount: quantity });
  }

  async getOrders(params: any = {}): Promise<any[]> {
    const data = await this.authenticatedRequest<any>('GET', '/order/getOrders', params);
    return data?.data || [];
  }

  async getOrder(orderId: string): Promise<any> {
    return this.authenticatedRequest<any>('GET', `/order/getOrder/${orderId}`);
  }
}

export function createPazaramaClient(config: PazaramaConfig): PazaramaClient {
  return new PazaramaClient(config);
}