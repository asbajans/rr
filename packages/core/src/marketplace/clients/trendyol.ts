import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { BaseMarketplaceClient, MarketplaceClient } from './base.js';

export interface TrendyolConfig {
  apiKey: string;
  apiSecret: string;
  supplierId: string;
}

interface TrendyolProduct {
  barcode: string;
  title: string;
  productMainId: string;
  brandId: number;
  categoryId: number;
  quantity: number;
  stockCode: string;
  dimensionalWeight: number;
  description: string;
  currencyType: string;
  listPrice: number;
  salePrice: number;
  vatRate: number;
  cargoCompanyId: number;
  shipmentAddressId: number;
  returnAddressId: number;
  images: Array<{ url: string }>;
  attributes: Array<{ attributeId: number; attributeValueId: number }>;
}

export class TrendyolClient extends BaseMarketplaceClient implements MarketplaceClient {
  private config: TrendyolConfig;
  private orderClient: AxiosInstance;

  constructor(config: TrendyolConfig) {
    super('https://apigw.trendyol.com/integration/product', {
      'Content-Type': 'application/json',
      'User-Agent': config.supplierId,
      'Authorization': `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`,
    });
    this.marketplaceName = 'trendyol';
    this.config = config;
    this.orderClient = axios.create({
      baseURL: 'https://apigw.trendyol.com/integration/order',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': config.supplierId,
        'Authorization': `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`,
      },
      timeout: 30000,
    });
  }

  async getCategories(): Promise<any[]> {
    const path = `/product-categories`;
    const data = await this.request<any>({ method: 'GET', url: path });
    const categories = data.categories || [];
    const flat: any[] = [];
    const walk = (list: any[]) => {
      for (const cat of list) {
        if (!cat) continue;
        flat.push({
          id: cat.id,
          name: cat.name,
          parentId: cat.parentId ?? 0,
          level: cat.level ?? 0,
        });
        if (Array.isArray(cat.subCategories) && cat.subCategories.length) {
          walk(cat.subCategories);
        }
      }
    };
    walk(categories);
    return flat;
  }

  async getProducts(params: { page?: number; size?: number; status?: string } = {}): Promise<{ products: any[]; hasMore: boolean }> {
    const { page = 0, size = 50, status = 'Approved' } = params;
    const url = `/sellers/${this.config.supplierId}/products/approved`;
    const data = await this.request<any>({ method: 'GET', url, params: { page, size } });
    return {
      products: data.content || [],
      hasMore: data.last ? false : true
    };
  }

  async createProduct(product: TrendyolProduct): Promise<any> {
    const url = `/sellers/${this.config.supplierId}/products`;
    const data = await this.request<any>({ method: 'POST', url, data: { items: [product] } });
    return data.batchRequestId || data.listing_id;
  }

  async updateProduct(productId: string, product: Partial<TrendyolProduct>): Promise<any> {
    const url = `/sellers/${this.config.supplierId}/products/${productId}`;
    return this.request<any>({ method: 'PUT', url, data: product });
  }

  async updatePrice(productId: string, price: number): Promise<any> {
    const url = `/sellers/${this.config.supplierId}/products/${productId}/price`;
    return this.request<any>({ method: 'POST', url, data: { salePrice: price } });
  }

  async updateStock(productId: string, quantity: number): Promise<any> {
    const url = `/sellers/${this.config.supplierId}/products/${productId}/stock`;
    return this.request<any>({ method: 'PUT', url, data: { quantity } });
  }

  async getBrands(search?: string): Promise<{ id: number; name: string }[]> {
    try {
      const path = `/sellers/${this.config.supplierId}/brands`;
      const data = await this.request<any>({ method: 'GET', url: path, params: { name: search || '', size: 1000 } });
      return data?.brands || data?.content || [];
    } catch {
      return [];
    }
  }

  async getOrders(params: { startDate?: string; endDate?: string; page?: number; size?: number } = {}): Promise<any[]> {
    const url = `/sellers/${this.config.supplierId}/orders`;
    const data = await this.request<any>({ method: 'GET', url, params });
    return data.content || [];
  }

  async getOrder(orderId: string): Promise<any> {
    const url = `/sellers/${this.config.supplierId}/orders/${orderId}`;
    return this.request<any>({ method: 'GET', url });
  }

  async updateOrderStatus(orderId: string, status: string): Promise<any> {
    const url = `/sellers/${this.config.supplierId}/orders/${orderId}`;
    const data: Record<string, any> = {};
    if (status === 'approved' || status === 'Picking') {
      return this.orderRequest<any>({ method: 'PUT', url: `/sellers/${this.config.supplierId}/orders/${orderId}/approve`, data: {} });
    } else if (status === 'shipped' || status === 'Invoiced') {
      return this.orderRequest<any>({ method: 'PUT', url: `/sellers/${this.config.supplierId}/orders/${orderId}/invoice`, data: {} });
    }
    return this.orderRequest<any>({ method: 'PUT', url, data: { status } });
  }

  async updateTracking(orderId: string, trackingNumber: string, carrier: string): Promise<any> {
    return this.orderRequest<any>({
      method: 'PUT',
      url: `/sellers/${this.config.supplierId}/orders/${orderId}/ship`,
      data: { trackingNumber, cargoCompany: carrier },
    });
  }

  private async orderRequest<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.orderClient.request<T>(config);
    return response.data;
  }
}

export function createTrendyolClient(config: TrendyolConfig): TrendyolClient {
  return new TrendyolClient(config);
}