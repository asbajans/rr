import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Store } from '../../models/Store.model.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

const PIXEL_PLATFORMS = [
  'google_analytics',
  'google_tag_manager',
  'google_merchant_center',
  'facebook_pixel',
  'instagram',
  'tiktok_pixel',
  'custom_head',
  'custom_body',
];

router.get('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const pixels = store.pixels || {};
    res.json({ pixels });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get pixels error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('pixels').isObject(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const incoming = req.body.pixels || {};

    const clean: Record<string, any> = {};
    for (const platform of PIXEL_PLATFORMS) {
      const p = incoming[platform];
      if (p && typeof p === 'object') {
        clean[platform] = {
          enabled: !!p.enabled,
          ...(p.measurement_id ? { measurement_id: String(p.measurement_id) } : {}),
          ...(p.container_id ? { container_id: String(p.container_id) } : {}),
          ...(p.pixel_id ? { pixel_id: String(p.pixel_id) } : {}),
          ...(p.merchant_id ? { merchant_id: String(p.merchant_id) } : {}),
          ...(p.business_account_id ? { business_account_id: String(p.business_account_id) } : {}),
          ...(p.code ? { code: String(p.code) } : {}),
        };
      }
    }

    await store.update({ pixels: clean });
    logger.info(`Pixels updated for store ${store.id}`);
    res.json({ pixels: clean });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update pixels error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as pixelRoutes };
