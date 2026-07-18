import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { body, param, query, validationResult } from 'express-validator';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { OrderStatusHistory } from '../../models/OrderStatusHistory.model.js';
import { Store } from '../../models/Store.model.js';
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
    if (req.query.search) where[Op.or] = [
      { orderNumber: { [Op.iLike]: `%${req.query.search}%` } },
      { marketplaceOrderId: { [Op.iLike]: `%${req.query.search}%` } },
    ];
    if (req.query.dateFrom) where.createdAt = { ...where.createdAt, [Op.gte]: req.query.dateFrom };
    if (req.query.dateTo) where.createdAt = { ...where.createdAt, [Op.lte]: req.query.dateTo };

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
  } catch (error) {
    logger.error('List orders error:', error);
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

    if (!order) return res.status(404).json({ error: 'Order not found' });

    res.json({ order });
  } catch (error) {
    logger.error('Get order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

orderRoutes.put('/:id/status', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']),
  body('note').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { status, note } = req.body;

    const order = await DropshippingOrder.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const fromStatus = order.status;
    await order.update({ status });

    await OrderStatusHistory.create({
      dropshippingOrderId: order.id,
      fromStatus,
      toStatus: status,
      note: note || `Status changed from ${fromStatus} to ${status}`,
    });

    logger.info(`Order ${order.id} status: ${fromStatus} -> ${status}`);
    res.json({ order });
  } catch (error) {
    logger.error('Update order status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

orderRoutes.put('/:id/tracking', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('trackingNumber').isString().isLength({ min: 5, max: 100 }),
  body('carrier').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { trackingNumber, carrier } = req.body;

    const order = await DropshippingOrder.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    await order.update({ trackingNumber, carrier, status: 'shipped' });

    await OrderStatusHistory.create({
      dropshippingOrderId: order.id,
      fromStatus: order.status,
      toStatus: 'shipped',
      note: `Tracking added: ${trackingNumber} (${carrier || 'unknown carrier'})`,
    });

    logger.info(`Order ${order.id} tracking: ${trackingNumber}`);
    res.json({ order });
  } catch (error) {
    logger.error('Update tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

orderRoutes.get('/:id/history', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const order = await DropshippingOrder.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const history = await OrderStatusHistory.findAll({
      where: { dropshippingOrderId: order.id },
      order: [['createdAt', 'ASC']],
    });

    res.json({ history });
  } catch (error) {
    logger.error('Get order history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

orderRoutes.post('/bulk-status', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('ids').isArray({ min: 1 }),
  body('status').isIn(['confirmed', 'processing', 'shipped', 'cancelled']),
  body('note').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { ids, status, note } = req.body;

    const orders = await DropshippingOrder.findAll({
      where: { id: ids, storeId: store.id },
    });

    for (const order of orders) {
      const fromStatus = order.status;
      await order.update({ status });
      await OrderStatusHistory.create({
        dropshippingOrderId: order.id,
        fromStatus,
        toStatus: status,
        note: note || `Bulk update: ${fromStatus} -> ${status}`,
      });
    }

    logger.info(`Bulk status update: ${orders.length} orders to ${status}`);
    res.json({ updated: orders.length });
  } catch (error) {
    logger.error('Bulk status update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});