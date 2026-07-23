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

  constructor(config: TrendyolConfig) {
    super('https://apigw.trendyol.com/integration/product', {
      'Content-Type': 'application/json',
      'User-Agent': config.supplierId,
      'Authorization': `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`,
    });
    this.config = config;
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

  async getOrders(params: { startDate?: string; endDate?: string; page?: number; size?: number } = {}): Promise<any[]> {
    const url = `/sellers/${this.config.supplierId}/orders`;
    const data = await this.request<any>({ method: 'GET', url, params });
    return data.content || [];
  }

  async getOrder(orderId: string): Promise<any> {
    const url = `/sellers/${this.config.supplierId}/orders/${orderId}`;
    return this.request<any>({ method: 'GET', url });
  }
}

export function createTrendyolClient(config: TrendyolConfig): TrendyolClient {
  return new TrendyolClient(config);
}