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
}
