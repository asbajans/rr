import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { MarketplaceIntegration } from '../../models/MarketplaceIntegration.model.js';
import { Store } from '../../models/Store.model.js';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { createSplitOrder } from '../order/orderSplit.js';
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
    const { storeId, marketplace, externalId, status, customer, items, totals } = req.body;

    // Check if store exists
    const store = await Store.findByPk(storeId);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Check if order with this externalId and marketplace already exists for this store
    const existingOrder = await DropshippingOrder.findOne({
      where: { storeId, marketplace, marketplaceOrderId: String(externalId) },
    });

    if (existingOrder) {
      return res.status(200).json({ order: existingOrder, message: 'Order already exists' });
    }

    const orderNumber = totals.orderNumber || `ORD-${Date.now()}`;
    const { mainOrder } = await createSplitOrder(
      storeId,
      marketplace,
      String(externalId),
      items,
      totals.grandTotal || 0,
      orderNumber,
      totals.currency || 'TRY',
      {
        name: customer.name,
        address: customer.address,
        city: customer.city,
        country: customer.country,
        phone: customer.phone,
        email: customer.email,
      },
      {},
      totals.orderNumber,
      customer.name,
      customer.email,
      customer.phone,
      { status: status || 'pending' },
    );

    logger.info(`Dropshipping order created: ${mainOrder.id} for store ${storeId} from marketplace ${marketplace}`);
    res.status(201).json({ order: mainOrder });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Failed to create dropshipping order');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default internalRoutes;