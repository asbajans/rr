import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { StoreMenu } from '../../models/Menu.model.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const menuRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

menuRoutes.get('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const where: any = { storeId: store.id };
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === 'true';

    const menus = await StoreMenu.findAll({ where, order: [['createdAt', 'ASC']] });
    res.json({ menus });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List menus error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

menuRoutes.post('/', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('name').isString().isLength({ min: 2, max: 100 }),
  body('slug').isString().isLength({ min: 2, max: 100 }),
  body('items').optional().isArray(),
  body('location').optional().isString().isLength({ max: 50 }),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;

    const existing = await StoreMenu.findOne({ where: { storeId: store.id, slug: req.body.slug } });
    if (existing) {
      return res.status(409).json({ error: 'Menu with this slug already exists' });
    }

    const menu = await StoreMenu.create({
      storeId: store.id,
      name: req.body.name,
      slug: req.body.slug,
      items: req.body.items || [],
      location: req.body.location || 'header',
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
    });

    res.status(201).json({ menu });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create menu error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

menuRoutes.get('/:id', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const menu = await StoreMenu.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!menu) {
      return res.status(404).json({ error: 'Menu not found' });
    }
    res.json({ menu });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get menu error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

menuRoutes.put('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('name').optional().isString().isLength({ min: 2, max: 100 }),
  body('slug').optional().isString().isLength({ min: 2, max: 100 }),
  body('items').optional().isArray(),
  body('location').optional().isString().isLength({ max: 50 }),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const menu = await StoreMenu.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!menu) {
      return res.status(404).json({ error: 'Menu not found' });
    }

    if (req.body.slug && req.body.slug !== menu.slug) {
      const existing = await StoreMenu.findOne({ where: { storeId: store.id, slug: req.body.slug } });
      if (existing) {
        return res.status(409).json({ error: 'Menu with this slug already exists' });
      }
    }

    await menu.update(req.body);
    res.json({ menu });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update menu error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

menuRoutes.delete('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const menu = await StoreMenu.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!menu) {
      return res.status(404).json({ error: 'Menu not found' });
    }
    await menu.destroy();
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete menu error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
