import { ProductData, StockUpdate, PriceUpdate, Order } from '../types';

export abstract class IntegrationInterface {
  protected marketplaceName: string;

  constructor(name: string) {
    this.marketplaceName = name;
  }

  abstract sendProduct(data: ProductData): Promise<{ success: boolean; marketplaceId?: string; error?: string }>;

  abstract updateStock(sku: string, quantity: number): Promise<{ success: boolean; error?: string }>;

  abstract updatePrice(sku: string, price: number, currency: string): Promise<{ success: boolean; error?: string }>;

  abstract fetchOrders(sinceDate?: string): Promise<Order[]>;
}
