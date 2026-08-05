import { sequelize } from '../../config/database.js';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { OrderStatusHistory } from '../../models/OrderStatusHistory.model.js';
import { Product } from '../../models/Product.model.js';
import { logger } from '../../utils/logger.js';

export interface ConfirmOptions {
  refId?: string;
  provider?: string;
  paymentDetails?: unknown;
}

/**
 * Idempotent order confirmation after a successful payment:
 *  - releases the reserved stock (quantity -= reserved, reservedQuantity reset),
 *  - marks the order paid + confirmed,
 *  - records status history.
 * Safe to call multiple times (webhook retries) — only the first call mutates.
 */
export async function confirmPaidOrder(orderId: number, opts: ConfirmOptions = {}): Promise<DropshippingOrder> {
  return sequelize.transaction(async (t) => {
    const order = await DropshippingOrder.findOne({
      where: { id: orderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!order) throw new Error(`Order ${orderId} not found`);

    if (order.paymentStatus === 'paid') {
      logger.info(`confirmPaidOrder: order ${orderId} already paid (idempotent skip)`);
      return order;
    }

    const items = (order.items as any[]) || [];
    for (const item of items) {
      const productId = Number(item.product_id);
      if (!productId) continue;
      const product = await Product.findOne({
        where: { id: productId, storeId: order.storeId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!product) continue;

      const qty = Number(item.quantity) || 0;
      const reserved = Math.min(Number(product.reservedQuantity) || 0, qty);
      if (qty > 0) await product.decrement('quantity', { by: qty, transaction: t });
      if (reserved > 0) await product.decrement('reservedQuantity', { by: reserved, transaction: t });
    }

    const oldStatus = order.status;
    const updateData: Record<string, unknown> = {
      paymentStatus: 'paid',
      status: 'confirmed',
    };
    if (opts.refId) updateData.paymentRefId = opts.refId;
    if (opts.provider) updateData.paymentProvider = opts.provider;
    if (opts.paymentDetails != null) updateData.paymentDetails = opts.paymentDetails;
    await order.update(updateData, { transaction: t });

    await OrderStatusHistory.create(
      {
        dropshippingOrderId: order.id,
        fromStatus: oldStatus,
        toStatus: 'confirmed',
        note: `Payment confirmed via ${opts.provider || order.paymentProvider || 'unknown'}`,
      },
      { transaction: t }
    );

    logger.info(`confirmPaidOrder: order ${order.id} paid (${opts.refId || order.paymentRefId || 'no-ref'})`);
    return order;
  });
}
