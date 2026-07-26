export interface NormalizedOrder {
  marketplace: string;
  marketplaceOrderId: string;
  marketplaceOrderNumber?: string;
  status: string;
  totalAmount: number;
  currency: string;
  items: NormalizedOrderItem[];
  customer: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
  };
  createdAt: string;
  rawPayload: any;
}

interface NormalizedOrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

function mapStatus(marketplace: string, status: string): string {
  const statusMap: Record<string, Record<string, string>> = {
    trendyol: {
      Created: 'pending',
      Picking: 'processing',
      Invoiced: 'confirmed',
      Shipped: 'shipped',
      Delivered: 'delivered',
      Cancelled: 'cancelled',
      Returned: 'returned',
    },
    hepsiburada: {
      Created: 'pending',
      Preparing: 'processing',
      Shipped: 'shipped',
      Delivered: 'delivered',
      Cancelled: 'cancelled',
      Returned: 'returned',
    },
    pazarama: {
      siparis_alindi: 'pending',
      hazirlaniyor: 'processing',
      kargoya_verildi: 'shipped',
      teslim_edildi: 'delivered',
      iptal_edildi: 'cancelled',
      iade_edildi: 'returned',
    },
    n11: {
      Created: 'pending',
      Picking: 'processing',
      Invoiced: 'confirmed',
      Shipped: 'shipped',
      Delivered: 'delivered',
      Cancelled: 'cancelled',
      Returned: 'returned',
    },
    amazon: {
      Pending: 'pending',
      Unshipped: 'processing',
      PartiallyShipped: 'processing',
      Shipped: 'shipped',
      Delivered: 'delivered',
      Canceled: 'cancelled',
    },
    etsy: {
      open: 'pending',
      paid: 'confirmed',
      shipped: 'shipped',
      delivered: 'delivered',
      canceled: 'cancelled',
    },
  };
  return statusMap[marketplace]?.[status] || status?.toLowerCase() || 'pending';
}

function parsePrice(val: any): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export function mapTrendyolOrder(raw: any): NormalizedOrder {
  const items = (raw.lines || []).map((line: any) => ({
    sku: line.stockCode || line.barcode || '',
    name: line.productName || line.title || '',
    quantity: line.quantity || 1,
    unitPrice: parsePrice(line.salePrice || line.price || 0),
  }));
  const total = items.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0);
  const shipping = parsePrice(raw.shippingPriceDetail?.totalCargoAmount || raw.cargoAmount || 0);
  return {
    marketplace: 'trendyol',
    marketplaceOrderId: String(raw.id || raw.orderNumber || ''),
    marketplaceOrderNumber: raw.orderNumber ? String(raw.orderNumber) : undefined,
    status: mapStatus('trendyol', raw.status),
    totalAmount: total + shipping,
    currency: raw.currencyType || 'TRY',
    items,
    customer: {
      name: raw.billingAddress?.fullName || raw.shipmentAddress?.fullName || '',
      email: raw.billingAddress?.email || '',
      phone: raw.billingAddress?.phone || raw.billingAddress?.mobilePhone || '',
      address: raw.shipmentAddress?.fullAddress || '',
      city: raw.shipmentAddress?.city || '',
      country: raw.shipmentAddress?.country || 'Türkiye',
    },
    createdAt: raw.createdDate || raw.orderDate || new Date().toISOString(),
    rawPayload: raw,
  };
}

