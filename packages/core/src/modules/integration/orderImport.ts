import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { MarketplaceIntegration } from '../../models/MarketplaceIntegration.model.js';
import { createSplitOrder } from '../order/orderSplit.js';
import { createMarketplaceClient, getMarketplaceConfig, MarketplaceType } from '../../marketplace/clients/index.js';
import { notifyStore } from '../notification/service.js';
import { logger } from '../../utils/logger.js';

export interface ImportOrdersOptions {
  storeId: number;
  marketplace: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  maxPages?: number;
  /** Fire in-app + push notifications for new orders and status changes. */
  notify?: boolean;
}

export interface ImportOrdersResult {
  imported: number;
  created: number;
  updated: number;
  orders: any[];
  error?: string;
}

const MP_LABELS: Record<string, string> = {
  trendyol: 'Trendyol',
  hepsiburada: 'Hepsiburada',
  pazarama: 'Pazarama',
  n11: 'N11',
  amazon: 'Amazon',
  etsy: 'Etsy',
};

function mpLabel(mp: string): string {
  return MP_LABELS[mp] || mp;
}

/**
 * Pazarama numeric order status codes (seller flow 3 → 12 → 5 → 11):
 * 3 = Sipariş alındı (pending), 12 = Hazırlanıyor (processing),
 * 5 = Kargoda (shipped), 11 = Teslim edildi (delivered),
 * 9 = İptal (cancelled), 14/15 = İade (returned).
 */
export function normalizeMarketplaceStatus(marketplace: string, raw: any): string {
  const status = raw == null ? '' : String(raw);
  const s = status.trim();
  if (!s) return 'pending';

  const lower = s.toLowerCase();

  // Pazarama numeric codes
  if (marketplace === 'pazarama') {
    const n = Number(s);
    if (Number.isFinite(n)) {
      if (n === 3) return 'pending';
      if (n === 12) return 'processing';
      if (n === 5) return 'shipped';
      if (n === 11) return 'delivered';
      if (n === 9) return 'cancelled';
      if (n === 14 || n === 15) return 'returned';
      if (n === 1 || n === 2 || n === 4 || n === 6) return 'pending';
      return 'pending';
    }
  }

  const map: Record<string, string> = {
'created': 'pending', 'new': 'pending', 'waiting': 'pending',
    'siparis alindi': 'pending', 'siparis_alindi': 'pending', 'alindi': 'pending',
    'waitingforapproval': 'pending', 'waiting_for_approval': 'pending',
    'processing': 'processing', 'preparing': 'processing', 'picking': 'processing',
    'approved': 'processing', 'onaylandı': 'processing', 'onaylandi': 'processing',
    'invoiced': 'processing', 'unpacked': 'processing', 'packed': 'processing',
    'hazirlaniyor': 'processing', 'hazirlanıyor': 'processing', 'packaging': 'processing',
    'untrackable': 'processing', 'status.processing': 'processing', 'status.prepared': 'processing',
    'shipped': 'shipped', 'shipping': 'shipped', 'in transit': 'shipped',
    'kargoya verildi': 'shipped', 'kargoya_verildi': 'shipped', 'kargoda': 'shipped',
    'kargolandi': 'shipped', 'kargolandi ': 'shipped', 'kargolandı': 'shipped',
    'kargodan aktarma': 'shipped', 'kuryede': 'shipped', 'yolda': 'shipped',
    'status.shipped': 'shipped',
    'delivered': 'delivered', 'teslim edildi': 'delivered', 'teslim_edildi': 'delivered',
    'teslim': 'delivered', 'status.delivered': 'delivered', 'dagıtima cıktı': 'delivered', 'dağıtıma çıktı': 'delivered',
    'completed': 'delivered', 'complete': 'delivered',
    'cancelled': 'cancelled', 'canceled': 'cancelled', 'cancel': 'cancelled',
    'unsupplied': 'cancelled', 'undelivered': 'cancelled', 'iptal edildi': 'cancelled',
    'iptal_edildi': 'cancelled', 'iptal': 'cancelled', 'status.cancelled': 'cancelled',
    'returned': 'returned', 'return': 'returned', 'iade_edildi': 'returned', 'iade': 'returned',
    'automated_return': 'returned', 'status.returning': 'returned', 'status.returned': 'returned',
    // Additional N11 statuses
    'partiallyshipped': 'processing', 'partially_shipped': 'processing',
    'partially delivered': 'processing',
  };

  if (map[lower]) return map[lower];
  // Turkish locale lowercase: 'İ' → 'i' (JS toLowerCase gives 'i' + combining dot).
  const trLower = s.toLocaleLowerCase('tr-TR');
  if (trLower !== lower && map[trLower]) return map[trLower];
  const compact = lower.replace(/\s+/g, '_').replace(/status\./g, '');
  if (map[compact]) return map[compact];
  return 'pending';
}

