import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Store } from '../../models/Store.model.js';
import { logger } from '../../utils/logger.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { getLowStockCount, getLowStockProducts } from './warning.js';

export const stockRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

// GET /api/admin/stocks/warnings — low-stock products + current threshold
stockRoutes.get('/warnings', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store as Store;
    const threshold = store.lowStockThreshold ?? 5;
    const [products, count] = await Promise.all([
      getLowStockProducts(store.id),
      getLowStockCount(store.id),
    ]);
    res.json({
      threshold,
      count,
      products: products.map((p) => ({
        id: p.id,
        title: p.title,
        sku: p.sku,
        quantity: p.quantity,
        image: Array.isArray(p.images) && p.images.length ? p.images[0] : null,
      })),
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Low stock warnings error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/stocks/threshold — configure the store's low-stock threshold
stockRoutes.put('/threshold', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('threshold').isInt({ min: 0, max: 100000 }),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store as Store;
    await store.update({ lowStockThreshold: req.body.threshold });
    res.json({ success: true, threshold: store.lowStockThreshold ?? req.body.threshold });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Set low stock threshold error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/stocks/check — run the low-stock scan now (returns created notifications)
stockRoutes.post('/check', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store as Store;
    const { checkStoreLowStock } = await import('./warning.js');
    const created = await checkStoreLowStock(store.id);
    res.json({ success: true, created });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Low stock check error');
    res.status(500).json({ error: 'Internal server error' });
  }
});