import { BaseMarketplaceClient, MarketplaceClient, generateHmacSHA256 } from './base.js';

export interface TrendyolConfig {
  apiKey: string;
  apiSecret: string;
  supplierId: number;
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
    super('https://api.trendyol.com/sapigw', {
      'User-Agent': `${config.apiKey} - Rahatio Integration`,
    });
    this.config = config;
  }

  private getAuthHeaders(method: string, path: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const stringToSign = `${method}\n${path}\n${timestamp}`;
    const signature = generateHmacSHA256(stringToSign, this.config.apiSecret);

    return {
      'Authorization': `Basic ${Buffer.from(`${this.config.apiKey}:${signature}`).toString('base64')}`,
      'X-Trendyol-Timestamp': timestamp,
    };
  }

  async getCategories(): Promise<any[]> {
    const path = `/product-categories`;
    const headers = this.getAuthHeaders('GET', path);
    const data = await this.request<any>({ method: 'GET', url: path, headers });
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
    const path = `/suppliers/${this.config.supplierId}/products`;
    const headers = this.getAuthHeaders('GET', path);
    const data = await this.request<any>({
      method: 'GET',
      url: path,
      headers,
      params: { page, size, status },
    });
    return { products: data.content || [], hasMore: !data.last };
  }

  async createProduct(product: TrendyolProduct): Promise<any> {
    const path = `/suppliers/${this.config.supplierId}/products`;
    const headers = this.getAuthHeaders('POST', path);
    const data = await this.request<any>({
      method: 'POST',
      url: path,
      headers,
      data: { items: [product] },
    });
    return data.batchRequestId;
  }

  async updateProduct(productId: string, product: Partial<TrendyolProduct>): Promise<any> {
    const path = `/suppliers/${this.config.supplierId}/products/${productId}`;
    const headers = this.getAuthHeaders('PUT', path);
    const data = await this.request<any>({
      method: 'PUT',
      url: path,
      headers,
      data: product,
    });
    return data;
  }

  async updatePrice(productId: string, price: number): Promise<any> {
    const path = `/suppliers/${this.config.supplierId}/products/${productId}/price`;
    const headers = this.getAuthHeaders('POST', path);
    const data = await this.request<any>({
      method: 'POST',
      url: path,
      headers,
      data: { salePrice: price },
    });
    return data;
  }

  async updateStock(productId: string, quantity: number): Promise<any> {
    const path = `/suppliers/${this.config.supplierId}/products/${productId}/stock`;
    const headers = this.getAuthHeaders('POST', path);
    const data = await this.request<any>({
      method: 'POST',
      url: path,
      headers,
      data: { quantity },
    });
    return data;
  }

  async getOrders(params: { startDate?: string; endDate?: string; page?: number; size?: number } = {}): Promise<any[]> {
    const path = `/suppliers/${this.config.supplierId}/orders`;
    const headers = this.getAuthHeaders('GET', path);
    const data = await this.request<any>({
      method: 'GET',
      url: path,
      headers,
      params: params,
    });
    return data.content || [];
  }

  async getOrder(orderId: string): Promise<any> {
    const path = `/suppliers/${this.config.supplierId}/orders/${orderId}`;
    const headers = this.getAuthHeaders('GET', path);
    return this.request<any>({ method: 'GET', url: path, headers });
  }
}

export function createTrendyolClient(config: TrendyolConfig): TrendyolClient {
  return new TrendyolClient(config);
}