import { Router, Request, Response } from 'express';
import { query, param, validationResult } from 'express-validator';
import { StoreNotification } from '../../models/StoreNotification.model.js';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const notificationRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

notificationRoutes.get('/', authMiddleware, requireStore, [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
], async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const limit = Number(req.query.limit || 30);
    const offset = Number(req.query.offset || 0);
    const { rows, count } = await StoreNotification.findAndCountAll({
      where: { storeId: store.id },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    const unreadCount = await StoreNotification.count({
      where: { storeId: store.id, readAt: null },
    });
    res.json({ notifications: rows, total: count, unreadCount });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Notifications list error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

notificationRoutes.get('/unread-count', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const unreadCount = await StoreNotification.count({
      where: { storeId: store.id, readAt: null },
    });
    res.json({ unreadCount });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Notifications unread-count error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

notificationRoutes.post('/read-all', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    await StoreNotification.update({ readAt: new Date() }, { where: { storeId: store.id, readAt: null } });
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Notifications read-all error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

notificationRoutes.post('/:id/read', authMiddleware, requireStore, [
  param('id').isInt({ min: 1 }),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const id = Number(req.params.id);
    const notif = await StoreNotification.findOne({ where: { id, storeId: store.id } });
    if (!notif) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    await notif.update({ readAt: new Date() });
    res.json({ notification: notif });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Notification read error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
