import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { Op } from 'sequelize';
import { Supplier } from '../../models/Supplier.model.js';
import { Store } from '../../models/Store.model.js';
import { Product } from '../../models/Product.model.js';
import { B2BListedProduct } from '../../models/B2BModels.js';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { OrderStatusHistory } from '../../models/OrderStatusHistory.model.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { ensureSupplierForStore } from './service.js';
import { SUPPLIER_STATUS, deriveParentStatus, latestSupplierTracking, toRestockMap } from './fulfillment.js';
import { logger } from '../../utils/logger.js';

export const supplierRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

// My own supplier profile (lazily created when the store first acts as a supplier)
supplierRoutes.get('/profile', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const supplier = await ensureSupplierForStore(store.id);
    res.json({ supplier });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get supplier profile error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

supplierRoutes.put('/profile', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('name').optional().isString(),
  body('email').optional().isEmail(),
  body('phone').optional().isString(),
  body('taxId').optional().isString(),
  body('bankName').optional().isString(),
  body('iban').optional().isString(),
  body('bankOwner').optional().isString(),
  body('contractStatus').optional().isIn(['invited', 'active', 'suspended']),
  body('commissionRate').optional().isFloat({ min: 0, max: 100 }),
  body('payoutMethod').optional().isIn(['bank', 'manual']),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const supplier = await ensureSupplierForStore(store.id);
    const fields = ['name', 'email', 'phone', 'taxId', 'bankName', 'iban', 'bankOwner', 'contractStatus', 'commissionRate', 'payoutMethod'];
    const updateData: Record<string, unknown> = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    }
    if (Object.keys(updateData).length > 0) {
      await supplier.update(updateData);
    }
    res.json({ supplier });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update supplier profile error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Buyer view: stores I source from (derived from my B2B listed clones)
supplierRoutes.get('/suppliers', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const listed = await B2BListedProduct.findAll({
      where: { storeId: store.id },
      attributes: ['originalStoreId'],
      group: ['originalStoreId'],
    });
    const supplierStoreIds = listed.map((l) => l.originalStoreId);
    const suppliers = await Supplier.findAll({
      where: { storeId: { [Op.in]: supplierStoreIds } },
      include: [{ model: Store, as: 'store', attributes: ['id', 'name', 'siteCode', 'domain', 'email'] }],
    });
    res.json({ suppliers, supplierStoreIds });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List my suppliers error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Supplier view: incoming sub-orders to fulfill (orders routed to my store as a vendor)
supplierRoutes.get('/orders', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = { storeId: store.id, parentOrderId: { [Op.ne]: null } };
    if (req.query.status) where.status = req.query.status;

    const { count, rows } = await DropshippingOrder.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: OrderStatusHistory, as: 'statusHistory', attributes: ['fromStatus', 'toStatus', 'note', 'createdAt'] },
      ],
    });

    res.json({ orders: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List supplier orders error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function loadSupplierSubOrder(storeId: number, id: number): Promise<DropshippingOrder | null> {
  return DropshippingOrder.findOne({
    where: { id, storeId, parentOrderId: { [Op.ne]: null } },
  });
}

async function syncParentOrder(parentOrderId: number): Promise<void> {
  const parent = await DropshippingOrder.findByPk(parentOrderId);
  if (!parent) return;

  const subs = await DropshippingOrder.findAll({ where: { parentOrderId } });

  const nextStatus = deriveParentStatus(subs);
  if (nextStatus && nextStatus !== parent.status) {
    const oldStatus = parent.status;
    await parent.update({ status: nextStatus });
    await OrderStatusHistory.create({
      dropshippingOrderId: parent.id,
      fromStatus: oldStatus,
      toStatus: nextStatus,
      note: `Auto-synced from supplier sub-orders (${subs.map((s) => s.supplierStatus).join(',')})`,
    });
    logger.info(`Parent order ${parent.id} synced: ${oldStatus} -> ${nextStatus}`);
  }

  const tracking = latestSupplierTracking(subs);
  if (tracking?.trackingNumber && parent.trackingNumber !== tracking.trackingNumber) {
    await parent.update({ trackingNumber: tracking.trackingNumber, carrier: tracking.carrier || null });
  }
}

async function restoreBuyerStock(subOrder: DropshippingOrder): Promise<void> {
  const items = (subOrder.items as any[]) || [];
  const restock = toRestockMap(items);
  for (const [productId, qty] of restock) {
    const product = await Product.findByPk(productId);
    if (!product) continue;
    if (qty > 0) await product.increment('quantity', { by: qty });
  }
}

function writeSubHistory(sub: DropshippingOrder, from: string, to: string, note: string) {
  return OrderStatusHistory.create({
    dropshippingOrderId: sub.id,
    fromStatus: from,
    toStatus: to,
    note,
  });
}

// Supplier accepts an incoming sub-order → becomes confirmed for the buyer
supplierRoutes.post('/supplier/orders/:id/accept', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('note').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const sub = await loadSupplierSubOrder(store.id, Number(req.params.id));
    if (!sub) return res.status(404).json({ error: 'Sub-order not found' });

    if (sub.supplierStatus === SUPPLIER_STATUS.REJECTED) {
      return res.status(409).json({ error: 'Order already rejected' });
    }
    if (sub.supplierStatus === SUPPLIER_STATUS.FULFILLED) {
      return res.status(409).json({ error: 'Order already fulfilled' });
    }

    const oldStatus = sub.status;
    const oldSupplier = sub.supplierStatus;
    await sub.update({ supplierStatus: SUPPLIER_STATUS.ACCEPTED, status: 'confirmed' });
    await writeSubHistory(sub, oldStatus, 'confirmed', req.body.note || 'Supplier accepted the order');

    await syncParentOrder(sub.parentOrderId!);
    logger.info(`Supplier ${store.id} accepted sub-order ${sub.id}`);

    res.json({ order: sub, supplierStatus: SUPPLIER_STATUS.ACCEPTED, note: `Supplier accepted (was ${oldSupplier})` });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Accept supplier order error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Supplier rejects an incoming sub-order → restocks the buyer's clone and cancels the parent
supplierRoutes.post('/supplier/orders/:id/reject', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('note').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const sub = await loadSupplierSubOrder(store.id, Number(req.params.id));
    if (!sub) return res.status(404).json({ error: 'Sub-order not found' });

    if (sub.supplierStatus === SUPPLIER_STATUS.REJECTED) {
      return res.status(409).json({ error: 'Order already rejected' });
    }
    if (sub.supplierStatus === SUPPLIER_STATUS.FULFILLED) {
      return res.status(409).json({ error: 'Order already fulfilled' });
    }

    const oldStatus = sub.status;
    await sub.update({ supplierStatus: SUPPLIER_STATUS.REJECTED, status: 'cancelled', note: req.body.note || sub.note || 'Rejected by supplier' });
    await writeSubHistory(sub, oldStatus, 'cancelled', req.body.note || 'Rejected by supplier');

    await restoreBuyerStock(sub);
    await syncParentOrder(sub.parentOrderId!);

    logger.info(`Supplier ${store.id} rejected sub-order ${sub.id}`);
    res.json({ order: sub, supplierStatus: SUPPLIER_STATUS.REJECTED });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Reject supplier order error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Supplier ships an incoming sub-order with tracking → propagates to parent
supplierRoutes.post('/supplier/orders/:id/ship', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('trackingNumber').isString(),
  body('carrier').optional().isString(),
  body('note').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const sub = await loadSupplierSubOrder(store.id, Number(req.params.id));
    if (!sub) return res.status(404).json({ error: 'Sub-order not found' });

    if (sub.supplierStatus === SUPPLIER_STATUS.REJECTED) {
      return res.status(409).json({ error: 'Order rejected — cannot ship' });
    }
    if (sub.supplierStatus === SUPPLIER_STATUS.FULFILLED) {
      return res.status(409).json({ error: 'Order already fulfilled' });
    }

    const oldStatus = sub.status;
    await sub.update({
      supplierStatus: SUPPLIER_STATUS.FULFILLED,
      status: 'shipped',
      trackingNumber: req.body.trackingNumber,
      carrier: req.body.carrier || null,
    });
    await writeSubHistory(sub, oldStatus, 'shipped', req.body.note || `Shipped with tracking ${req.body.trackingNumber}`);

    await syncParentOrder(sub.parentOrderId!);

    logger.info(`Supplier ${store.id} shipped sub-order ${sub.id} (${req.body.trackingNumber})`);
    res.json({ order: sub, supplierStatus: SUPPLIER_STATUS.FULFILLED });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Ship supplier order error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