export function mapN11Order(raw: any): NormalizedOrder {
  const items = (raw.orderLineList || raw.lines || []).map((line: any) => ({
    sku: line.stockCode || line.productSku || line.sku || '',
    name: line.productName || line.productTitle || '',
    quantity: line.quantity || 1,
    unitPrice: parsePrice(line.salePrice || line.price || 0),
  }));
  const total = items.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0);
  const shipping = parsePrice(raw.cargoAmount || raw.shippingCost || 0);
  return {
    marketplace: 'n11',
    marketplaceOrderId: String(raw.id || raw.packageId || raw.orderNumber || ''),
    marketplaceOrderNumber: raw.orderNumber ? String(raw.orderNumber) : undefined,
    status: mapStatus('n11', raw.status),
    totalAmount: total + shipping,
    currency: 'TRY',
    items,
    customer: {
      name: raw.billingAddress?.fullName || raw.shippingAddress?.fullName || raw.customerName || '',
      email: raw.billingAddress?.email || '',
      phone: raw.billingAddress?.phone || raw.billingAddress?.mobilePhone || raw.customerPhone || '',
      address: raw.shippingAddress?.fullAddress || raw.shippingAddress?.address || '',
      city: raw.shippingAddress?.city || raw.city || '',
      country: 'Türkiye',
    },
    createdAt: raw.orderDate || raw.createdDate || raw.createdAt || new Date().toISOString(),
    rawPayload: raw,
  };
}

export function mapHepsiburadaOrder(raw: any): NormalizedOrder {
  const items = (raw.items || raw.lines || []).map((line: any) => ({
    sku: line.merchantSku || line.sku || '',
    name: line.productName || line.name || '',
    quantity: line.quantity || 1,
    unitPrice: parsePrice(line.salePrice || line.price || 0),
  }));
  const total = items.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0);
  return {
    marketplace: 'hepsiburada',
    marketplaceOrderId: String(raw.id || raw.orderId || ''),
    marketplaceOrderNumber: raw.orderNumber ? String(raw.orderNumber) : undefined,
    status: mapStatus('hepsiburada', raw.status),
    totalAmount: total,
    currency: 'TRY',
    items,
    customer: {
      name: raw.customer?.name || raw.billingAddress?.fullName || '',
      email: raw.customer?.email || '',
      phone: raw.customer?.phone || '',
      address: raw.shippingAddress?.fullAddress || '',
      city: raw.shippingAddress?.city || '',
      country: 'Türkiye',
    },
    createdAt: raw.createdDate || raw.createdAt || new Date().toISOString(),
    rawPayload: raw,
  };
}

export function mapPazaramaOrder(raw: any): NormalizedOrder {
  const items = (raw.items || raw.lines || []).map((line: any) => ({
    sku: line.barcode || line.sku || line.productCode || '',
    name: line.productName || line.title || '',
    quantity: line.quantity || 1,
    unitPrice: parsePrice(line.unitPrice || line.salePrice || 0),
  }));
  const total = items.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0);
  return {
    marketplace: 'pazarama',
    marketplaceOrderId: String(raw.id || raw.orderId || ''),
    marketplaceOrderNumber: raw.orderNumber ? String(raw.orderNumber) : undefined,
    status: mapStatus('pazarama', raw.status),
    totalAmount: total,
    currency: 'TRY',
    items,
    customer: {
      name: raw.customer?.name || raw.billingAddress?.fullName || '',
      email: raw.customer?.email || '',
      phone: raw.customer?.phone || '',
      address: raw.shippingAddress?.address || raw.address || '',
      city: raw.shippingAddress?.city || raw.city || '',
      country: 'Türkiye',
    },
    createdAt: raw.createdDate || raw.createdAt || new Date().toISOString(),
    rawPayload: raw,
  };
}

export function mapAmazonOrder(raw: any): NormalizedOrder {
  const items = (raw.items || raw.orderItems || []).map((line: any) => ({
    sku: line.sellerSKU || line.asin || '',
    name: line.title || line.productName || '',
    quantity: line.quantity || 1,
    unitPrice: parsePrice(line.itemPrice?.amount || line.price || 0),
  }));
  const total = items.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0);
  return {
    marketplace: 'amazon',
    marketplaceOrderId: raw.amazonOrderId || String(raw.id || ''),
    marketplaceOrderNumber: raw.amazonOrderId || undefined,
    status: mapStatus('amazon', raw.orderStatus),
    totalAmount: parsePrice(raw.orderTotal?.amount || total),
    currency: raw.orderTotal?.currencyCode || 'TRY',
    items,
    customer: {
      name: raw.shippingAddress?.name || raw.buyerName || '',
      email: raw.buyerEmail || '',
      phone: raw.shippingAddress?.phone || '',
      address: [raw.shippingAddress?.addressLine1, raw.shippingAddress?.addressLine2].filter(Boolean).join(', '),
      city: raw.shippingAddress?.city || '',
      country: raw.shippingAddress?.countryCode || '',
    },
    createdAt: raw.purchaseDate || raw.createdAt || new Date().toISOString(),
    rawPayload: raw,
  };
}

