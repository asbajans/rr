import { IntegrationInterface } from '../IntegrationInterface';
import { mapToPazaramaProduct } from './mapper';
import { ProductData, StockUpdate, PriceUpdate, Order } from '../../types';
import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';

interface PazaramaCredentials {
  clientId: string;
  clientSecret: string;
  apiKey: string;
}

export class PazaramaIntegrationService extends IntegrationInterface {
  private client: AxiosInstance;
  private creds: PazaramaCredentials;
  private token: string | null = null;
  private tokenExpiry = 0;

  private readonly BASE_URL = 'https://isortagimapi.pazarama.com';
  private readonly AUTH_URL = 'https://isortagimgiris.pazarama.com/connect/token';

  constructor(clientId: string, clientSecret: string, apiKey: string) {
    super('pazarama');
    this.creds = { clientId, clientSecret, apiKey };

    this.client = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
    });

    axiosRetry(this.client, {
      retries: 3,
      retryDelay: (n) => n * 1500,
      retryCondition: (err) =>
        err.response?.status === 429 || (err.response?.status ?? 0) >= 500,
    });
  }

  private async ensureToken(): Promise<void> {
    if (this.token && Date.now() < this.tokenExpiry) return;

    const res = await axios.post(
      this.AUTH_URL,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.creds.clientId,
        client_secret: this.creds.clientSecret,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const expiresIn = Number(res.data?.expires_in ?? 3600);
    this.token = res.data?.access_token;
    this.tokenExpiry = Date.now() + (expiresIn - 60) * 1000;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    await this.ensureToken();
    return {
      Authorization: `Bearer ${this.token}`,
      APIKey: this.creds.apiKey,
    };
  }

  async sendProduct(data: ProductData): Promise<{ success: boolean; marketplaceId?: string; error?: string }> {
    try {
      const res = await this.client.post('/product', [data], { headers: await this.authHeaders() });
      return { success: true, marketplaceId: String(res.data?.[0]?.id ?? '') };
    } catch (err) {
      return { success: false, error: `Pazarama sendProduct: ${err instanceof Error ? err.message : 'Unknown'}` };
    }
  }

  async updateStock(sku: string, quantity: number): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.put('/product/stock', { code: sku, stock: quantity }, { headers: await this.authHeaders() });
      return { success: true };
    } catch (err) {
      return { success: false, error: `Pazarama updateStock: ${err instanceof Error ? err.message : 'Unknown'}` };
    }
  }

  async updatePrice(sku: string, price: number, currency: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.put('/product/price', { code: sku, price, currency }, { headers: await this.authHeaders() });
      return { success: true };
    } catch (err) {
      return { success: false, error: `Pazarama updatePrice: ${err instanceof Error ? err.message : 'Unknown'}` };
    }
  }

  async fetchOrders(sinceDate?: string): Promise<Order[]> {
    try {
      const params: Record<string, string> = {};
      if (sinceDate) params.startDate = sinceDate;
      const res = await this.client.get('/orders', { params, headers: await this.authHeaders() });
      const raw = (res.data?.items ?? res.data?.orders ?? []) as any[];
      return raw.map((o) => ({
        id: String(o.id ?? ''),
        marketplace: 'pazarama',
        status: o.status ?? '',
        items: (o.items ?? []).map((i: any) => ({
          sku: i.productCode ?? i.code ?? '',
          name: i.productName ?? i.title ?? '',
          quantity: Number(i.quantity ?? 0),
          price: Number(i.price ?? 0),
        })),
        customer: { name: o.customerName ?? '', email: o.customerEmail ?? '' },
        createdAt: o.orderDate ?? o.createdAt ?? '',
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Pazarama fetchOrders failed: ${message}`);
    }
  }

  async fetchProducts(page: number = 0): Promise<ProductData[]> {
    try {
      const res = await this.client.get('/product', {
        params: { page: page + 1, size: 50, approved: true },
        headers: await this.authHeaders(),
      });

      const items = (res.data?.items ?? res.data?.products ?? res.data ?? []) as any[];
      if (!Array.isArray(items)) return [];
      return items.map(mapToPazaramaProduct);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Pazarama fetchProducts failed: ${message}`);
    }
  }
}
