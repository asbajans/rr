import { IntegrationInterface } from '../IntegrationInterface';
import { ProductData, Order } from '../../types';
import axios from 'axios';

export class HepsiburadaIntegrationService extends IntegrationInterface {
  private baseUrl: string;
  private authHeader: string;

  constructor(username: string, password: string) {
    super('hepsiburada');
    this.baseUrl = 'https://api.hepsiburada.com';
    this.authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  async sendProduct(data: ProductData): Promise<{ success: boolean; marketplaceId?: string; error?: string }> {
    try {
      const res = await axios.post(`${this.baseUrl}/products`, data, {
        headers: { Authorization: this.authHeader },
      });
      return { success: true, marketplaceId: String(res.data?.id || '') };
    } catch (err) {
      return { success: false, error: `HB sendProduct: ${err instanceof Error ? err.message : 'Unknown'}` };
    }
  }

  async updateStock(sku: string, quantity: number): Promise<{ success: boolean; error?: string }> {
    try {
      await axios.put(`${this.baseUrl}/stock`, { sku, quantity }, {
        headers: { Authorization: this.authHeader },
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: `HB updateStock: ${err instanceof Error ? err.message : 'Unknown'}` };
    }
  }

  async updatePrice(sku: string, price: number, _currency: string): Promise<{ success: boolean; error?: string }> {
    try {
      await axios.put(`${this.baseUrl}/price`, { sku, price }, {
        headers: { Authorization: this.authHeader },
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: `HB updatePrice: ${err instanceof Error ? err.message : 'Unknown'}` };
    }
  }

  async fetchOrders(sinceDate?: string): Promise<Order[]> {
    const params: Record<string, string> = {};
    if (sinceDate) params.startDate = sinceDate;

    const res = await axios.get(`${this.baseUrl}/orders`, {
      headers: { Authorization: this.authHeader },
      params,
    });

    const rawOrders = (res.data?.orders || []) as any[];
    return rawOrders.map((o) => ({
      id: String(o.id || ''),
      marketplace: 'hepsiburada',
      status: o.status || '',
      items: (o.items || []).map((i: any) => ({
        sku: i.productCode || '',
        name: i.productName || '',
        quantity: i.quantity || 0,
        price: Number(i.unitPrice) || 0,
      })),
      customer: {
        name: o.customer?.name || '',
        email: o.customer?.email || '',
        phone: o.customer?.phone || '',
      },
      createdAt: o.createdAt || '',
    }));
  }
}
