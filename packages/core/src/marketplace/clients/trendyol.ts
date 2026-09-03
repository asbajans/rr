import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { BaseMarketplaceClient, MarketplaceClient } from './base.js';

export interface TrendyolConfig {
  apiKey: string;
  apiSecret: string;
  supplierId: string;
  // Panelde görünen ek alanlar — entegrasyonda opsiyonel, ileride kargo/fatura servislerinde kullanılabilir
  cariId?: string;
  integrationRefCode?: string;
  token?: string;
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
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': config.supplierId,
      'Authorization': `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`,
    };
    this.orderClient = axios.create({
      baseURL: 'https://apigw.trendyol.com/integration/order',
      headers,
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

  async getApprovedProductsStockAndPrice(params: { page?: number; size?: number; nextPageToken?: string } = {}): Promise<{ items: any[]; hasMore: boolean; nextPageToken?: string }> {
    const { page = 0, size = 50, nextPageToken } = params as any;
    const query: any = { size };
    if (nextPageToken) query.nextPageToken = nextPageToken;
    else query.page = page;
    const data = await this.request<any>({
      method: 'GET',
      url: `/sellers/${this.config.supplierId}/products/approved/inventory-and-price`,
      params: query,
    });
    // Trendyol V2 returns `content: [{ contentId, productMainId, variants: [{ barcode, quantity, salePrice, listPrice, stockCode, ... }] }]`.
    // Flatten variants so callers can key by barcode directly. Also handle the (unlikely) flat variant shape.
    const flattened: any[] = [];
    for (const content of (data.content || [])) {
      if (Array.isArray((content as any).variants) && (content as any).variants.length > 0) {
        for (const variant of (content as any).variants) {
          flattened.push({
            barcode: variant.barcode,
            stockCode: variant.stockCode,
            quantity: variant.quantity ?? (variant as any).stock?.quantity ?? 0,
            salePrice: variant.salePrice ?? (variant as any).price?.salePrice ?? 0,
            listPrice: variant.listPrice ?? (variant as any).price?.listPrice ?? 0,
            onSale: (variant as any).onSale,
            productMainId: (content as any).productMainId,
            contentId: (content as any).contentId,
            variantId: variant.variantId,
            stockLastModifiedDate: (variant as any).stockLastModifiedDate ?? (variant as any).stock?.lastModifiedDate ?? null,
          });
        }
      } else if ((content as any).barcode) {
        flattened.push(content);
      }
    }
    return { items: flattened, hasMore: data.last ? false : true, nextPageToken: data.nextPageToken };
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
    // Trendyol brand API is paginated (page/size, min 1000 per page). Fetch all pages.
    // When search is provided, Trendyol's /brands/by-name is more efficient, but we keep list for full sync.
    if (search) {
      try {
        const data = await this.request<any>({ method: 'GET', url: `/brands/by-name`, params: { name: search } });
        const arr = Array.isArray(data) ? data : data?.brands || data?.content || [];
        return Array.isArray(arr) ? arr : [];
      } catch {
        // fallback to list search
        try {
          const data = await this.request<any>({ method: 'GET', url: `/brands`, params: { name: search, size: 1000, page: 0 } });
          return data?.brands || data?.content || [];
        } catch { return []; }
      }
    }
    const all: { id: number; name: string }[] = [];
    let page = 0;
    while (page < 100) {
      try {
        const data = await this.request<any>({ method: 'GET', url: `/brands`, params: { name: '', size: 1000, page } });
        const items = data?.brands || data?.content || [];
        if (!Array.isArray(items) || items.length === 0) break;
        all.push(...items);
        const totalPages = data?.totalPages;
        const totalElements = data?.totalElements;
        if (typeof totalPages === 'number' && page + 1 >= totalPages) break;
        if (typeof totalElements === 'number' && all.length >= totalElements) break;
        if (items.length < 1000) break;
        page++;
      } catch {
        break;
      }
    }
    return all;
  }

  async getOrders(params: { startDate?: string; endDate?: string; page?: number; size?: number; status?: string; orderByField?: string; orderByDirection?: string } = {}): Promise<any[]> {
    const url = `/sellers/${this.config.supplierId}/orders`;
    const data = await this.orderRequest<any>({ method: 'GET', url, params });
    return data.shipmentPackages || data.content || [];
  }

  async getOrdersV2(params: { startDate?: string; endDate?: string; page?: number; size?: number; status?: string; orderByField?: string; orderByDirection?: string } = {}): Promise<{ content: any[]; last: boolean; totalElements: number }> {
    const url = `/sellers/${this.config.supplierId}/v2/orders`;
    const data = await this.orderRequest<any>({ method: 'GET', url, params });
    return { content: data.content || [], last: data.last !== false, totalElements: data.totalElements || 0 };
  }

  async getOrdersStream(params: { startDate?: string; endDate?: string; size?: number; status?: string } = {}): Promise<AsyncGenerator<any[], void, undefined>> {
    const size = params.size || 50;
    let hasMore = true;
    let cursor: string | null = null;

    async function* gen(client: TrendyolClient, supplierId: string) {
      while (hasMore) {
        const query: any = { ...params, size };
        if (cursor) query.cursor = cursor;
        const url = `/sellers/${supplierId}/v2/orders`;
        const data = await client['orderRequest']<any>({ method: 'GET', url, params: query });
        const items = data.content || [];
        if (items.length > 0) yield items;
        hasMore = data.last === false && items.length > 0;
        if (hasMore) cursor = items[items.length - 1]?.id;
        else break;
      }
    }
    return gen(this, this.config.supplierId);
  }

  async getOrder(orderId: string): Promise<any> {
    const url = `/sellers/${this.config.supplierId}/orders/${orderId}`;
    return this.orderRequest<any>({ method: 'GET', url });
  }

  async getOrderByPackageId(packageId: string): Promise<any> {
    const url = `/sellers/${this.config.supplierId}/shipment-packages/${packageId}`;
    return this.orderRequest<any>({ method: 'GET', url });
  }

  async getPackageStatus(orderNumber: string, packageId?: string): Promise<string | null> {
    try {
      const data = await this.orderRequest<any>({
        method: 'GET',
        url: `/sellers/${this.config.supplierId}/orders`,
        params: { orderNumber, size: 10 },
      });
      const packages = data.shipmentPackages || data.content || [];
      const pkg = packageId
        ? packages.find((p: any) => String(p.id) === String(packageId))
        : packages[0];
      return pkg?.status || pkg?.shipmentPackageStatus || null;
    } catch {
      return null;
    }
  }

  async updatePackageStatus(packageId: string, status: string, lines: Array<{ lineId: number; quantity: number }> = []): Promise<any> {
    return this.orderRequest<any>({
      method: 'PUT',
      url: `/sellers/${this.config.supplierId}/shipment-packages/${packageId}`,
      data: { status, lines },
    });
  }

  async approveOrder(packageId: string, lines?: Array<{ lineId: number; quantity: number }>): Promise<any> {
    let payloadLines = lines;
    if (!payloadLines || payloadLines.length === 0) {
      const pkg = await this.getOrderByPackageId(packageId).catch(() => null);
      payloadLines = (pkg?.lines || []).map((line: any) => ({
        lineId: line.id,
        quantity: line.quantity || 1,
      }));
    }
    return this.updatePackageStatus(packageId, 'Picking', payloadLines);
  }

  async cancelOrder(orderId: string, reason: string = 'OUT_OF_STOCK'): Promise<any> {
    return this.orderRequest<any>({
      method: 'PUT',
      url: `/sellers/${this.config.supplierId}/orders/${orderId}/cancel`,
      data: { cancelReason: reason },
    });
  }

  async updateOrderStatus(orderId: string, status: string): Promise<any> {
    if (status === 'approved' || status === 'Picking' || status === 'Created') {
      return this.approveOrder(orderId);
    } else if (status === 'Cancelled' || status === 'cancelled') {
      return this.cancelOrder(orderId);
    }
    throw new Error(`Trendyol does not support manual status change to '${status}'. Only approve and cancel are allowed.`);
  }

  async getOrderLabel(arg: string | { packageId?: string; trackingNumber?: string }): Promise<{ labelUrl?: string; labelZpl?: string; cargoCompany?: string; reason?: string } | null> {
    const options = typeof arg === 'string' ? { packageId: arg } : arg;
    const packageId = options.packageId;
    const trackingNumber = options.trackingNumber;

    const sellerBase = `https://apigw.trendyol.com/integration/sellers/${this.config.supplierId}`;
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': this.config.supplierId,
      'Authorization': `Basic ${Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString('base64')}`,
    };

    if (trackingNumber) {
      try {
        const response = await axios.get(`${sellerBase}/common-label/query`, {
          params: { id: trackingNumber },
          headers,
          timeout: 30000,
        });
        const labels = response.data?.data || [];
        if (labels.length > 0 && labels[0]?.label) {
          return { labelUrl: labels[0].label, cargoCompany: '' };
        }
      } catch {}
    }

    if (packageId) {
      try {
        const create = await axios.post(`${sellerBase}/common-labels`, { packageIds: [packageId] }, { headers, timeout: 30000 });
        const eccode = create.data?.eccode;
        if (eccode) {
          try {
            const zplResp = await axios.get(`${sellerBase}/common-label/${eccode}`, { headers, timeout: 30000, responseType: 'text' });
            if (typeof zplResp.data === 'string' && zplResp.data.includes('^XA')) {
              return { labelZpl: zplResp.data };
            }
          } catch {}
        }
      } catch (createErr: any) {
        const status = createErr?.response?.status;
        const body = JSON.stringify(createErr?.response?.data || '');
        if (status === 401 || status === 556 || body.includes('COMMON_LABEL_NOT_ALLOWED') || body.includes('UNAUTHORIZED')) {
          return { reason: 'Etiket servisi bu hesap için Trendyol API yetkisi içermiyor. Etiketi Trendyol panelinden indirin.' };
        }
      }
    }

    return null;
  }

  private async orderRequest<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.orderClient.request<T>(config);
    return response.data;
  }
}

export function createTrendyolClient(config: TrendyolConfig): TrendyolClient {
  return new TrendyolClient(config);
}