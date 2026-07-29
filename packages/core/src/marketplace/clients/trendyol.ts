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
  brandId: number | string;
  categoryId: number;
  quantity: number;
  stockCode: string;
  dimensionalWeight: number;
  description: string;
  currencyType: string;
  listPrice: number;
  salePrice: number;
  vatRate: number;
  shipmentAddressId?: number;
  returningAddressId?: number;
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
    const url = `/sellers/${this.config.supplierId}/v2/products`;
    const data = await this.request<any>({ method: 'POST', url, data: { items: [product] } });
    return data;
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

  async getProductByBarcode(barcode: string): Promise<any> {
    try {
      return await this.request<any>({ method: 'GET', url: `/sellers/${this.config.supplierId}/product/${encodeURIComponent(barcode)}` });
    } catch { return null; }
  }

  async updateUnapprovedProduct(product: any): Promise<any> {
    const url = `/sellers/${this.config.supplierId}/products/unapproved-bulk-update`;
    const data = await this.request<any>({ method: 'POST', url, data: { items: [product] } });
    return data;
  }

  async getApprovedProductsStockAndPrice(params: { page?: number; size?: number } = {}): Promise<{ items: any[]; hasMore: boolean }> {
    const { page = 0, size = 50 } = params;
    const data = await this.request<any>({
      method: 'GET',
      url: `/sellers/${this.config.supplierId}/products/approved/inventory-and-price`,
      params: { page, size },
    });
    return { items: data.content || [], hasMore: data.last ? false : true };
  }

  async getCategoryAttributes(categoryId: number): Promise<any[]> {
    try {
      const path = `/product-categories/${categoryId}/attributes`;
      const data = await this.request<any>({ method: 'GET', url: path });
      return data?.categoryAttributes || [];
    } catch {
      return [];
    }
  }

  async getBatchRequestResult(batchRequestId: string): Promise<any> {
    const path = `/sellers/${this.config.supplierId}/products/batch-requests/${batchRequestId}`;
    return this.request<any>({ method: 'GET', url: path });
  }

  async updatePriceAndInventory(items: Array<{ barcode: string; quantity: number; salePrice: number; listPrice?: number }>): Promise<any> {
    const url = `/sellers/${this.config.supplierId}/products/price-and-inventory`;
    const orderClient = axios.create({
      baseURL: 'https://apigw.trendyol.com/integration/inventory',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': this.config.supplierId,
        'Authorization': `Basic ${Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString('base64')}`,
      },
      timeout: 30000,
    });
    const response = await orderClient.post(url, { items });
    return response.data;
  }

  async getBrands(search?: string): Promise<{ id: number; name: string }[]> {
    try {
      const path = `/brands`;
      const data = await this.request<any>({ method: 'GET', url: path, params: { name: search || '', size: 1000 } });
      return data?.brands || data?.content || [];
    } catch {
      return [];
    }
  }

  async getOrders(params: { startDate?: string; endDate?: string; page?: number; size?: number; status?: string; orderByField?: string; orderByDirection?: string } = {}): Promise<any[]> {
    const url = `/sellers/${this.config.supplierId}/orders`;
    const data = await this.orderRequest<any>({ method: 'GET', url, params });
    return data.shipmentPackages || data.content || [];
  }

  async getOrder(orderId: string): Promise<any> {
    const url = `/sellers/${this.config.supplierId}/orders/${orderId}`;
    return this.orderRequest<any>({ method: 'GET', url });
  }

  async cancelOrder(orderId: string, reason: string = 'OUT_OF_STOCK'): Promise<any> {
    return this.orderRequest<any>({
      method: 'PUT',
      url: `/sellers/${this.config.supplierId}/orders/${orderId}/cancel`,
      data: { cancelReason: reason },
    });
  }

  async updateOrderStatus(orderId: string, status: string): Promise<any> {
    if (status === 'approved' || status === 'Picking') {
      return this.orderRequest<any>({ method: 'PUT', url: `/sellers/${this.config.supplierId}/orders/${orderId}/approve`, data: {} });
    } else if (status === 'shipped' || status === 'Invoiced') {
      return this.orderRequest<any>({ method: 'PUT', url: `/sellers/${this.config.supplierId}/orders/${orderId}/invoice`, data: {} });
    } else if (status === 'Cancelled' || status === 'cancelled') {
      return this.cancelOrder(orderId);
    }
    return this.orderRequest<any>({ method: 'PUT', url: `/sellers/${this.config.supplierId}/orders/${orderId}`, data: { status } });
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