import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';

export interface N11Credentials {
  appkey: string;
  appsecret: string;
}

const INTEGRATOR = process.env.N11_INTEGRATOR || 'Rahatio';

export class N11ApiClient {
  private client: AxiosInstance;
  private credentials: N11Credentials;
  private requestCount: number = 0;
  private lastReset: number = Date.now();

  // Conservative limit; N11 does not publish an explicit rate limit.
  private readonly RATE_LIMIT = 80;
  private readonly RATE_WINDOW_MS = 60_000;

  constructor(credentials: N11Credentials) {
    this.credentials = credentials;

    this.client = axios.create({
      baseURL: 'https://api.n11.com',
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        appkey: credentials.appkey,
        appsecret: credentials.appsecret,
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

  /** Seller product list (import). Response: { content:[...], totalPages, ... } */
  async getProducts(page: number = 0, size: number = 50): Promise<any> {
    await this.enforceRateLimit();
    try {
      const res = await this.client.get('/ms/product-query', {
        params: { page, size },
      });
      return res.data;
    } catch (err: any) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      console.error(
        `[n11] getProducts FAILED status=${status} body=${JSON.stringify(body)}`
      );
      throw new Error(
        `N11 getProducts HTTP ${status}: ${body?.message || body?.errorMessage || err?.message || 'Unknown error'}`
      );
    }
  }

  /** Create products. Body: { payload: { integrator, skus:[...] } } */
  async createProduct(payload: unknown): Promise<any> {
    await this.enforceRateLimit();
    try {
      const res = await this.client.post('/ms/product/tasks/product-create', payload);
      return res.data;
    } catch (err: any) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      console.error(
        `[n11] createProduct FAILED status=${status} body=${JSON.stringify(body)} payload=${JSON.stringify(payload)}`
      );
      throw err;
    }
  }

  /** Price + stock update. Body: { payload: { integrator, skus:[...] } } */
  async updatePriceStock(payload: unknown): Promise<any> {
    await this.enforceRateLimit();
    try {
      const res = await this.client.post('/ms/product/tasks/price-stock-update', payload);
      return res.data;
    } catch (err: any) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      console.error(
        `[n11] updatePriceStock FAILED status=${status} body=${JSON.stringify(body)} payload=${JSON.stringify(payload)}`
      );
      throw err;
    }
  }

  /** Category tree. Response: { categories:[...] } (shape may vary) */
  async getCategories(): Promise<any> {
    await this.enforceRateLimit();
    try {
      const res = await this.client.get('/cdn/categories');
      return res.data;
    } catch (err: any) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      console.error(`[n11] getCategories FAILED status=${status} body=${JSON.stringify(body)}`);
      throw new Error(`N11 getCategories HTTP ${status}: ${body?.message || err?.message || 'Unknown error'}`);
    }
  }

  async getTaskDetails(id: string | number): Promise<any> {
    await this.enforceRateLimit();
    const res = await this.client.post('/ms/product/task-details/page-query', {
      payload: { taskId: id },
    });
    return res.data;
  }

  get integratorName(): string {
    return INTEGRATOR;
  }
}
