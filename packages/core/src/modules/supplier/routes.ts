import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
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
import { computePeriod, requestSettlement } from './settlement.js';
import { SupplierSettlement } from '../../models/SupplierSettlement.model.js';
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
supplierRoutes.get('/supplier/profile', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const supplier = await ensureSupplierForStore(store.id);
    res.json({ supplier });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get supplier profile error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

supplierRoutes.put('/supplier/profile', authMiddleware, requireRole('owner', 'admin'), requireStore, [
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

// Supplier submits its supplier-approval application together with the legal
// documents (vergi levhası, imza sirküleri, ticaret sicil gazetesi). A
// superadmin reviews the application afterwards. Re-applying is allowed while
// the application is draft, rejected, or still pending (documents can be
// updated); approved suppliers cannot re-apply.
supplierRoutes.post('/supplier/profile/apply', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('taxDocument').optional().isString(),
  body('signatureDocument').optional().isString(),
  body('tradeRegistryDocument').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const supplier = await ensureSupplierForStore(store.id);
    if (supplier.applicationStatus === 'approved') {
      return res.status(409).json({ error: 'Supplier already approved' });
    }
    const docs: Record<string, string> = { ...((supplier.applicationDocuments as any) || {}) };
    for (const f of ['taxDocument', 'signatureDocument', 'tradeRegistryDocument'] as const) {
      if (req.body[f] !== undefined) docs[f] = req.body[f];
    }
    await supplier.update({
      applicationDocuments: docs,
      applicationStatus: 'submitted',
      applicationSubmittedAt: new Date(),
      applicationReviewedAt: null,
      rejectionNote: null,
    });
    logger.info(`Supplier store ${store.id} submitted approval application`);
    res.json({ supplier });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Apply supplier approval error');
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
supplierRoutes.get('/supplier/orders', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
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

// Supplier accepts a return on a shipped sub-order → restocks + syncs parent
supplierRoutes.post('/supplier/orders/:id/return', authMiddleware, requireRole('owner', 'admin'), requireStore, [
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
    if (sub.supplierStatus !== SUPPLIER_STATUS.FULFILLED) {
      return res.status(409).json({ error: 'Only fulfilled orders can be returned' });
    }

    const oldStatus = sub.status;
    await sub.update({ supplierStatus: SUPPLIER_STATUS.FULFILLED, status: 'returned' });
    await writeSubHistory(sub, oldStatus, 'returned', req.body.note || 'Returned by supplier');

    await restoreBuyerStock(sub);
    await syncParentOrder(sub.parentOrderId!);

    logger.info(`Supplier ${store.id} returned sub-order ${sub.id}`);
    res.json({ order: sub, supplierStatus: SUPPLIER_STATUS.FULFILLED, status: 'returned' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Return supplier order error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---- Settlements (payouts) ----

// GET /supplier/settlements — my payout records, newest first
supplierRoutes.get('/supplier/settlements', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = { storeId: store.id };
    if (req.query.status) where.status = req.query.status;

    const { count, rows } = await SupplierSettlement.findAndCountAll({
      where,
      limit,
      offset,
      order: [['period', 'DESC']],
    });

    res.json({ settlements: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List settlements error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /supplier/settlements/period?period=YYYY-MM — computed totals for a period
supplierRoutes.get('/supplier/settlements/period', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  query('period').matches(/^\d{4}-\d{2}$/),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const result = await computePeriod(store.id, req.query.period as string);
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, 'Compute period settlement error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /supplier/settlements/request — request payout for a period
supplierRoutes.post('/supplier/settlements/request', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('period').matches(/^\d{4}-\d{2}$/),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const settlement = await requestSettlement(store.id, req.body.period);
    res.json({ settlement });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Request settlement error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /supplier/settlements/:id/cancel — cancel a pending request
supplierRoutes.post('/supplier/settlements/:id/cancel', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const settlement = await SupplierSettlement.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });
    if (settlement.status !== 'requested') return res.status(409).json({ error: 'Only requested settlements can be cancelled' });

    await settlement.update({ status: 'open', requestedAt: null });
    res.json({ settlement });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Cancel settlement error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /supplier/settlements/:id/mark-paid — platform operator marks payout paid
supplierRoutes.post('/supplier/settlements/:id/mark-paid', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('payoutRef').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const settlement = await SupplierSettlement.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });
    if (settlement.status !== 'requested') return res.status(409).json({ error: 'Only requested settlements can be marked paid' });

    await settlement.update({
      status: 'paid',
      paidAt: new Date(),
      payoutRef: req.body.payoutRef || null,
    });
    logger.info(`Settlement ${settlement.id} marked paid (net=${settlement.netAmount})`);
    res.json({ settlement });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Mark settlement paid error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
