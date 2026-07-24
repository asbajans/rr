import { BaseMarketplaceClient, MarketplaceClient } from './base.js';
import { logger } from '../../utils/logger.js';

export interface N11Config {
  appKey: string;
  appSecret: string;
}

function authHeaders(config: N11Config): Record<string, string> {
  return { appKey: config.appKey, appSecret: config.appSecret };
}

/*
 * N11 REST API (per n11 RestAPI dokumantasyonu)
 * ──────────────────────────────────────────────
 * Category:   GET  /cdn/categories                          (tree)
 *             GET  /cdn/category/{id}/attribute              (attributes)
 * Product:    GET  /ms/product-query                         (list, sync)
 *             POST /ms/product/tasks/product-create          (async)
 *             POST /ms/product/tasks/product-update          (async)
 *             POST /ms/product/tasks/price-stock-update      (async)
 *             POST /ms/product/task-details/page-query       (task status)
 * Order:      GET  /rest/delivery/v1/shipmentPackages        (list)
 *             PUT  /rest/order/v1/update                     (approve)
 *             POST /rest/delivery/v1/splitCombinePackage     (split)
 *             POST /rest/delivery/v1/splitPackageByQuantity  (split+qty)
 *             PUT  /rest/order/v1/labor-costs                (labor)
 * Auth: appKey + appSecret headers (no HMAC, no SOAP envelope)
 */

export class N11Client extends BaseMarketplaceClient implements MarketplaceClient {
  private config: N11Config;

  constructor(config: N11Config) {
    super('https://api.n11.com');
    this.marketplaceName = 'n11';
    this.config = config;
  }

  // ─── Category ─────────────────────────────────────────────

  async getCategories(): Promise<any[]> {
    const data = await this.request<any>({
      method: 'GET',
      url: '/cdn/categories',
      headers: authHeaders(this.config),
    });
    const raw = data?.categories || data?.categoryList || data || [];
    const list = Array.isArray(raw) ? raw : [];
    return this.flattenTree(list, 0);
  }

  async getCategoryAttributes(categoryId: number): Promise<any> {
    return this.request<any>({
      method: 'GET',
      url: `/cdn/category/${categoryId}/attribute`,
      headers: authHeaders(this.config),
    });
  }

  private flattenTree(nodes: any[], parentId: number, level: number = 0): any[] {
    const result: any[] = [];
    for (const n of nodes) {
      const id = n.id ?? 0;
      result.push({
        id,
        marketplace_category_id: String(id),
        name: n.name ?? '',
        parentId,
        parent_id: String(parentId),
        level,
        path: n.name ?? '',
      });
      const kids = n.subCategories;
      if (Array.isArray(kids) && kids.length > 0) {
        result.push(...this.flattenTree(kids, id, level + 1));
      }
    }
    return result;
  }

  // ─── Product Query (sync, paginated) ───────────────────────

  async getProducts(params: any = {}): Promise<{ products: any[]; hasMore: boolean }> {
    const query: Record<string, any> = {};
    if (params.page != null) query.page = params.page;
    if (params.size != null) query.size = Math.min(params.size, 250);
    else query.size = 20;
    if (params.stockCode) query.stockCode = params.stockCode;
    if (params.saleStatus) query.saleStatus = params.saleStatus;
    if (params.productStatus) query.productStatus = params.productStatus;
    if (params.brandName) query.brandName = params.brandName;
    if (params.categoryIds) query.categoryIds = params.categoryIds;
    if (params.id) query.id = params.id;

    const data = await this.request<any>({
      method: 'GET',
      url: '/ms/product-query',
      params: query,
      headers: authHeaders(this.config),
    });

    const products = data?.content ?? data?.products ?? data?.data ?? [];
    const totalPages = data?.totalPages ?? data?.pageCount ?? 0;
    const currentPage = data?.number ?? data?.pageable?.pageNumber ?? (params.page ?? 0);

    return {
      products: Array.isArray(products) ? products : [],
      hasMore: products.length > 0 && currentPage < totalPages - 1,
    };
  }

  // ─── Create Product (async, returns taskId) ───────────────

  async createProduct(product: any): Promise<any> {
    const sku: Record<string, any> = {
      title: product.title,
      description: product.description ?? '',
      categoryId: product.categoryId,
      currencyType: product.currencyType ?? 'TL',
      productMainId: product.productMainId ?? product.sku ?? `p_${Date.now()}`,
      preparingDay: product.preparingDay ?? 3,
      shipmentTemplate: product.shipmentTemplate ?? '1',
      stockCode: product.sku ?? product.stockCode ?? '',
      quantity: product.quantity ?? 0,
      images: Array.isArray(product.images) ? product.images.map((u: any) => typeof u === 'string' ? { url: u, order: 0 } : u) : [],
      attributes: product.attributes ?? [],
      salePrice: product.salePrice ?? product.price ?? 0,
      listPrice: product.listPrice ?? product.price ?? 0,
      vatRate: product.vatRate ?? 10,
    };
    if (product.barcode) sku.barcode = product.barcode;
    if (product.maxPurchaseQuantity != null) sku.maxPurchaseQuantity = product.maxPurchaseQuantity;

    return this.request<any>({
      method: 'POST',
      url: '/ms/product/tasks/product-create',
      data: { payload: { integrator: 'Rahatio', skus: [sku] } },
      headers: { 'Content-Type': 'application/json', ...authHeaders(this.config) },
    });
  }

