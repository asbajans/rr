import { Router, Request, Response } from 'express';
import { Op, literal } from 'sequelize';
import { sequelize } from '../../config/database.js';
import { body, param, query, validationResult } from 'express-validator';
import axios from 'axios';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { OrderStatusHistory } from '../../models/OrderStatusHistory.model.js';
import { MarketplaceIntegration } from '../../models/MarketplaceIntegration.model.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { createSplitOrder } from './orderSplit.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/env.js';
import { createMarketplaceClient, getMarketplaceConfig, MarketplaceType } from '../../marketplace/clients/index.js';

const INTEGRATION_SERVICE_URL = process.env.INTEGRATION_SERVICE_URL || 'http://localhost:3002';

async function notifyIntegrationService(payload: Record<string, any>): Promise<void> {
  try {
    await axios.post(`${INTEGRATION_SERVICE_URL}/webhook/order-updated`, payload, {
      headers: { 'x-internal-key': config.apiKey.internalKey },
      timeout: 5000,
    });
  } catch (err: any) {
    logger.warn({ err: err.message, payload }, 'Failed to notify integration-service');
  }
}

export const orderRoutes: Router = Router();

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
    if (req.query.marketplace) where.marketplace = String(req.query.marketplace);
    if (req.query.search) {
      const term = `%${req.query.search}%`;
      where[Op.or] = [
        { orderNumber: { [Op.iLike]: term } },
        { marketplaceOrderId: { [Op.iLike]: term } },
        { marketplaceOrderNumber: { [Op.iLike]: term } },
        { customerName: { [Op.iLike]: term } },
        { customerEmail: { [Op.iLike]: term } },
        { customerPhone: { [Op.iLike]: term } },
        { trackingNumber: { [Op.iLike]: term } },
        literal(`COALESCE("items"::text, '') ILIKE ${sequelize.escape(`%${req.query.search}%`)}`),
      ];
    }

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
    const { marketplace, marketplaceOrderId, marketplaceOrderNumber, totalAmount, currency, shippingAddress, items } = req.body;

    const { mainOrder, subOrders } = await createSplitOrder(
      store.id, marketplace, marketplaceOrderId,
      items, totalAmount, orderNumber,
      currency || 'TRY', shippingAddress, req.body, marketplaceOrderNumber,
    );

    logger.info(`Order created: ${mainOrder.id} by store ${store.id}${subOrders.length > 0 ? ` with ${subOrders.length} sub-order(s)` : ''}`);
    res.status(201).json({ order: mainOrder, subOrders });
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

    const subOrders = await DropshippingOrder.findAll({
      where: { parentOrderId: order.id },
      include: [{ model: OrderStatusHistory, as: 'statusHistory', order: [['createdAt', 'ASC']] }],
    });

    let parentOrder = null;
    if (order.parentOrderId) {
      parentOrder = await DropshippingOrder.findByPk(order.parentOrderId, {
        attributes: ['id', 'storeId', 'orderNumber', 'marketplaceOrderId', 'status', 'totalAmount', 'currency'],
      });
    }

    res.json({ order: { ...order.toJSON(), subOrders, parentOrder } });
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

    // Propagate status to sub-orders if this is a main order
    if (!order.parentOrderId) {
      const subOrders = await DropshippingOrder.findAll({ where: { parentOrderId: order.id } });
      for (const sub of subOrders) {
        if (sub.status !== status) {
          const subOld = sub.status;
          await sub.update({ status });
          await OrderStatusHistory.create({
            dropshippingOrderId: sub.id,
            fromStatus: subOld,
            toStatus: status,
            note: `Auto-propagated from parent order ${order.id}: ${subOld} -> ${status}`,
          });
        }
      }
    }

    // Only push to marketplace for main orders, never for sub-orders (B2B)
    if (!order.parentOrderId) {
      if (order.marketplace === 'trendyol') {
        if (status === 'processing' && oldStatus === 'pending') {
          notifyIntegrationService({
            action: 'approve',
            storeId: store.id,
            marketplace: order.marketplace,
            externalId: order.marketplaceOrderId,
            lineIds: ((order.items as any[]) || [])
              .map((item: any) => ({ lineId: item.orderLineId, quantity: item.quantity }))
              .filter((x: any) => x.lineId != null),
            value: status,
          });
        }
      } else if (order.marketplace === 'n11') {
        if (status === 'processing' && oldStatus === 'pending') {
          try {
            const integration = await MarketplaceIntegration.findOne({
              where: { storeId: store.id, marketplace: 'n11', isActive: true },
            });
            if (integration) {
              const mpConfig = getMarketplaceConfig('n11', integration);
              const n11Client = createMarketplaceClient('n11', mpConfig);
              const lineIds: number[] = ((order.items as any[]) || [])
                .map((item: any) => item.orderLineId)
                .filter((id: any) => id != null);
              if (lineIds.length > 0) {
                await (n11Client as any).updateOrderStatus(lineIds, 'Picking');
                logger.info(`N11 order ${order.id} approved with ${lineIds.length} line(s)`);
              }
            }
          } catch (n11Err: any) {
            logger.error({ err: n11Err.message, orderId: order.id }, 'Failed to approve N11 order');
          }
        }
      } else if (order.marketplace !== 'storefront' && order.marketplace !== 'pazarama') {
        notifyIntegrationService({
          action: 'status',
          storeId: store.id,
          marketplace: order.marketplace,
          externalId: order.marketplaceOrderId,
          value: status,
        });
      }
    }

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

    if (order.marketplace !== 'storefront' && order.marketplace !== 'trendyol') {
      notifyIntegrationService({
        action: 'tracking',
        storeId: store.id,
        marketplace: order.marketplace,
        externalId: order.marketplaceOrderNumber || order.marketplaceOrderId,
        value: { trackingNumber, carrier },
      });
    }

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
orderRoutes.post('/bulk-status', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('ids').isArray({ min: 1 }).custom((ids: any[]) => ids.every((id: any) => Number.isInteger(id))),
  body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']),
  body('note').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { ids, status, note } = req.body;

    const orders = await DropshippingOrder.findAll({
      where: { id: ids, storeId: store.id },
    });

    if (orders.length === 0) {
      return res.status(404).json({ error: 'No matching orders found' });
    }

    const historyEntries = [];
    for (const order of orders) {
      const oldStatus = order.status;
      await order.update({ status });
      historyEntries.push({
        dropshippingOrderId: order.id,
        fromStatus: oldStatus,
        toStatus: status,
        note: note || `Bulk status change: ${oldStatus} -> ${status}`,
      });
    }

    await OrderStatusHistory.bulkCreate(historyEntries);

    logger.info(`Bulk status update: ${orders.length} orders -> ${status} by store ${store.id}`);
    res.json({ success: true, updated: orders.length });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Bulk order status error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

orderRoutes.get('/:id/label', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const order = await DropshippingOrder.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // For B2B sub-orders, use the parent order's store + marketplaceOrderId
    let targetStoreId = store.id;
    let marketplaceOrderId = order.marketplaceOrderId;
    if (order.parentOrderId) {
      const parent = await DropshippingOrder.findByPk(order.parentOrderId, {
        attributes: ['storeId', 'marketplaceOrderId'],
      });
      if (parent) {
        targetStoreId = parent.storeId;
        marketplaceOrderId = parent.marketplaceOrderId;
      }
    }

    if (order.marketplace === 'trendyol') {
      const integration = await MarketplaceIntegration.findOne({
        where: { storeId: targetStoreId, marketplace: 'trendyol', isActive: true },
      });
      if (integration) {
        const mpConfig = getMarketplaceConfig('trendyol' as MarketplaceType, integration);
        const client = createMarketplaceClient('trendyol' as MarketplaceType, mpConfig) as any;
        const label = await (client as any).getOrderLabel({ packageId: marketplaceOrderId, trackingNumber: order.get('trackingNumber') });
        if (label) {
          const updateData: any = {};
          if (label.labelUrl) updateData.labelUrl = label.labelUrl;
          if (label.labelZpl) updateData.labelZpl = label.labelZpl;
          if (label.cargoCompany) updateData.cargoCompany = label.cargoCompany;
          if (Object.keys(updateData).length > 0) await order.update(updateData);
          return res.json({
            labelUrl: label.labelUrl || null,
            labelZpl: label.labelZpl || null,
            cargoCompany: label.cargoCompany || null,
          });
        }
      }
    }

    res.json({
      labelUrl: order.get('labelUrl') || null,
      labelZpl: order.get('labelZpl') || null,
      cargoCompany: order.get('cargoCompany') || null,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get order label error');
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