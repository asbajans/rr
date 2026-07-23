import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { StorePaymentMethod } from '../../models/ContentModels.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const paymentMethodRoutes: Router = Router();

const DEFAULT_METHODS = [
  { type: 'bank_transfer', label: 'Banka Havalesi', config: { iban: '', bank_name: '', account_holder: '' } },
  { type: 'stripe', label: 'Kredi Kartı (Stripe)', config: { publishable_key: '', secret_key: '', webhook_secret: '' } },
  { type: 'iyzico', label: 'Kredi Kartı (Iyzico)', config: { api_key: '', secret_key: '', base_url: 'https://sandbox-api.iyzipay.com' } },
  { type: 'paytr', label: 'Kredi Kartı (PayTR)', config: { merchant_id: '', merchant_key: '', merchant_salt: '' } },
  { type: 'crypto', label: 'Kripto Para', config: { wallet_address: '', network: 'ERC20' } },
  { type: 'cash_on_delivery', label: 'Kapıda Ödeme', config: { extra_fee: '0' } },
];

async function seedDefaultMethods(storeId: number) {
  const count = await StorePaymentMethod.count({ where: { storeId } });
  if (count > 0) return;

  for (const def of DEFAULT_METHODS) {
    await StorePaymentMethod.create({
      storeId,
      type: def.type,
      config: def.config,
      isActive: false,
    });
  }
  logger.info(`Default payment methods seeded for store ${storeId}`);
}

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

    let methods = await StorePaymentMethod.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

    if (methods.length === 0) {
      await seedDefaultMethods(store.id);
      methods = await StorePaymentMethod.findAll({ where: { storeId: store.id }, order: [['createdAt', 'DESC']] });
    }

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
    let method = await StorePaymentMethod.findOne({ where: { type: req.params.type, storeId: store.id } });

    if (!method) {
      const def = DEFAULT_METHODS.find(d => d.type === req.params.type);
      method = await StorePaymentMethod.create({
        storeId: store.id,
        type: req.params.type,
        config: def?.config || {},
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      });
      logger.info(`Payment method auto-created: ${method.id} (${method.type}) by store ${store.id}`);
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
