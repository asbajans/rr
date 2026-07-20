import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { body, param, query, validationResult } from 'express-validator';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { OrderStatusHistory } from '../../models/OrderStatusHistory.model.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const orderRoutes = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

orderRoutes.get('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const where: any = { storeId: store.id };
    if (req.query.status) where.status = req.query.status;
    if (req.query.marketplace) where.marketplace = req.query.markplace;

    const { count, rows } = await DropshippingOrder.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    res.json({
      orders: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List orders error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

orderRoutes.post('/', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('marketplace').isIn(['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy', 'storefront']),
  body('marketplaceOrderId').isString(),
  body('marketplaceOrderNumber').optional().isString(),
  body('totalAmount').isFloat({ min: 0 }),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }),
  body('shippingAddress').isObject(),
  body('items').isArray({ min: 1 }),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const orderNumber = `ORD-${Date.now()}`;

    const order = await DropshippingOrder.create({
      storeId: store.id,
      orderNumber,
      ...req.body,
    });

    await OrderStatusHistory.create({
      dropshippingOrderId: order.id,
      fromStatus: null,
      toStatus: 'pending',
      note: 'Order created manually',
    });

    logger.info(`Order created: ${order.id} by store ${store.id}`);
    res.status(201).json({ order });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create order error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

orderRoutes.get('/:id', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const order = await DropshippingOrder.findOne({
      where: { id: req.params.id, storeId: store.id },
      include: [{ model: OrderStatusHistory, as: 'statusHistory', order: [['createdAt', 'ASC']] }],
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get order error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

orderRoutes.put('/:id/status', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']),
  body('note').optional().isString(),
  body('trackingNumber').optional().isString(),
  body('carrier').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { status, note, trackingNumber, carrier } = req.body;

    const order = await DropshippingOrder.findOne({
      where: { id: req.params.id, storeId: store.id },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const oldStatus = order.status;
    const updateData: any = { status };

    if (trackingNumber) updateData.trackingNumber = trackingNumber;
    if (carrier) updateData.carrier = carrier;

    await order.update(updateData);

    await OrderStatusHistory.create({
      dropshippingOrderId: order.id,
      fromStatus: oldStatus,
      toStatus: status,
      note: note || `Status changed from ${oldStatus} to ${status}`,
    });

    logger.info(`Order ${order.id} status: ${oldStatus} -> ${status}`);
    res.json({ order });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update order status error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

orderRoutes.put('/:id/tracking', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('trackingNumber').isString().isLength({ min: 5 }),
  body('carrier').isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { trackingNumber, carrier } = req.body;

    const order = await DropshippingOrder.findOne({
      where: { id: req.params.id, storeId: store.id },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await order.update({ trackingNumber, carrier });

    await OrderStatusHistory.create({
      dropshippingOrderId: order.id,
      fromStatus: order.status,
      toStatus: 'shipped',
      note: `Tracking added: ${carrier} - ${trackingNumber}`,
    });

    res.json({ order });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update tracking error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

orderRoutes.delete('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const order = await DropshippingOrder.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await order.destroy();
    logger.info(`Order deleted: ${req.params.id} by store ${store.id}`);
    res.json({ success: true });
} catch (error: unknown) {
    logger.error({ err: error }, 'Delete order error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
orderRoutes.get('/:id/history', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const order = await DropshippingOrder.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const history = await OrderStatusHistory.findAll({
      where: { dropshippingOrderId: order.id },
      order: [['createdAt', 'ASC']],
    });

    res.json({ history });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Order history error');
    res.status(500).json({ error: 'Internal server error' });
  }
});