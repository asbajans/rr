import { Op } from 'sequelize';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { SupplierSettlement } from '../../models/SupplierSettlement.model.js';
import { ensureSupplierForStore } from './service.js';
import { logger } from '../../utils/logger.js';

export interface SettlementComputation {
  totalAmount: number;
  commissionAmount: number;
  netAmount: number;
  orderCount: number;
}

export interface SettlementLine {
  id: number;
  orderNumber: string;
  totalAmount: number;
  commissionAmount: number;
  netAmount: number;
  shippedAt: Date;
}

export function computeSettlementTotals(orders: DropshippingOrder[]): SettlementComputation {
  let totalAmount = 0;
  let commissionAmount = 0;
  let orderCount = 0;
  for (const order of orders) {
    totalAmount += Number(order.totalAmount || 0);
    commissionAmount += Number(order.commissionAmount || 0);
    orderCount += 1;
  }
  const netAmount = Math.round((totalAmount - commissionAmount + Number.EPSILON) * 100) / 100;
  return { totalAmount: round2(totalAmount), commissionAmount: round2(commissionAmount), netAmount: round2(netAmount), orderCount };
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function toSettlementLines(orders: DropshippingOrder[]): SettlementLine[] {
  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    totalAmount: Number(o.totalAmount || 0),
    commissionAmount: Number(o.commissionAmount || 0),
    netAmount: Math.round(((Number(o.totalAmount || 0) - Number(o.commissionAmount || 0)) + Number.EPSILON) * 100) / 100,
    shippedAt: o.createdAt,
  }));
}

/**
 * Fetches the supplier's fulfilled sub-orders for a period ('YYYY-MM').
 */
export async function getFulfilledSubOrders(storeId: number, period: string): Promise<DropshippingOrder[]> {
  const [year, month] = period.split('-').map((p) => parseInt(p, 10));
  if (!year || !month) return [];
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  return DropshippingOrder.findAll({
    where: {
      storeId,
      parentOrderId: { [Op.ne]: null },
      supplierStatus: 'fulfilled',
      createdAt: { [Op.gte]: start, [Op.lt]: end },
    },
    order: [['createdAt', 'ASC']],
  });
}

/**
 * Computes the current period totals for a supplier (fulfilled sub-orders),
 * regardless of whether a settlement row exists yet.
 */
export async function computePeriod(storeId: number, period: string): Promise<{ computation: SettlementComputation; lines: SettlementLine[]; settlement: SupplierSettlement | null }> {
  const supplier = await ensureSupplierForStore(storeId);
  const orders = await getFulfilledSubOrders(storeId, period);
  const computation = computeSettlementTotals(orders);
  const settlement = await SupplierSettlement.findOne({ where: { storeId, period } });
  return { computation, lines: toSettlementLines(orders), settlement };
}

/**
 * Requests a payout for a period. Creates the settlement row (or re-opens the
 * requested one) with totals derived from fulfilled sub-orders.
 */
export async function requestSettlement(storeId: number, period: string): Promise<SupplierSettlement> {
  const supplier = await ensureSupplierForStore(storeId);
  const orders = await getFulfilledSubOrders(storeId, period);
  const { totalAmount, commissionAmount, netAmount, orderCount } = computeSettlementTotals(orders);

  const [settlement, created] = await SupplierSettlement.findOrCreate({
    where: { storeId, period },
    defaults: {
      supplierId: supplier.id,
      storeId,
      period,
      totalAmount,
      commissionAmount,
      netAmount,
      orderCount,
      status: 'requested',
      requestedAt: new Date(),
      payoutMethod: supplier.payoutMethod,
    },
  });

  if (!created) {
    await settlement.update({
      totalAmount,
      commissionAmount,
      netAmount,
      orderCount,
      status: 'requested',
      requestedAt: settlement.requestedAt || new Date(),
      payoutMethod: supplier.payoutMethod,
    });
  }

  logger.info(`Settlement requested: supplier store ${storeId}, period ${period}, net=${netAmount}`);
  return settlement;
}