export function mapEtsyOrder(raw: any): NormalizedOrder {
  const items = (raw.transactions || raw.items || []).map((line: any) => ({
    sku: line.sku || line.listingId?.toString() || '',
    name: line.title || line.productName || '',
    quantity: line.quantity || 1,
    unitPrice: parsePrice(line.price?.amount || line.price || 0),
  }));
  const total = items.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0);
  return {
    marketplace: 'etsy',
    marketplaceOrderId: String(raw.receiptId || raw.id || ''),
    marketplaceOrderNumber: raw.receiptId ? String(raw.receiptId) : undefined,
    status: mapStatus('etsy', raw.status),
    totalAmount: total,
    currency: raw.totalPrice?.currencyCode || raw.currency || 'USD',
    items,
    customer: {
      name: raw.buyer?.name || raw.name || '',
      email: raw.buyer?.email || raw.email || '',
      phone: raw.buyer?.phone || '',
      address: raw.shippingAddress?.addressLine || '',
      city: raw.shippingAddress?.city || '',
      country: raw.shippingAddress?.country || '',
    },
    createdAt: raw.createdTimestamp || raw.createdAt || new Date().toISOString(),
    rawPayload: raw,
  };
}

export function mapMarketplaceOrder(marketplace: string, raw: any): NormalizedOrder {
  switch (marketplace) {
    case 'trendyol': return mapTrendyolOrder(raw);
    case 'n11': return mapN11Order(raw);
    case 'hepsiburada': return mapHepsiburadaOrder(raw);
    case 'pazarama': return mapPazaramaOrder(raw);
    case 'amazon': return mapAmazonOrder(raw);
    case 'etsy': return mapEtsyOrder(raw);
    default:
      return {
        marketplace,
        marketplaceOrderId: String(raw.id || raw.orderId || ''),
        status: raw.status || 'pending',
        totalAmount: 0,
        currency: 'TRY',
        items: [],
        customer: { name: '' },
        createdAt: new Date().toISOString(),
        rawPayload: raw,
      };
  }
}

export const INTERNAL_STATUS_TO_MARKETPLACE: Record<string, Record<string, string>> = {
  trendyol: {
    pending: 'Created',
    confirmed: 'Invoiced',
    processing: 'Picking',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    returned: 'Returned',
  },
  n11: {
    pending: 'Created',
    confirmed: 'Invoiced',
    processing: 'Picking',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    returned: 'Returned',
  },
  hepsiburada: {
    pending: 'Created',
    confirmed: 'Preparing',
    processing: 'Preparing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    returned: 'Returned',
  },
  pazarama: {
    pending: 'siparis_alindi',
    confirmed: 'hazirlaniyor',
    processing: 'hazirlaniyor',
    shipped: 'kargoya_verildi',
    delivered: 'teslim_edildi',
    cancelled: 'iptal_edildi',
    returned: 'iade_edildi',
  },
  amazon: {
    pending: 'Pending',
    confirmed: 'Unshipped',
    processing: 'Unshipped',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Canceled',
    returned: 'Returned',
  },
  etsy: {
    pending: 'open',
    confirmed: 'paid',
    processing: 'paid',
    shipped: 'shipped',
    delivered: 'delivered',
    cancelled: 'canceled',
    returned: 'returned',
  },
};