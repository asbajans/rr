import { BaseMarketplaceClient, MarketplaceClient } from './base.js';

export interface N11Config {
  appKey: string;
  appSecret: string;
}

function getAuthHeaders(config: N11Config): Record<string, string> {
  return { appKey: config.appKey, appSecret: config.appSecret };
}

interface N11Category {
  id: number;
  name: string;
  subCategories?: N11Category[];
}

export class N11Client extends BaseMarketplaceClient implements MarketplaceClient {
  private config: N11Config;

  constructor(config: N11Config) {
    super('https://api.n11.com');
    this.marketplaceName = 'n11';
    this.config = config;
  }

  async getCategories(): Promise<any[]> {
    try {
      const data = await this.request<any>({
        method: 'GET',
        url: '/cdn/categories',
        headers: getAuthHeaders(this.config),
      });
      const raw = data?.categories || data?.categoryList || data || [];
      const list = Array.isArray(raw) ? raw : (raw?.category ? raw.category : []);
      return this.flattenCategories(list, 0);
    } catch {
      return [];
    }
  }

  private flattenCategories(categories: N11Category[], parentId: number = 0, level: number = 0): any[] {
    const result: any[] = [];
    for (const cat of categories) {
      result.push({
        id: cat.id,
        marketplace_category_id: String(cat.id),
        name: cat.name,
        parentId,
        parent_id: String(parentId),
        level,
        path: cat.name,
      });
      if (cat.subCategories?.length) {
        result.push(...this.flattenCategories(cat.subCategories, cat.id, level + 1));
      }
    }
    return result;
  }

  async getProducts(params: any = {}): Promise<{ products: any[]; hasMore: boolean }> {
    try {
      const query: Record<string, any> = {
        page: params.page || 0,
        size: params.size || 100,
      };
      if (params.stockCode) query.stockCode = params.stockCode;
      if (params.status) query.saleStatus = params.status;
      if (params.categoryIds) query.categoryIds = params.categoryIds;

      const data = await this.request<any>({
        method: 'GET',
        url: '/ms/product-query',
        params: query,
        headers: getAuthHeaders(this.config),
      });
      const products = data?.content || data?.products || data?.data || [];
      const totalPages = data?.totalPages || data?.pageCount || 1;
      return {
        products: Array.isArray(products) ? products : [],
        hasMore: (params.page || 0) < totalPages - 1,
      };
    } catch {
      return { products: [], hasMore: false };
    }
  }

  async createProduct(product: any): Promise<any> {
    const payload: Record<string, any> = {
      payload: {
        integrator: product.integrator || 'Rahatio',
        skus: [{
          title: product.title,
          description: product.description || '',
          categoryId: product.categoryId,
          currencyType: product.currencyType || 'TL',
          productMainId: product.productMainId || product.sku,
          preparingDay: product.preparingDay || 3,
          shipmentTemplate: product.shipmentTemplate || '1',
          maxPurchaseQuantity: product.maxPurchaseQuantity || 5,
          stockCode: product.sku,
          quantity: product.quantity || 0,
          images: product.images || [],
          attributes: product.attributes || [],
          salePrice: product.salePrice || product.price,
          listPrice: product.listPrice || product.price,
          vatRate: product.vatRate || 10,
        }],
      },
    };
    if (product.barcode) payload.payload.skus[0].barcode = product.barcode;
    if (product.catalogId) payload.payload.skus[0].catalogId = product.catalogId;

    return this.request<any>({
      method: 'POST',
      url: '/ms/product/tasks/product-create',
      data: payload,
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders(this.config) },
    });
  }

  async updateProduct(productId: string, product: any): Promise<any> {
    const payload: Record<string, any> = {
      payload: {
        skus: [{
          stockCode: productId,
          title: product.title,
          description: product.description,
          categoryId: product.categoryId,
          salePrice: product.salePrice || product.price,
          listPrice: product.listPrice || product.price,
          quantity: product.quantity,
        }],
      },
    };

    return this.request<any>({
      method: 'POST',
      url: '/ms/product/tasks/product-update',
      data: payload,
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders(this.config) },
    });
  }

  async updatePrice(productId: string, price: number): Promise<any> {
    return this.updatePriceAndStock(productId, { salePrice: price, listPrice: price });
  }

  async updateStock(productId: string, quantity: number): Promise<any> {
    return this.updatePriceAndStock(productId, { quantity });
  }

  private async updatePriceAndStock(stockCode: string, fields: Record<string, any>): Promise<any> {
    const payload: Record<string, any> = {
      payload: {
        integrator: 'Rahatio',
        skus: [{ stockCode, ...fields }],
      },
    };

    return this.request<any>({
      method: 'POST',
      url: '/ms/product/tasks/price-stock-update',
      data: payload,
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders(this.config) },
    });
  }

  async getOrders(params: any = {}): Promise<any[]> {
    try {
      const query: Record<string, any> = {
        page: params.page || 0,
        size: params.size || 100,
      };
      if (params.status) query.status = params.status;
      if (params.startDate) query.startDate = params.startDate;
      if (params.endDate) query.endDate = params.endDate;
      if (params.orderNumber) query.orderNumber = params.orderNumber;

      const data = await this.request<any>({
        method: 'GET',
        url: '/rest/delivery/v1/shipmentPackages',
        params: query,
        headers: getAuthHeaders(this.config),
      });
      const content = data?.content || [];
      return Array.isArray(content) ? content : [];
    } catch {
      return [];
    }
  }

  async getOrder(orderId: string): Promise<any> {
    try {
      const data = await this.request<any>({
        method: 'GET',
        url: '/rest/delivery/v1/shipmentPackages',
        params: { packageIds: orderId },
        headers: getAuthHeaders(this.config),
      });
      const content = data?.content || [];
      return Array.isArray(content) && content.length > 0 ? content[0] : null;
    } catch {
      return null;
    }
  }
}

export function createN11Client(config: N11Config): N11Client {
  return new N11Client(config);
}
