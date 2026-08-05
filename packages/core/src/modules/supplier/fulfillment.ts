export const SUPPLIER_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  FULFILLED: 'fulfilled',
} as const;

export type SupplierStatus = (typeof SUPPLIER_STATUS)[keyof typeof SUPPLIER_STATUS];

interface SubOrderState {
  supplierStatus?: string;
  status?: string;
  trackingNumber?: string;
  carrier?: string;
}

/**
 * Derives the main order status from its supplier sub-orders.
 * Returns null when the parent should keep its current status.
 * Priority: rejected > fully fulfilled > any accepted.
 */
export function deriveParentStatus(subs: SubOrderState[]): string | null {
  if (subs.length === 0) return null;
  if (subs.some((s) => s.supplierStatus === SUPPLIER_STATUS.REJECTED)) return 'cancelled';
  if (subs.every((s) => s.supplierStatus === SUPPLIER_STATUS.FULFILLED)) return 'shipped';
  if (subs.some((s) => s.supplierStatus === SUPPLIER_STATUS.ACCEPTED)) return 'confirmed';
  return null;
}

/**
 * Picks the most recent supplier tracking info to propagate to the main order.
 */
export function latestSupplierTracking(subs: SubOrderState[]): { trackingNumber?: string; carrier?: string } | null {
  const withTracking = subs.filter((s) => s.trackingNumber);
  if (withTracking.length === 0) return null;
  const last = withTracking[withTracking.length - 1];
  return { trackingNumber: last.trackingNumber, carrier: last.carrier };
}

export interface RestockLine {
  product_id?: number;
  productId?: number;
  quantity?: number;
}

export function toRestockMap(lines: RestockLine[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const line of lines || []) {
    const productId = Number(line.product_id || line.productId);
    if (!productId) continue;
    map.set(productId, (map.get(productId) || 0) + (Number(line.quantity) || 0));
  }
  return map;
}

export const CLONE_SYNC_FIELDS = ['quantity', 'priceTRY', 'priceUSD', 'discountRate', 'isActive'] as const;

/**
 * Builds the field patch a B2B clone should adopt from its original supplier
 * product. Only commerce-critical fields are synced (never cost/margin).
 */
export function clonePatchFromOriginal(original: Record<string, unknown>): Record<string, number | boolean> {
  const patch: Record<string, number | boolean> = {};
  for (const field of CLONE_SYNC_FIELDS) {
    const value = original[field];
    if (value !== undefined && value !== null) patch[field] = value as number | boolean;
  }
  return patch;
}