function extractOrderDate(pkg: any): Date | null {
  const od = pkg?.orderDate || pkg?.orderCreateDate || pkg?.orderCreationDate || pkg?.createdAt
    || pkg?.createdDate || pkg?.createDate || pkg?.packageCreateDate || pkg?.creationDate || null;
  if (!od) return null;
  const d = new Date(od);
  return isNaN(d.getTime()) ? null : d;
}

function mapPazaramaPackage(rawPkg: any): any {
  const rawItems: any[] = rawPkg.items || [];
  const firstCargo = rawItems[0]?.cargo || {};
  const sa = rawPkg.shipmentAddress || {};
  return {
    ...rawPkg,
    id: rawPkg.orderId,
    lines: rawItems.map((item: any) => ({
      sku: item.product?.code || item.product?.stockCode || '',
      name: item.product?.name || '',
      quantity: Number(item.quantity || 1),
      price: Number(item.salePrice?.value || item.totalPrice?.value || (item.salePrice?.valueInt != null ? item.salePrice.valueInt / 100 : 0) || 0),
      image: item.product?.imageURL || item.product?.imageUrl || '',
      variantAttributes: item.product?.variantOptionDisplay ? [item.product.variantOptionDisplay] : [],
      orderLineId: item.orderItemId,
    })),
    customerfullName: rawPkg.customerName || sa.nameSurname || '',
    gsm: sa.phoneNumber || '',
    customerEmail: rawPkg.customerEmail || sa.customerEmail || '',
    address: sa.addressDetail || sa.displayAddressText || '',
    city: sa.cityName || '',
    district: sa.districtName || '',
    neighborhood: sa.neighborhoodName || '',
    zipCode: sa.postalCode || '',
    cargoTrackingNumber: firstCargo.trackingNumber || rawItems[0]?.shipmentCode || '',
    cargoProviderName: firstCargo.companyName || '',
    orderNumber: String(rawPkg.orderNumber ?? ''),
    totalAmount: Number(rawPkg.orderAmount ?? 0),
    status: rawPkg.orderStatus ?? null,
  };
}

