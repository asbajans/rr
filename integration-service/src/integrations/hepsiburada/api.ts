import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';

export interface HepsiburadaCredentials {
  username: string;
  password: string;
  merchantId: string;
}

export class HepsiburadaApiClient {
  private mpop: AxiosInstance;
  private listing: AxiosInstance;
  private creds: HepsiburadaCredentials;
  private requestCount: number = 0;
  private lastReset: number = Date.now();

  private readonly RATE_LIMIT = 50;
  private readonly RATE_WINDOW_MS = 60_000;

  constructor(credentials: HepsiburadaCredentials) {
    this.creds = credentials;
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`;
    const userAgent = `${credentials.merchantId} - SelfIntegration`;

    const common = {
      timeout: 30_000,
      headers: {
        Authorization: authHeader,
        'User-Agent': userAgent,
        'Content-Type': 'application/json',
      },
    };

    this.mpop = axios.create({ baseURL: 'https://mpop.hepsiburada.com', ...common });
    this.listing = axios.create({ baseURL: 'https://listing-external.hepsiburada.com', ...common });

    const retry = {
      retries: 3,
      retryDelay: (n: number) => n * 2000,
      retryCondition: (err: any) => err.response?.status === 429 || (err.response?.status ?? 0) >= 500,
    };
    axiosRetry(this.mpop, retry);
    axiosRetry(this.listing, retry);
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    if (now - this.lastReset >= this.RATE_WINDOW_MS) {
      this.requestCount = 0;
      this.lastReset = now;
    }
    if (this.requestCount >= this.RATE_LIMIT) {
      await new Promise((resolve) => setTimeout(resolve, this.RATE_WINDOW_MS - (now - this.lastReset) + 1000));
      this.requestCount = 0;
      this.lastReset = Date.now();
    }
    this.requestCount++;
  }

  /** Catalog product import. Body: array of product objects. Returns { trackingId }. */
  async importProducts(payload: unknown): Promise<any> {
    await this.enforceRateLimit();
    const res = await this.mpop.post('/product/api/products/import', payload);
    return res.data;
  }

  async getImportStatus(trackingId: string): Promise<any> {
    await this.enforceRateLimit();
    const res = await this.mpop.get(`/product/api/products/status/${trackingId}`);
    return res.data;
  }

  /** Seller listings (price/stock/status). */
  async getListings(page: number = 0, size: number = 50): Promise<any> {
    await this.enforceRateLimit();
    try {
      const res = await this.listing.get(`/listings/merchantid/${this.creds.merchantId}`, {
        params: { page, size },
      });
      return res.data;
    } catch (err: any) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      console.error(`[hb] getListings FAILED status=${status} body=${JSON.stringify(body)}`);
      throw new Error(`HB getListings HTTP ${status}: ${body?.message || err?.message || 'Unknown'}`);
    }
  }

  /** Update stock/price for a single listing. */
  async updateListing(sku: string, body: { availableStock?: number; price?: number }): Promise<any> {
    await this.enforceRateLimit();
    const res = await this.listing.put(
      `/listings/merchantid/${this.creds.merchantId}/sku/${encodeURIComponent(sku)}`,
      body
    );
    return res.data;
  }

  get merchantId(): string {
    return this.creds.merchantId;
  }
}
