import { IntegrationInterface } from '../IntegrationInterface';
import { mapToN11Product, mapToN11CreatePayload, mapToN11PriceStockPayload } from './mapper';
import { ProductData, Order, MarketplaceCategory } from '../../types';
import { N11ApiClient } from './api';

export class N11IntegrationService extends IntegrationInterface {
  private api: N11ApiClient;

  constructor(appkey: string, appsecret: string) {
    super('n11');
    this.api = new N11ApiClient({ appkey, appsecret });
  }

  async fetchProducts(page: number = 0): Promise<ProductData[]> {
    try {
      const data = await this.api.getProducts(page, 50);
      const content = data?.content;
      const arr = Array.isArray(content) ? content : [];
      if (!arr.length) return [];
      console.log('[n11] sample raw product[0]:', JSON.stringify(arr[0]).slice(0, 600));
      return arr.map(mapToN11Product);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`N11 fetchProducts failed: ${message}`);
    }
  }

  async sendProduct(data: ProductData): Promise<{ success: boolean; marketplaceId?: string; error?: string }> {
    if (!data.category_id || Number(data.category_id) <= 0) {
      return { success: false, error: 'N11 sendProduct: product N11 category not set (category_id missing)' };
    }
    try {
      const payload = mapToN11CreatePayload(data, this.api.integratorName);
      const res = await this.api.createProduct(payload);
      const status = res?.status;
      const ok = status === 'IN_QUEUE' || status === 'SUCCESS' || status === 'PROCESSING';
      if (!ok) {
        return { success: false, error: `N11 CreateProduct: ${JSON.stringify(res?.reasons ?? res)}` };
      }
      return { success: true, marketplaceId: String(res?.id ?? data.sku) };
    } catch (err) {
      return { success: false, error: `N11 sendProduct: ${err instanceof Error ? err.message : 'Unknown'}` };
    }
  }

  async updateStock(sku: string, quantity: number): Promise<{ success: boolean; error?: string }> {
    try {
      const payload = mapToN11PriceStockPayload(sku, { quantity });
      const res = await this.api.updatePriceStock(payload);
      const ok = res?.status === 'IN_QUEUE' || res?.status === 'SUCCESS';
      return ok
        ? { success: true }
        : { success: false, error: `N11 UpdatePriceStock: ${JSON.stringify(res?.reasons ?? res)}` };
    } catch (err) {
      return { success: false, error: `N11 updateStock: ${err instanceof Error ? err.message : 'Unknown'}` };
    }
  }

  async updatePrice(sku: string, price: number, currency: string): Promise<{ success: boolean; error?: string }> {
    try {
      const payload = mapToN11PriceStockPayload(sku, { price, currency });
      const res = await this.api.updatePriceStock(payload);
      const ok = res?.status === 'IN_QUEUE' || res?.status === 'SUCCESS';
      return ok
        ? { success: true }
        : { success: false, error: `N11 UpdatePriceStock: ${JSON.stringify(res?.reasons ?? res)}` };
    } catch (err) {
      return { success: false, error: `N11 updatePrice: ${err instanceof Error ? err.message : 'Unknown'}` };
    }
  }

  async fetchOrders(_sinceDate?: string): Promise<Order[]> {
    console.warn('[n11] fetchOrders not supported in REST integration (out of product scope)');
    return [];
  }

  async fetchCategories(): Promise<MarketplaceCategory[]> {
    try {
      const data = await this.api.getCategories();
      return mapN11Categories(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`N11 fetchCategories failed: ${message}`);
    }
  }
}

/** Map the /cdn/categories response to a flat {id,name,parentId} list. */
export function mapN11Categories(data: any): MarketplaceCategory[] {
  const out: MarketplaceCategory[] = [];
  // Defensive: the response may be { categories: [...] } or a bare array.
  const list = Array.isArray(data) ? data : data?.categories ?? data?.data ?? [];
  const arr = Array.isArray(list) ? list : [];

  const walk = (nodes: any[], parentId: string | null) => {
    for (const n of nodes) {
      if (!n) continue;
      const id = String(n.id ?? n.categoryId ?? '');
      if (!id) continue;
      const name = String(n.name ?? n.categoryName ?? n.title ?? id);
      out.push({ id, name, parentId });
      const children = n.subCategories ?? n.subcategories ?? n.children ?? n.childCategories ?? [];
      if (Array.isArray(children) && children.length) {
        walk(children, id);
      }
    }
  };
  walk(arr, null);
  return out;
}
