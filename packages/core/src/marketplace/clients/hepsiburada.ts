import { BaseMarketplaceClient, MarketplaceClient, generateHmacSHA256Hex } from './base.js';

export interface HepsiburadaConfig {
  username: string;
  password: string;
  merchantId: string;
}

interface HBProduct {
  merchantSku: string;
  name: string;
  description: string;
  categoryId: number;
  brandId: number;
  attributes: Array<{ attributeId: number; valueId: number }>;
  images: string[];
  listPrice: number;
  salePrice: number;
  quantity: number;
  cargoCompanyId: number;
  dispatchDuration: number;
  vatRate: number;
}

export class HepsiburadaClient extends BaseMarketplaceClient implements MarketplaceClient {
  private config: HepsiburadaConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: HepsiburadaConfig) {
    super('https://mpop.hepsiburada.com');
    this.marketplaceName = 'hepsiburada';
    this.config = config;
  }

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return;

    const response = await axios.post('https://mpop.hepsiburada.com/auth/realms/Hepsiburada/protocol/openid-connect/token', new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.username,
      client_secret: this.config.password,
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    this.accessToken = response.data.access_token;
    this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
  }

  private async authenticatedRequest<T>(method: string, path: string, data?: any): Promise<T> {
    await this.ensureToken();
    const response = await this.client.request<T>({
      method,
      url: path,
      data,
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    return response.data;
  }

  async getCategories(): Promise<any[]> {
    const data = await this.authenticatedRequest<any>('GET', `/commerce/v1/categories?merchantId=${this.config.merchantId}`);
    return data.categoryList || [];
  }

  async getProducts(params: { page?: number; size?: number; status?: string } = {}): Promise<{ products: any[]; hasMore: boolean }> {
    // Queues drives pagination with 0-indexed `page`; the Hepsiburada mpop
    // surface is 1-indexed. Normalize and handle multiple response shapes
    // (content/last vs data/totalCount vs listings).
    const rawPage = params.page ?? 0;
    const page = rawPage + 1;
    const size = params.size ?? 50;
    const data = await this.authenticatedRequest<any>('GET', `/commerce/v1/products?merchantId=${this.config.merchantId}&page=${page}&size=${size}`);
    const products = data.content || data.data || (data as any).listings || [];
    let hasMore: boolean;
    if (typeof (data as any).last === 'boolean') hasMore = !(data as any).last;
    else if (typeof (data as any).totalCount === 'number' && typeof (data as any).limit === 'number') hasMore = ((data as any).offset ?? 0) + ((data as any).limit ?? size) < (data as any).totalCount;
    else if (typeof (data as any).totalPages === 'number') hasMore = page < (data as any).totalPages;
    else if (typeof (data as any).totalElements === 'number') hasMore = page * size < (data as any).totalElements;
    else hasMore = Array.isArray(products) && products.length === size;
    return { products: Array.isArray(products) ? products : [], hasMore };
  }

  async createProduct(product: HBProduct): Promise<any> {
    return this.authenticatedRequest<any>('POST', `/commerce/v1/products?merchantId=${this.config.merchantId}`, product);
  }

  async updateProduct(productId: string, product: HBProduct): Promise<any> {
    return this.authenticatedRequest<any>('PUT', `/commerce/v1/products/${productId}?merchantId=${this.config.merchantId}`, product);
  }

  async updatePrice(productId: string, price: number): Promise<any> {
    return this.authenticatedRequest<any>('PATCH', `/commerce/v1/products/${productId}/price?merchantId=${this.config.merchantId}`, { salePrice: price });
  }

  async updateStock(productId: string, quantity: number): Promise<any> {
    return this.authenticatedRequest<any>('PATCH', `/commerce/v1/products/${productId}/stock?merchantId=${this.config.merchantId}`, { quantity });
  }

  async getOrders(params: { page?: number; size?: number; status?: string } = {}): Promise<any[]> {
    const { page = 1, size = 50 } = params;
    const data = await this.authenticatedRequest<any>('GET', `/commerce/v1/orders?merchantId=${this.config.merchantId}&page=${page}&size=${size}`);
    return data.content || [];
  }

  async getOrder(orderId: string): Promise<any> {
    return this.authenticatedRequest<any>('GET', `/commerce/v1/orders/${orderId}?merchantId=${this.config.merchantId}`);
  }
}

import axios from 'axios';