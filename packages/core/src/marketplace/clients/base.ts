import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import crypto from 'crypto';

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

  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    this.client = axios.create({
      baseURL,
      headers: { 'Content-Type': 'application/json', ...defaultHeaders },
      timeout: 30000,
    });
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

export function generateHmacSHA256(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64');
}

export function generateHmacSHA256Hex(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}