export async function importMarketplaceOrders(opts: ImportOrdersOptions): Promise<ImportOrdersResult> {
  const { storeId, marketplace, maxPages = 5, notify = true } = opts;

  const integration = await MarketplaceIntegration.findOne({
    where: { storeId, marketplace, isActive: true },
  });
  if (!integration) {
    return { imported: 0, created: 0, updated: 0, orders: [], error: `${marketplace} entegrasyonu aktif değil` };
  }

  const mpConfig = getMarketplaceConfig(marketplace as MarketplaceType, integration);
  const client = createMarketplaceClient(marketplace as MarketplaceType, mpConfig);

  const result: ImportOrdersResult = { imported: 0, created: 0, updated: 0, orders: [] };
  let hasMore = true;
  let page = 0;

  try {
    while (hasMore && page < maxPages) {
      const params: any = { page, size: 100 };
      if (opts.startDate) params.startDate = opts.startDate;
      if (opts.endDate) params.endDate = opts.endDate;
      if (opts.status) params.status = opts.status;

      const packages = await client.getOrders(params);
      if (!packages || packages.length === 0) break;

      for (const rawPkg of packages) {
        let pkg = rawPkg;
        if (marketplace === 'pazarama') pkg = mapPazaramaPackage(rawPkg);

        const marketplaceOrderId = String(pkg.id);
        if (!marketplaceOrderId || marketplaceOrderId === 'null' || marketplaceOrderId === 'undefined') continue;

        const existing = await DropshippingOrder.findOne({
          where: { storeId, marketplaceOrderId, marketplace },
        });

        const lines = pkg.lines || pkg.items || [];
        const items = lines.map((l: any) => ({
          sku: l.barcode || l.sku || l.stockCode || l.productCode || l.productBarcode || l.code || '',
          name: l.productName || l.title || l.name || l.productTitle || l.itemName || '',
          quantity: Number(l.quantity || l.piece || l.adet || l.amount || 1),
          price: parseFloat(l.salePrice || l.price || l.unitPrice || l.salesPrice || l.productPrice || 0) || 0,
          image: l.imageUrl || l.productImageUrl || l.image || '',
          variantAttributes: l.variantAttributes || [],
          orderLineId: l.orderLineId || l.orderItemId || l.id,
        }));

        const totalAmount = Number(pkg.totalAmount || pkg.orderAmount || items.reduce((s: number, i: any) => s + i.price * i.quantity, 0));
        const address = pkg.address || pkg.shippingAddress || pkg.shipmentAddress || {};
        const fullName = (pkg.customerfullName || pkg.customerFullName)
          || `${pkg.customerFirstName || ''} ${pkg.customerLastName || ''}`.trim()
          || address.fullName || address.name || '';
        const phone = address.gsm || address.phone || address.phoneNumber || pkg.gsm || pkg.phone || '';
        const customerEmail = pkg.customerEmail || pkg.email || address.email || '';
        const shippingAddress = {
          fullName, phone, email: customerEmail,
          city: address.city || pkg.city || '',
          district: address.district || pkg.district || '',
          neighborhood: address.neighborhood || pkg.neighborhood || '',
          address: address.address1 || address.address || address.fullAddress || address.line || pkg.address || '',
          zipCode: address.zipCode || address.postalCode || pkg.zipCode || '',
        };

        const newStatus = normalizeMarketplaceStatus(marketplace, pkg.status);
        const orderDate = extractOrderDate(pkg);
        const prefix = marketplace === 'pazarama' ? 'PZ' : marketplace === 'trendyol' ? 'TY' : marketplace.slice(0, 2).toUpperCase();
        const orderNumber = pkg.orderNumber ? `${prefix}-${pkg.orderNumber}` : `ORD-${Date.now()}-${pkg.id}`;

        if (existing) {
          const changed: Record<string, any> = {};
          if (existing.status !== newStatus) changed.status = newStatus;
          if (JSON.stringify(existing.items || []) !== JSON.stringify(items)) changed.items = items;
          if (JSON.stringify(existing.shippingAddress || {}) !== JSON.stringify(shippingAddress)) changed.shippingAddress = shippingAddress;
          if (existing.totalAmount !== totalAmount) changed.totalAmount = totalAmount;
          if (existing.customerName !== fullName) changed.customerName = fullName;
          if (existing.customerEmail !== customerEmail) changed.customerEmail = customerEmail;
          if (existing.customerPhone !== phone) changed.customerPhone = phone;
          if (!existing.orderDate && orderDate) changed.orderDate = orderDate;
          const tracking = pkg.cargoTrackingNumber || pkg.trackingNumber || '';
          const carrier = pkg.cargoProviderName || pkg.carrier || '';
          if (existing.trackingNumber !== tracking) changed.trackingNumber = tracking;
          if (existing.carrier !== carrier) changed.carrier = carrier;

          if (Object.keys(changed).length > 0) {
            await existing.update(changed);
            result.updated++;
            if (changed.status && notify) {
              notifyStore({
                storeId,
                type: 'order_status',
                title: `${mpLabel(marketplace)} sipariş durumu`,
                body: `#${existing.orderNumber || orderNumber} → ${newStatus}`,
                data: { marketplace, orderId: Number(existing.id), status: newStatus },
              });
            }
          }
          result.orders.push({ id: existing.id, orderNumber: existing.orderNumber, status: newStatus, marketplaceOrderId, updated: true });
          result.imported++;
          continue;
        }

        const { mainOrder } = await createSplitOrder(
          storeId, marketplace, marketplaceOrderId,
          items, totalAmount, orderNumber, 'TRY', shippingAddress, pkg,
          String(pkg.orderNumber || ''), fullName, customerEmail, phone,
          {
            status: newStatus,
            trackingNumber: pkg.cargoTrackingNumber || pkg.trackingNumber || '',
            carrier: pkg.cargoProviderName || pkg.carrier || '',
            paymentMethod: 'marketplace',
            paymentStatus: newStatus === 'cancelled' ? 'failed' : 'paid',
            orderDate,
          },
        );

        result.created++;
        result.imported++;
        result.orders.push({ id: mainOrder.id, orderNumber, status: mainOrder.status, marketplaceOrderId, updated: false });

        if (notify) {
          notifyStore({
            storeId,
            type: 'new_order',
            title: `Yeni ${mpLabel(marketplace)} siparişi`,
            body: `#${orderNumber} — ${totalAmount.toLocaleString('tr-TR')} ₺`,
            data: { marketplace, orderId: Number(mainOrder.id), orderNumber, amount: totalAmount },
          });
        }
      }

      page++;
      hasMore = packages.length >= 100;
    }
  } catch (err) {
    logger.warn({ err, storeId, marketplace }, 'importMarketplaceOrders error');
    result.error = String((err as any)?.message || err);
  }

  logger.info({ marketplace, storeId, created: result.created, updated: result.updated }, 'Orders imported from marketplace');
  return result;
}

/**
 * Pulls orders for every active integration across all stores. Used by the
 * periodic auto-import job. Per-integration failures are isolated.
 */
export async function importOrdersForAllStores(opts: { maxPages?: number } = {}): Promise<void> {
  const integrations = await MarketplaceIntegration.findAll({ where: { isActive: true } });
  const seen = new Set<string>();
  for (const integration of integrations) {
    const key = `${integration.storeId}:${integration.marketplace}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      await importMarketplaceOrders({
        storeId: integration.storeId,
        marketplace: integration.marketplace,
        maxPages: opts.maxPages ?? 3,
        notify: true,
      });
    } catch (err) {
      logger.warn({ err, storeId: integration.storeId, marketplace: integration.marketplace }, 'Auto order import failed');
    }
  }
}
