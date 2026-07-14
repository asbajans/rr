import { IntegrationInterface } from '../IntegrationInterface';
import { ProductData, Order, MarketplaceCategory } from '../../types';
import { HepsiburadaApiClient } from './api';
import { mapToHepsiburadaCreatePayload, mapToHepsiburadaProduct } from './mapper';

export class HepsiburadaIntegrationService extends IntegrationInterface {
  private api: HepsiburadaApiClient;

  constructor(username: string, password: string, merchantId: string) {
    super('hepsiburada');
    this.api = new HepsiburadaApiClient({ username, password, merchantId });
  }

  async sendProduct(data: ProductData): Promise<{ success: boolean; marketplaceId?: string; error?: string }> {
    try {
      const payload = [mapToHepsiburadaCreatePayload(data, this.api.merchantId)];
      const res = await this.api.importProducts(payload);
      const trackingId = res?.trackingId ?? res?.tracking_id ?? '';
      if (!trackingId && !(res?.status === 'OK' || res?.httpStatus === 200)) {
        return { success: false, error: `HB import rejected: ${JSON.stringify(res)}` };
      }
      return { success: true, marketplaceId: trackingId };
    } catch (err: any) {
      return { success: false, error: err?.message || 'HB sendProduct failed' };
    }
  }

  async updateStock(sku: string, quantity: number): Promise<{ success: boolean; error?: string }> {
    try {
      await this.api.updateListing(sku, { availableStock: Number(quantity) });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'HB updateStock failed' };
    }
  }

  async updatePrice(sku: string, price: number, currency: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.api.updateListing(sku, { price: Number(price) });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'HB updatePrice failed' };
    }
  }

  async fetchProducts(page: number = 0): Promise<ProductData[]> {
    try {
      const res = await this.api.getListings(page, 50);
      const raw = Array.isArray(res?.listings)
        ? res.listings
        : Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res)
            ? res
            : [];
      if (page === 0 && raw[0]) {
        console.log('[hb] sample raw listing[0]:', JSON.stringify(raw[0]).slice(0, 1200));
      }
      return raw.map((p: any) => mapToHepsiburadaProduct(p));
    } catch (err: any) {
      console.error('[hb] fetchProducts error:', err?.message);
      return [];
    }
  }

  async fetchOrders(sinceDate?: string): Promise<Order[]> {
    console.warn('[hb] fetchOrders not implemented');
    return [];
  }

  async fetchCategories(): Promise<MarketplaceCategory[]> {
    console.warn('[hb] fetchCategories not implemented (verify HB category endpoint)');
    return [];
  }
}
