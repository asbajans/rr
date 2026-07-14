import { IntegrationInterface } from '../IntegrationInterface';
import { TrendyolApiClient } from './api';
import { mapToTrendyolProduct } from './mapper';
import { ProductData, StockUpdate, PriceUpdate, Order, MarketplaceCategory } from '../../types';

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
          images: [
            ...(Array.isArray(p.images) ? p.images : []),
            ...(Array.isArray(p.imageUrls) ? p.imageUrls : []),
          ]
            .map((i: any) => (typeof i === 'string' ? i : i?.url))
            .filter(Boolean),
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

          const images = [
            ...base.images,
            ...(Array.isArray(v.images) ? v.images : []),
            ...(Array.isArray(v.imageUrls) ? v.imageUrls : []),
          ]
            .map((i: any) => (typeof i === 'string' ? i : i?.url))
            .filter(Boolean);
          const uniqueImages = images.filter((u: string, idx: number) => images.indexOf(u) === idx);

          items.push({
            ...base,
            id: String(v.variantId ?? v.barcode ?? p.productMainId ?? p.id ?? ''),
            sku: String(v.stockCode ?? v.barcode ?? p.productMainId ?? ''),
            name: v.title ?? p.title ?? '',
            description: v.description ?? base.description ?? '',
            price: Number(
              v?.price?.salePrice ??
                v?.price?.listPrice ??
                v?.salePrice ??
                v?.listPrice ??
                v?.price ??
                p?.price?.salePrice ??
                p?.salePrice ??
                p?.price ??
                0
            ),
            currency: 'TRY',
            stock: Number(
              v?.stock?.quantity ??
                v?.quantity ??
                v?.stockQuantity ??
                p?.stock?.quantity ??
                p?.quantity ??
                0
            ),
            barcode: v.barcode ?? undefined,
            images: uniqueImages,
            attributes: { ...baseAttributes, ...variantAttrs },
          });
        }
      }
      if (products.length > 0) {
        console.log('[trendyol] sample raw product[0]:', JSON.stringify(products[0]).slice(0, 3000));
      }
      return items;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Trendyol fetchProducts failed: ${message}`);
    }
  }

  async fetchCategories(): Promise<MarketplaceCategory[]> {
    const raw = (await this.api.getCategories()) as any;
    const nodes: any[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.categories) ? raw.categories : []);

    const flat: MarketplaceCategory[] = [];
    const walk = (list: any[]) => {
      for (const n of list || []) {
        if (n == null) continue;
        flat.push({
          id: String(n.id ?? ''),
          name: String(n.name ?? ''),
          parentId: n.parentId != null && n.parentId !== 0 ? String(n.parentId) : null,
        });
        if (Array.isArray(n.subCategories) && n.subCategories.length) {
          walk(n.subCategories);
        }
      }
    };
    walk(nodes);

    if (nodes.length > 0) {
      console.log(`[trendyol] fetched ${flat.length} categories`);
    }
    return flat;
  }
}
