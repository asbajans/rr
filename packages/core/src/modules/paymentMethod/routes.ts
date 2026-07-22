import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { StorePaymentMethod } from '../../models/ContentModels.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const paymentMethodRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

paymentMethodRoutes.get('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const where: any = { storeId: store.id };
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === 'true';

    const methods = await StorePaymentMethod.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

    res.json({ paymentMethods: methods });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List payment methods error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

paymentMethodRoutes.post('/', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('type').isString().isLength({ min: 2, max: 50 }),
  body('config').optional().isObject(),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;

    const method = await StorePaymentMethod.create({
      storeId: store.id,
      type: req.body.type,
      config: req.body.config || {},
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
    });

    logger.info(`Payment method created: ${method.id} (${method.type}) by store ${store.id}`);
    res.status(201).json({ paymentMethod: method });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create payment method error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

paymentMethodRoutes.get('/:id', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const method = await StorePaymentMethod.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!method) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    res.json({ paymentMethod: method });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get payment method error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

paymentMethodRoutes.put('/:type', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('type').isString().isLength({ min: 2, max: 50 }),
  body('config').optional().isObject(),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const method = await StorePaymentMethod.findOne({ where: { type: req.params.type, storeId: store.id } });

    if (!method) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    const updateData: any = {};
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
    if (req.body.config !== undefined) updateData.config = req.body.config;

    await method.update(updateData);
    logger.info(`Payment method updated: ${method.id} (${method.type})`);
    res.json({ paymentMethod: method });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update payment method error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

paymentMethodRoutes.delete('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const method = await StorePaymentMethod.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!method) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    await method.destroy();
    logger.info(`Payment method deleted: ${req.params.id} (store: ${store.id})`);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete payment method error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
