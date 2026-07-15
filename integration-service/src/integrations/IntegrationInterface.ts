import { ProductData, StockUpdate, PriceUpdate, Order, MarketplaceCategory } from '../types';

export abstract class IntegrationInterface {
  constructor(protected marketplaceName: string) {}

  get name(): string {
    return this.marketplaceName;
  }

  abstract sendProduct(data: ProductData): Promise<{ success: boolean; marketplaceId?: string; error?: string }>;

  abstract updateStock(sku: string, quantity: number): Promise<{ success: boolean; error?: string }>;

  abstract updatePrice(sku: string, price: number, currency: string): Promise<{ success: boolean; error?: string }>;

  abstract fetchOrders(sinceDate?: string): Promise<Order[]>;

  abstract fetchProducts(page?: number): Promise<ProductData[]>;

  abstract fetchCategories(): Promise<MarketplaceCategory[]>;

  /** Check whether a product exists on the marketplace. Override per-integration. */
  async verifyProduct(_data: ProductData): Promise<{ exists: boolean; marketplaceId?: string; error?: string; detail?: any }> {
    return { exists: false, error: 'Bu pazaryeri için doğrulama desteklenmiyor' };
  }

  /**
   * Push a cargo tracking number back to the marketplace.
   * Returns success:false with an explanatory error when not supported.
   */
  async updateTracking(_data: {
    externalId: string;
    trackingNumber: string;
    trackingCompany?: string;
  }): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: `${this.marketplaceName} için kargo bilgisi gönderimi desteklenmiyor` };
  }

  /**
   * Push an order status change back to the marketplace.
   * Returns success:false with an explanatory error when not supported.
   */
  async updateOrderStatus(_data: {
    externalId: string;
    status: string;
  }): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: `${this.marketplaceName} için sipariş durumu gönderimi desteklenmiyor` };
  }
}
