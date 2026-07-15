export interface ProductData {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  stock: number;
  category: string;
  category_id?: string;
  barcode?: string;
  brand?: string;
  images: string[];
  attributes: Record<string, string>;
  vendorId?: number;
  siteCode?: string;
}

export interface MarketplaceCategory {
  id: string | number;
  name: string;
  parentId: string | number | null;
}

export interface StockUpdate {
  sku: string;
  quantity: number;
  siteCode?: string;
  type?: string;
  price?: number;
}

export interface PriceUpdate {
  sku: string;
  price: number;
  currency: string;
  siteCode?: string;
}

export interface Order {
  id: string;
  marketplace: string;
  status: string;
  items: OrderItem[];
  customer: OrderCustomer;
  createdAt: string;
}

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  price: number;
}

export interface OrderCustomer {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
}

export type QueueName = 'product-push-queue' | 'stock-sync-queue';

export interface WebhookPayload {
  event: 'product.updated' | 'stock.updated' | 'price.updated';
  data: Record<string, unknown>;
}

export interface OrderDTO {
  externalId: string;
  marketplace: string;
  status: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
  };
  items: {
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    currency: string;
  }[];
  totals: {
    subtotal: number;
    shipping: number;
    tax: number;
    grandTotal: number;
  };
  createdAt: string;
  paidAt?: string;
  vendorId?: number;
}
