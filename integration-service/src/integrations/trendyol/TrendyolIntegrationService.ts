import { IntegrationInterface } from '../IntegrationInterface';
import { TrendyolApiClient } from './api';
import { mapToTrendyolProduct } from './mapper';
import { ProductData, StockUpdate, PriceUpdate, Order } from '../../types';

export class TrendyolIntegrationService extends IntegrationInterface {
  private api: TrendyolApiClient;

  constructor(apiKey: string, apiSecret: string, supplierId: string) {
    super('trendyol');
    this.api = new TrendyolApiClient({ apiKey, apiSecret, supplierId });
  }

  async sendProduct(data: ProductData): Promise<{ success: boolean; marketplaceId?: string; error?: string }> {
    try {
      const payload = mapToTrendyolProduct(data);
      const result = await this.api.createProduct(payload) as { content?: { id?: string } };
      return { success: true, marketplaceId: result?.content?.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: `Trendyol sendProduct failed: ${message}` };
    }
  }

  async updateStock(sku: string, quantity: number): Promise<{ success: boolean; error?: string }> {
    try {
      await this.api.updateStock([{ barcode: sku, quantity }]);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: `Trendyol updateStock failed: ${message}` };
    }
  }

  async updatePrice(sku: string, price: number, _currency: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.api.updatePrice([{ barcode: sku, price }]);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: `Trendyol updatePrice failed: ${message}` };
    }
  }

  async fetchOrders(sinceDate?: string): Promise<Order[]> {
    try {
      const result = await this.api.getOrders() as { content?: any[] };
      const orders = result?.content || [];
      return orders.map((o: any) => ({
        id: String(o.id || ''),
        marketplace: 'trendyol',
        status: o.status || '',
        items: (o.items || []).map((i: any) => ({
          sku: i.productCode || '',
          name: i.productName || '',
          quantity: i.quantity || 0,
          price: Number(i.price) || 0,
        })),
        customer: {
          name: o.customerName || '',
          email: o.customerEmail || '',
        },
        createdAt: o.orderDate || '',
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Trendyol fetchOrders failed: ${message}`);
    }
  }

  async fetchProducts(page: number = 0): Promise<ProductData[]> {
    try {
      const result = (await this.api.getProducts(page, 50)) as any;
      let products: any[] = [];
      if (Array.isArray(result?.content)) {
        // V2: content is an array of products, each with variants[]
        products = result.content;
      } else if (Array.isArray(result?.content?.products)) {
        products = result.content.products;
      } else if (Array.isArray(result?.products)) {
        products = result.products;
      }

      const items: ProductData[] = [];
      for (const p of products) {
        const baseAttributes = Array.isArray(p.attributes)
          ? p.attributes.reduce((acc: Record<string, string>, a: any) => {
              const key = a.attributeName ?? String(a.attributeId ?? '');
              const val = a.attributeValue ?? a.customAttributeValue ?? '';
              if (key) acc[key] = String(val);
              return acc;
            }, {})
          : {};

        const base = {
          name: p.title ?? '',
          description: p.description ?? '',
          category: String(p.category?.name ?? p.categoryName ?? p.pimCategoryId ?? ''),
          brand: p.brand?.name ?? p.brand ?? undefined,
          images: Array.isArray(p.images)
            ? p.images.map((i: any) => (typeof i === 'string' ? i : i?.url)).filter(Boolean)
            : [],
          attributes: baseAttributes,
        };

        const variants: any[] = Array.isArray(p.variants) ? p.variants : [p];

        for (const v of variants) {
          const variantAttrs = Array.isArray(v.attributes)
            ? v.attributes.reduce((acc: Record<string, string>, a: any) => {
                const key = a.attributeName ?? String(a.attributeId ?? '');
                const val = a.attributeValue ?? a.customAttributeValue ?? '';
                if (key) acc[key] = String(val);
                return acc;
              }, {})
            : {};

          items.push({
            ...base,
            id: String(v.variantId ?? v.barcode ?? p.productMainId ?? p.id ?? ''),
            sku: String(v.stockCode ?? v.barcode ?? p.productMainId ?? ''),
            name: v.title ?? p.title ?? '',
            price: Number(
              v?.price?.salePrice ??
                v?.price?.listPrice ??
                v?.salePrice ??
                v?.listPrice ??
                p?.price?.salePrice ??
                0
            ),
            currency: 'TRY',
            stock: Number(v?.stock?.quantity ?? v?.quantity ?? p?.stock?.quantity ?? 0),
            barcode: v.barcode ?? undefined,
            attributes: { ...baseAttributes, ...variantAttrs },
          });
        }
      }
      return items;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Trendyol fetchProducts failed: ${message}`);
    }
  }
}