  // ─── Update Product Info (async) ──────────────────────────

  async updateProduct(stockCode: string, product: any): Promise<any> {
    const sku: Record<string, any> = { stockCode };
    if (product.title) sku.title = product.title;
    if (product.description) sku.description = product.description;
    if (product.categoryId) sku.categoryId = product.categoryId;
    if (product.status) sku.status = product.status;
    if (product.preparingDay != null) sku.preparingDay = product.preparingDay;
    if (product.shipmentTemplate) sku.shipmentTemplate = product.shipmentTemplate;
    if (product.vatRate != null) sku.vatRate = product.vatRate;
    if (product.currencyType) sku.currencyType = product.currencyType;
    if (product.maxPurchaseQuantity != null) sku.maxPurchaseQuantity = product.maxPurchaseQuantity;

    return this.request<any>({
      method: 'POST',
      url: '/ms/product/tasks/product-update',
      data: { payload: { integrator: 'Rahatio', skus: [sku] } },
      headers: { 'Content-Type': 'application/json', ...authHeaders(this.config) },
    });
  }

  // ─── Price & Stock Update (async) ─────────────────────────

  async updatePrice(stockCode: string, price: number): Promise<any> {
    return this.updatePriceStock(stockCode, { salePrice: price, listPrice: price });
  }

  async updateStock(stockCode: string, quantity: number): Promise<any> {
    return this.updatePriceStock(stockCode, { quantity });
  }

  async updatePriceStock(stockCode: string, fields: Record<string, any>): Promise<any> {
    const sku: Record<string, any> = { stockCode, ...fields };
    return this.request<any>({
      method: 'POST',
      url: '/ms/product/tasks/price-stock-update',
      data: { payload: { integrator: 'Rahatio', skus: [sku] } },
      headers: { 'Content-Type': 'application/json', ...authHeaders(this.config) },
    });
  }

  // ─── Task Detail (async task status) ──────────────────────

  async getTaskDetail(taskId: number): Promise<any> {
    return this.request<any>({
      method: 'POST',
      url: '/ms/product/task-details/page-query',
      data: { taskId, pageable: { page: 0, size: 1000 } },
      headers: { 'Content-Type': 'application/json', ...authHeaders(this.config) },
    });
  }

  // ─── Orders (sync, paginated) ─────────────────────────────

  async getOrders(params: any = {}): Promise<any[]> {
    const query: Record<string, any> = {};
    if (params.page != null) query.page = params.page;
    if (params.size != null) query.size = Math.min(params.size, 100);
    if (params.status) query.status = params.status;
    if (params.startDate) query.startDate = params.startDate;
    if (params.endDate) query.endDate = params.endDate;
    if (params.orderNumber) query.orderNumber = params.orderNumber;
    if (params.packageIds) query.packageIds = params.packageIds;
    if (params.orderByField) query.orderByField = params.orderByField;
    if (params.orderByDirection) query.orderByDirection = params.orderByDirection;

    const data = await this.request<any>({
      method: 'GET',
      url: '/rest/delivery/v1/shipmentPackages',
      params: query,
      headers: authHeaders(this.config),
    });

    const content = data?.content ?? [];
    return Array.isArray(content) ? content : [];
  }

  async getOrder(packageId: string): Promise<any> {
    const orders = await this.getOrders({ packageIds: packageId });
    return orders.length > 0 ? orders[0] : null;
  }

  // ─── Update Order (approve/picking) ───────────────────────

  async updateOrderStatus(lineIds: number[], status: string = 'Picking'): Promise<any> {
    return this.request<any>({
      method: 'PUT',
      url: '/rest/order/v1/update',
      data: { lines: lineIds.map(id => ({ lineId: id })), status },
      headers: { 'Content-Type': 'application/json', ...authHeaders(this.config) },
    });
  }

  // ─── Split Package ───────────────────────────────────────

  async splitPackage(splitGroups: number[][]): Promise<any> {
    return this.request<any>({
      method: 'POST',
      url: '/rest/delivery/v1/splitCombinePackage',
      data: { splitGroups: splitGroups.map(ids => ({ orderLineIds: ids })) },
      headers: { 'Content-Type': 'application/json', ...authHeaders(this.config) },
    });
  }

  async splitPackageByQuantity(details: { orderLineId: number; quantities: number }[], cancelled?: { orderLineId: number; quantity: number; cancelReasonId: number }[]): Promise<any> {
    const body: Record<string, any> = {
      splitPackages: [{ packageDetails: details }],
    };
    if (cancelled?.length) {
      body.cancelledItems = cancelled.map(c => ({
        cancelReasonId: c.cancelReasonId,
        orderLineId: c.orderLineId,
        quantity: c.quantity,
      }));
    }
    return this.request<any>({
      method: 'POST',
      url: '/rest/delivery/v1/splitPackageByQuantity',
      data: body,
      headers: { 'Content-Type': 'application/json', ...authHeaders(this.config) },
    });
  }

  // ─── Labor Cost ──────────────────────────────────────────

  async addLaborCost(details: { orderLineId: number; totalLaborCostExcludingVAT: number; laborVatRate?: number }[]): Promise<any> {
    return this.request<any>({
      method: 'PUT',
      url: '/rest/order/v1/labor-costs',
      data: { laborCostDetails: details },
      headers: { 'Content-Type': 'application/json', ...authHeaders(this.config) },
    });
  }
}

export function createN11Client(config: N11Config): N11Client {
  return new N11Client(config);
}
