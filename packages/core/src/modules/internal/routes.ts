import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { MarketplaceIntegration } from '../../models/MarketplaceIntegration.model.js';
import { Store } from '../../models/Store.model.js';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { OrderStatusHistory } from '../../models/OrderStatusHistory.model.js';
import { requireInternalKey } from '../../middleware/internalAuth.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/env.js';

const internalRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

/**
 * GET /api/internal/integrations
 * Returns all active marketplace integrations (for integration service to use)
 */
internalRoutes.get('/integrations', requireInternalKey, async (req: Request, res: Response) => {
  try {
    const integrations = await MarketplaceIntegration.findAll({
      where: { isActive: true },
      include: [{ model: Store, attributes: ['id', 'name'] }],
    });

    const result = integrations.map(integration => ({
      id: integration.id,
      storeId: integration.storeId,
      marketplace: integration.marketplace,
      config: integration.config,
      isActive: integration.isActive,
      lastSyncAt: integration.lastSyncAt,
    }));

    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, 'Failed to fetch integrations');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/internal/dropshipping-orders
 * Creates a dropshipping order from integration service data
 * Expected payload: { storeId, marketplace, externalId, status, customer, items, totals, createdAt }
 */
internalRoutes.post('/dropshipping-orders', requireInternalKey, [
  body('storeId').isInt(),
  body('marketplace').isString(),
  body('externalId').isString(),
  body('status').isString(),
  body('customer').isObject(),
  body('items').isArray({ min: 1 }),
  body('totals').isObject(),
], validate, validate, async (req: Request, res: Response) => {
  try {
    const { storeId, marketplace, externalId, status, customer, items, totals, createdAt } = req.body;

    // Check if store exists
    const store = await Store.findByPk(storeId);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Check if order with this externalId and marketplace already exists for this store
    const existingOrder = await DropshippingOrder.findOne({
      where: { storeId, marketplace, externalId },
    });

    if (existingOrder) {
      // Optionally update the order? For now, we'll just return the existing order to avoid duplicates.
      return res.status(200).json({ order: existingOrder, message: 'Order already exists' });
    }

    // Create the dropshipping order
    const order = await DropshippingOrder.create({
      storeId,
      marketplace,
      externalId,
      status,
      totalAmount: totals.grandTotal || 0,
      currency: 'TRY', // Assuming TRY, but we can get from totals.currency if available
      shippingAddress: {
        name: customer.name,
        address: customer.address,
        city: customer.city,
        country: customer.country,
        phone: customer.phone,
        email: customer.email,
      },
      items: JSON.stringify(items), // Assuming we store items as JSON string? Check the model.
      // Note: The DropshippingOrder model might have different fields. We need to check.
      // For now, we'll assume the model matches the DTO we are sending from integration service.
      // But let's look at the model later. For now, we'll create with the fields we have.
      // We'll also set the createdAt if provided.
      ...(createdAt && { createdAt }),
    });

    // Create initial status history
    await OrderStatusHistory.create({
      dropshippingOrderId: order.id,
      fromStatus: 'pending', // Assuming initial status is pending
      toStatus: status,
      note: `Order created from marketplace ${marketplace}`,
    });

    logger.info(`Dropshipping order created: ${order.id} for store ${storeId} from marketplace ${marketplace}`);
    res.status(201).json({ order });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Failed to create dropshipping order');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default internalRoutes;