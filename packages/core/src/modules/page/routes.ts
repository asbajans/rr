import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { Page } from '../../models/ContentModels.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const pageRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

pageRoutes.get('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const where: any = { storeId: store.id };
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === 'true';

    const { count, rows } = await Page.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    res.json({
      pages: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List pages error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

pageRoutes.post('/', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('slug').isString().isLength({ min: 2, max: 200 }),
  body('title').isObject(),
  body('content').optional().isObject(),
  body('meta').optional().isObject(),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;

    const existing = await Page.findOne({ where: { storeId: store.id, slug: req.body.slug } });
    if (existing) {
      return res.status(409).json({ error: 'Page with this slug already exists' });
    }

    const page = await Page.create({
      storeId: store.id,
      slug: req.body.slug,
      title: req.body.title,
      content: req.body.content || null,
      meta: req.body.meta || null,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
    });

    logger.info(`Page created: ${page.id} (${page.slug}) by store ${store.id}`);
    res.status(201).json({ page });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create page error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

pageRoutes.get('/:id', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const page = await Page.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({ page });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get page error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

pageRoutes.put('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('slug').optional().isString().isLength({ min: 2, max: 200 }),
  body('title').optional().isObject(),
  body('content').optional().isObject(),
  body('meta').optional().isObject(),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const page = await Page.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    if (req.body.slug && req.body.slug !== page.slug) {
      const existing = await Page.findOne({ where: { storeId: store.id, slug: req.body.slug } });
      if (existing) {
        return res.status(409).json({ error: 'Page with this slug already exists' });
      }
    }

    await page.update(req.body);
    logger.info(`Page updated: ${page.id} (${page.slug})`);
    res.json({ page });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update page error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

pageRoutes.delete('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const page = await Page.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    await page.destroy();
    logger.info(`Page deleted: ${req.params.id} (store: ${store.id})`);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete page error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
