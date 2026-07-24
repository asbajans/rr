import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';

function redactSensitiveHeaders(headers: Record<string, any>): Record<string, any> {
  const sensitive = ['authorization', 'x-api-key', 'cookie', 'set-cookie', 'client-secret', 'appsecret'];
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(headers)) {
    result[k] = sensitive.includes(k.toLowerCase()) ? '***' : v;
  }
  return result;
}

export interface MarketplaceClient {
  getCategories(): Promise<any[]>;
  getProducts(params?: any): Promise<{ products: any[]; hasMore: boolean }>;
  createProduct(product: any): Promise<any>;
  updateProduct(productId: string, product: any): Promise<any>;
  updatePrice(productId: string, price: number): Promise<any>;
  updateStock(productId: string, quantity: number): Promise<any>;
  getOrders(params?: any): Promise<any[]>;
  getOrder(orderId: string): Promise<any>;
}

export abstract class BaseMarketplaceClient implements MarketplaceClient {
  protected client: AxiosInstance;
  protected marketplaceName: string = 'unknown';

  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    this.client = axios.create({
      baseURL,
      headers: { 'Content-Type': 'application/json', ...defaultHeaders },
      timeout: 30000,
    });

    this.client.interceptors.request.use((req) => {
      const url = `${req.baseURL || ''}${req.url || ''}`;
      const body = req.data ? (typeof req.data === 'string' ? req.data.substring(0, 500) : JSON.stringify(req.data).substring(0, 500)) : undefined;
      logger.info({
        marketplace: this.marketplaceName,
        httpRequest: {
          method: req.method?.toUpperCase(),
          url,
          headers: redactSensitiveHeaders(req.headers as Record<string, any>),
          body: body ? body + (body.length >= 500 ? '...' : '') : undefined,
        },
      }, `[${this.marketplaceName}] → ${req.method?.toUpperCase()} ${url}`);
      return req;
    });

    this.client.interceptors.response.use(
      (res) => {
        const body = typeof res.data === 'string' ? res.data.substring(0, 2000) : JSON.stringify(res.data).substring(0, 2000);
        logger.info({
          marketplace: this.marketplaceName,
          httpResponse: {
            status: res.status,
            body: body + (body.length >= 2000 ? '...' : ''),
          },
        }, `[${this.marketplaceName}] ← ${res.status}`);
        return res;
      },
      (err) => {
        const req = err.config || {};
        const url = `${req.baseURL || ''}${req.url || ''}`;
        const resBody = err.response?.data ? (typeof err.response.data === 'string' ? err.response.data.substring(0, 2000) : JSON.stringify(err.response.data).substring(0, 2000)) : undefined;
        logger.error({
          marketplace: this.marketplaceName,
          httpError: {
            method: req.method?.toUpperCase(),
            url,
            status: err.response?.status,
            statusText: err.response?.statusText,
            responseBody: resBody,
            message: err.message,
          },
        }, `[${this.marketplaceName}] ✗ ${req.method?.toUpperCase()} ${url} → ${err.response?.status || 'ERR'}`);
        return Promise.reject(err);
      }
    );
  }

  abstract getCategories(): Promise<any[]>;
  abstract getProducts(params?: any): Promise<{ products: any[]; hasMore: boolean }>;
  abstract createProduct(product: any): Promise<any>;
  abstract updateProduct(productId: string, product: any): Promise<any>;
  abstract updatePrice(productId: string, price: number): Promise<any>;
  abstract updateStock(productId: string, quantity: number): Promise<any>;
  abstract getOrders(params?: any): Promise<any[]>;
  abstract getOrder(orderId: string): Promise<any>;

  protected async request<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<T>(config);
    return response.data;
  }
}

export function generateHmacSHA256Hex(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}