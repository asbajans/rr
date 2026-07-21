import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { ExternalFeed, FeedSyncLog } from '../../models/ContentModels.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const feedRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

feedRoutes.get('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const where: any = { storeId: store.id };
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === 'true';

    const { count, rows } = await ExternalFeed.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    res.json({
      feeds: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List feeds error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

feedRoutes.post('/', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('name').isString().isLength({ min: 2, max: 100 }),
  body('url').isString().isLength({ min: 2, max: 500 }),
  body('format').isString().isIn(['xml', 'json', 'csv']),
  body('mapping').optional().isObject(),
  body('schedule').optional().isString(),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;

    const feed = await ExternalFeed.create({
      storeId: store.id,
      name: req.body.name,
      url: req.body.url,
      format: req.body.format,
      mapping: req.body.mapping || null,
      schedule: req.body.schedule || null,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
    });

    logger.info(`Feed created: ${feed.id} (${feed.name}) by store ${store.id}`);
    res.status(201).json({ feed });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create feed error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

feedRoutes.get('/:id', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const feed = await ExternalFeed.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    res.json({ feed });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get feed error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

feedRoutes.put('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('name').optional().isString().isLength({ min: 2, max: 100 }),
  body('url').optional().isString().isLength({ min: 2, max: 500 }),
  body('format').optional().isString().isIn(['xml', 'json', 'csv']),
  body('mapping').optional().isObject(),
  body('schedule').optional().isString(),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const feed = await ExternalFeed.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    await feed.update(req.body);
    logger.info(`Feed updated: ${feed.id} (${feed.name})`);
    res.json({ feed });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update feed error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

feedRoutes.delete('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const feed = await ExternalFeed.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    await feed.destroy();
    logger.info(`Feed deleted: ${req.params.id} (store: ${store.id})`);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete feed error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

feedRoutes.post('/:id/test', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const feed = await ExternalFeed.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    const axios = (await import('axios')).default;
    const response = await axios.get(feed.url, { timeout: 15000 });

    const sample = response.data;
    const recordCount = Array.isArray(sample) ? sample.length : typeof sample === 'object' ? Object.keys(sample).length : 0;

    res.json({
      success: true,
      format: feed.format,
      recordCount,
      sample: Array.isArray(sample) ? sample.slice(0, 3) : sample,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Test feed error');
    res.status(500).json({ error: 'Failed to fetch or parse feed' });
  }
});

feedRoutes.post('/:id/sync', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const feed = await ExternalFeed.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    const syncLog = await FeedSyncLog.create({
      feedId: feed.id,
      status: 'pending',
    });

    const syncQueue = (await import('../../queues/index.js')).syncQueue;
    const job = await syncQueue.add('feed-sync', { feedId: feed.id, syncLogId: syncLog.id });

    await feed.update({ lastSyncAt: new Date() });

    res.status(202).json({ syncLogId: syncLog.id, jobId: job.id, message: 'Feed sync job queued' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Feed sync error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
