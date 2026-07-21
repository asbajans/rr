import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { StoreLocation } from '../../models/ContentModels.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const locationRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

locationRoutes.get('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const where: any = { storeId: store.id };
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === 'true';

    const locations = await StoreLocation.findAll({
      where,
      order: [['name', 'ASC']],
    });

    res.json({ locations });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List locations error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

locationRoutes.post('/', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('name').isString().isLength({ min: 2, max: 255 }),
  body('address').optional().isString(),
  body('coordinates').optional().isObject(),
  body('phone').optional().isString(),
  body('hours').optional().isObject(),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;

    const location = await StoreLocation.create({
      storeId: store.id,
      name: req.body.name,
      address: req.body.address || null,
      coordinates: req.body.coordinates || null,
      phone: req.body.phone || null,
      hours: req.body.hours || null,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
    });

    logger.info(`Location created: ${location.id} (${location.name}) by store ${store.id}`);
    res.status(201).json({ location });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create location error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

locationRoutes.get('/:id', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const location = await StoreLocation.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json({ location });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get location error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

locationRoutes.put('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('name').optional().isString().isLength({ min: 2, max: 255 }),
  body('address').optional().isString(),
  body('coordinates').optional().isObject(),
  body('phone').optional().isString(),
  body('hours').optional().isObject(),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const location = await StoreLocation.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    await location.update(req.body);
    logger.info(`Location updated: ${location.id} (${location.name})`);
    res.json({ location });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update location error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

locationRoutes.delete('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const location = await StoreLocation.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    await location.destroy();
    logger.info(`Location deleted: ${req.params.id} (store: ${store.id})`);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete location error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
