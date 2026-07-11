import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';

export interface TrendyolCredentials {
  apiKey: string;
  apiSecret: string;
  supplierId: string;
}

export class TrendyolApiClient {
  private client: AxiosInstance;
  private credentials: TrendyolCredentials;
  private requestCount: number = 0;
  private lastReset: number = Date.now();

  private readonly RATE_LIMIT = 100;
  private readonly RATE_WINDOW_MS = 60_000;

  constructor(credentials: TrendyolCredentials) {
    this.credentials = credentials;

    this.client = axios.create({
      baseURL: 'https://api.trendyol.com/sapigw',
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString('base64')}`,
      },
    });

    axiosRetry(this.client, {
      retries: 3,
      retryDelay: (retryCount) => retryCount * 2000,
      retryCondition: (error) => {
        return error.response?.status === 429 || (error.response?.status ?? 0) >= 500;
      },
    });
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    if (now - this.lastReset >= this.RATE_WINDOW_MS) {
      this.requestCount = 0;
      this.lastReset = now;
    }

    if (this.requestCount >= this.RATE_LIMIT) {
      const waitMs = this.RATE_WINDOW_MS - (now - this.lastReset);
      await new Promise((resolve) => setTimeout(resolve, waitMs + 1000));
      this.requestCount = 0;
      this.lastReset = Date.now();
    }

    this.requestCount++;
  }

  async createProduct(productPayload: unknown): Promise<unknown> {
    await this.enforceRateLimit();
    const res = await this.client.post(
      `/suppliers/${this.credentials.supplierId}/products`,
      productPayload
    );
    return res.data;
  }

  async updateStock(items: { barcode: string; quantity: number }[]): Promise<unknown> {
    await this.enforceRateLimit();
    const res = await this.client.put(
      `/suppliers/${this.credentials.supplierId}/stock-updates`,
      { items }
    );
    return res.data;
  }

  async updatePrice(items: { barcode: string; price: number }[]): Promise<unknown> {
    await this.enforceRateLimit();
    const res = await this.client.put(
      `/suppliers/${this.credentials.supplierId}/price-updates`,
      { items }
    );
    return res.data;
  }

  async getProducts(page: number = 0, size: number = 50): Promise<unknown> {
    await this.enforceRateLimit();
    try {
      const res = await this.client.get(
        `/suppliers/${this.credentials.supplierId}/products`,
        { params: { page, size, approved: true } }
      );
      return res.data;
    } catch (err: any) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      const message =
        (body && (body.message || body.errorMessage || body.error)) ||
        err?.message ||
        'Unknown error';
      throw new Error(`Trendyol getProducts HTTP ${status}: ${message}`);
    }
  }

  async getOrders(status?: string): Promise<unknown> {
    await this.enforceRateLimit();
    const params: Record<string, string> = {};
    if (status) params.status = status;
    const res = await this.client.get(
      `/suppliers/${this.credentials.supplierId}/orders`,
      { params }
    );
    return res.data;
  }
}
