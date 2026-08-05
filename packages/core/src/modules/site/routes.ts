import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { Store } from '../../models/Store.model.js';
import { SiteDeployment } from '../../models/SiteDeployment.model.js';
import { logger } from '../../utils/logger.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { computeNextVersion, resolveRollbackTarget, serializeDeployment } from './publish.js';

export const siteRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  // express-validator results are checked inline in each handler
  next();
};

/** Next version number for a store (last publish version + 1). */
async function nextVersion(storeId: number): Promise<number> {
  const last = await SiteDeployment.findOne({
    where: { storeId, status: 'published' },
    order: [['version', 'DESC']],
  });
  return computeNextVersion(last ? [last.version || 0] : []);
}

// GET /api/admin/site/deployments — publish history for my store
siteRoutes.get('/deployments', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const rows = await SiteDeployment.findAll({
      where: { storeId: store.id },
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    res.json({ deployments: rows.map(serializeDeployment), published: store.published });
  } catch (error) {
    logger.error({ err: error }, 'List site deployments error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/site/publish — publish the storefront (Rahatio hosting)
siteRoutes.post('/publish', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('note').optional().isString().isLength({ max: 500 }),
], async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const note = req.body.note || 'Site yayınlandı';
    const version = await nextVersion(store.id);

    await store.update({ published: true });

    const deployment = await SiteDeployment.create({
      storeId: store.id,
      status: 'published',
      version,
      siteCode: store.siteCode,
      domain: store.domain,
      siteUrl: store.siteUrl,
      themeSnapshot: store.theme || {},
      note,
      deployedAt: new Date(),
    });

    logger.info(`Store ${store.id} published site (v${version})`);
    res.json({ store: { id: store.id, published: true, siteCode: store.siteCode }, deployment: serializeDeployment(deployment) });
  } catch (error) {
    logger.error({ err: error }, 'Publish site error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/site/unpublish — take the storefront down (draft)
siteRoutes.post('/unpublish', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('note').optional().isString().isLength({ max: 500 }),
], async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const note = req.body.note || 'Site yayından kaldırıldı';

    await store.update({ published: false });

    const deployment = await SiteDeployment.create({
      storeId: store.id,
      status: 'draft',
      version: (await nextVersion(store.id)) || 1,
      siteCode: store.siteCode,
      domain: store.domain,
      siteUrl: store.siteUrl,
      themeSnapshot: store.theme || {},
      note,
    });

    logger.info(`Store ${store.id} unpublished site`);
    res.json({ store: { id: store.id, published: false, siteCode: store.siteCode }, deployment: serializeDeployment(deployment) });
  } catch (error) {
    logger.error({ err: error }, 'Unpublish site error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/site/deployments/:id/rollback — restore state from a past deployment
siteRoutes.post('/deployments/:id/rollback', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const target = await SiteDeployment.findOne({
      where: { id: req.params.id, storeId: store.id },
    });
    if (!target) return res.status(404).json({ error: 'Deployment not found' });
    if (!target.themeSnapshot && !target.siteCode) {
      return res.status(400).json({ error: 'Deployment has no snapshot to restore' });
    }

    // Restore the published state captured in the target deployment
    const restored = resolveRollbackTarget(
      { theme: store.theme, siteCode: store.siteCode, domain: store.domain, siteUrl: store.siteUrl },
      { themeSnapshot: target.themeSnapshot, siteCode: target.siteCode, domain: target.domain, siteUrl: target.siteUrl }
    );
    await store.update({
      published: true,
      theme: restored.theme,
      siteCode: restored.siteCode,
      domain: restored.domain,
      siteUrl: restored.siteUrl,
    });

    const version = (await nextVersion(store.id)) || 1;
    const deployment = await SiteDeployment.create({
      storeId: store.id,
      status: 'reverted',
      version,
      siteCode: store.siteCode,
      domain: store.domain,
      siteUrl: store.siteUrl,
      themeSnapshot: store.theme || {},
      note: `Rolled back to deployment #${target.id} (v${target.version})`,
      revertedAt: new Date(),
    });

    logger.info(`Store ${store.id} rolled back site to deployment ${target.id}`);
    res.json({
      store: { id: store.id, published: true, siteCode: store.siteCode },
      deployment: serializeDeployment(deployment),
    });
  } catch (error) {
    logger.error({ err: error }, 'Rollback site error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
