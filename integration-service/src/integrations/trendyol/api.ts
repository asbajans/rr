import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';

export interface TrendyolCredentials {
  apiKey: string;
  apiSecret: string;
  supplierId: string;
}

let cachedOutboundIp = 'unknown';
try {
  fetch('https://api.ipify.org?format=json')
    .then((r: any) => r.json())
    .then((d: any) => { cachedOutboundIp = d?.ip ?? 'unknown'; })
    .catch(() => {});
} catch {
  /* ignore */
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
        'User-Agent': `${credentials.supplierId} - SelfIntegration`,
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
    const url = `/suppliers/${this.credentials.supplierId}/products`;
    console.log(`[trendyol] getProducts GET ${url} params=${JSON.stringify({ page, size })}`);
    try {
      // NOTE: Only `page` and `size` are valid here. An extra `approved`
      // query param previously caused Trendyol to reject with HTTP 403.
      const res = await this.client.get(url, { params: { page, size } });
      return res.data;
    } catch (err: any) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      const headers = err?.response?.headers;
      const code = err?.code;
      console.error(
        `[trendyol] getProducts FAILED status=${status} code=${code} ` +
        `headers=${JSON.stringify(headers)} body=${JSON.stringify(body)}`
      );
      const message =
        (body && (body.message || body.errorMessage || body.error)) ||
        err?.message ||
        'Unknown error';
      throw new Error(
        `Trendyol getProducts HTTP ${status}: ${message} ` +
        `(code=${code}, params=${JSON.stringify({ page, size })}, ` +
        `outboundIp=${cachedOutboundIp}, ` +
        `creds(apiKeyLen=${this.credentials.apiKey.length}, secretLen=${this.credentials.apiSecret.length}, supplierId=${this.credentials.supplierId || 'EMPTY'}), ` +
        `wwwAuthenticate=${headers?.['www-authenticate'] ?? headers?.['Www-Authenticate'] ?? 'n/a'})`
      );
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
