import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { Store } from '../../models/Store.model.js';
import { Plan } from '../../models/Plan.model.js';
import { SiteDeployment } from '../../models/SiteDeployment.model.js';
import { logger } from '../../utils/logger.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { computeNextVersion, resolveRollbackTarget, serializeDeployment } from './publish.js';
import { getHostingProvider, getVercelAdapterForStore, verifyVercelToken } from './providers.js';
import { buildVercelArtifactFiles } from '../slave/routes.js';

export const siteRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  // express-validator results are checked inline in each handler
  next();
};

function isValidHostname(value: string): boolean {
  const domain = value.trim().toLowerCase().replace(/\.$/, '');
  return domain.length <= 253 && /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain);
}

async function latestVercelDeployment(storeId: number) {
  return SiteDeployment.findOne({
    where: { storeId, provider: 'vercel' },
    order: [['createdAt', 'DESC']],
  });
}

async function storeHosting(store: Store): Promise<'rahatio' | 'vercel' | 'custom'> {
  const plan = (store as any).plan || (store.planId ? await Plan.findByPk(store.planId) : null);
  return plan?.hosting || 'rahatio';
}

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

// GET /api/admin/site/provider — shared web/mobile hosting capability contract
siteRoutes.get('/provider', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const provider = await storeHosting(store);
  let configured = true;
  let reason: string | null = null;
  try { getHostingProvider(provider, store); } catch (error: any) { configured = false; reason = error.message; }
  const hasOwnToken = !!(store as any).vercelToken;
  res.json({ provider, configured, reason, canDeploy: configured, hasOwnToken, supportedProviders: ['rahatio', 'vercel', 'custom'] });
});

// Per-store Vercel token (Option B — kendi hesabına deploy)
function maskToken(token: string | null | undefined): string | null {
  if (!token) return null;
  if (token.length <= 8) return '****';
  return token.slice(0, 4) + '****' + token.slice(-4);
}

// GET /api/admin/site/vercel-config — per-store Vercel credentials (masked)
siteRoutes.get('/vercel-config', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  const store = (req as any).store;
  res.json({
    hasToken: !!(store as any).vercelToken,
    maskedToken: maskToken((store as any).vercelToken),
    teamId: (store as any).vercelTeamId || null,
  });
});

// PUT /api/admin/site/vercel-config — save & verify token (Option B)
siteRoutes.put('/vercel-config', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const token = String(req.body?.token || '').trim();
  const teamId = req.body?.teamId ? String(req.body.teamId).trim() : null;
  if (!token) {
    // Clear token
    await store.update({ vercelToken: null, vercelTeamId: null });
    return res.json({ hasToken: false, maskedToken: null, teamId: null });
  }
  if (token.length < 10) return res.status(400).json({ error: 'Token çok kısa — Vercel Dashboard → Settings → Tokens → Create' });
  try {
    await verifyVercelToken(token, teamId);
  } catch (error: any) {
    const msg = error.response?.data?.error?.message || error.message || 'Token doğrulanamadı';
    return res.status(400).json({ error: `Vercel token doğrulanamadı: ${msg}` });
  }
  await store.update({ vercelToken: token, vercelTeamId: teamId || null });
  res.json({ hasToken: true, maskedToken: maskToken(token), teamId: teamId || null });
});

// DELETE /api/admin/site/vercel-config — remove token
siteRoutes.delete('/vercel-config', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  const store = (req as any).store;
  await store.update({ vercelToken: null, vercelTeamId: null });
  res.json({ hasToken: false });
});

// POST /api/admin/site/mapping — manual siteUrl + domain update (Option A — ZIP ile kendi Vercel'ine deploy edenler)
siteRoutes.post('/mapping', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const rawUrl = req.body?.siteUrl ? String(req.body.siteUrl).trim() : null;
  const rawDomain = req.body?.domain ? String(req.body.domain).trim().toLowerCase().replace(/\.$/, '') : null;
  let siteUrl: string | null = null;
  if (rawUrl) {
    try {
      const u = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
      siteUrl = u.toString().replace(/\/$/, '');
    } catch { return res.status(400).json({ error: 'Geçerli bir site URL girin (https://xxx.vercel.app)' }); }
  }
  if (rawDomain && !isValidHostname(rawDomain)) return res.status(400).json({ error: 'Geçerli bir domain girin' });
  await store.update({ siteUrl: siteUrl || store.siteUrl, domain: rawDomain !== undefined ? rawDomain : store.domain });
  if (rawDomain) {
    const dep = await latestVercelDeployment(store.id);
    if (dep) await dep.update({ domain: rawDomain, siteUrl: siteUrl || dep.siteUrl });
  }
  res.json({ siteUrl: store.siteUrl, domain: store.domain });
});

// POST /api/admin/site/domain — add a custom domain to the managed Vercel project (Option B — requires deployment + token)
siteRoutes.post('/domain', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const domain = String(req.body?.domain || '').trim().toLowerCase().replace(/\.$/, '');
  if (!isValidHostname(domain)) return res.status(400).json({ error: 'Geçerli bir domain girin' });
  if (await storeHosting(store) !== 'vercel') return res.status(409).json({ error: 'Custom domain için Vercel hosting planı gerekir' });

  try {
    const deployment = await latestVercelDeployment(store.id);
    if (!deployment?.providerProjectId) return res.status(409).json({ error: 'Önce Vercel deployment başlatılmalı (ZIP ile manuel veya token ile otomatik)' });
    // Token override via body for one-off, else per-store
    const override = req.body?.token ? { token: String(req.body.token), teamId: req.body?.teamId ? String(req.body.teamId) : null } : undefined;
    const adapter = getVercelAdapterForStore(store, override);
    if (!adapter.addDomain) return res.status(501).json({ error: 'Vercel domain işlemi kullanılamıyor' });
    const result = await adapter.addDomain(deployment.providerProjectId, domain);
    await deployment.update({ domain: result.domain });
    if (result.verified) {
      await store.update({ domain });
      await deployment.update({ siteUrl: result.url || deployment.siteUrl, providerUrl: result.url || deployment.providerUrl });
    }
    res.json({ domain: result.domain, verified: result.verified, configured: result.configured, verification: result.verification, url: result.url || null });
  } catch (error: any) {
    logger.error({ err: error, storeId: store.id, domain }, 'Add Vercel domain error');
    res.status(502).json({ error: error.message || 'Domain eklenemedi' });
  }
});

// GET /api/admin/site/domain — current Vercel domain verification state
siteRoutes.get('/domain', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const latest = await latestVercelDeployment(store.id);
  const domain = String(latest?.domain || store.domain || '').trim().toLowerCase();
  if (!domain) return res.json({ domain: null, verified: false, configured: false, verification: [] });
  try {
    const deployment = latest;
    if (!deployment?.providerProjectId) return res.json({ domain, verified: false, configured: false, verification: [] });
    const adapter = getVercelAdapterForStore(store);
    if (!adapter.getDomain) return res.status(501).json({ error: 'Vercel domain işlemi kullanılamıyor' });
    res.json(await adapter.getDomain(deployment.providerProjectId, domain));
  } catch (error: any) {
    logger.error({ err: error, storeId: store.id, domain }, 'Get Vercel domain error');
    res.status(502).json({ error: error.message || 'Domain durumu alınamadı' });
  }
});

// POST /api/admin/site/domain/verify — retry DNS verification at Vercel
siteRoutes.post('/domain/verify', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const deployment = await latestVercelDeployment(store.id);
  const domain = String(deployment?.domain || store.domain || '').trim().toLowerCase();
  if (!domain) return res.status(400).json({ error: 'Önce bir domain ekleyin' });
  try {
    if (!deployment?.providerProjectId) return res.status(409).json({ error: 'Önce Vercel deployment başlatılmalı' });
    const adapter = getVercelAdapterForStore(store);
    if (!adapter.verifyDomain) return res.status(501).json({ error: 'Vercel domain doğrulaması kullanılamıyor' });
    const result = await adapter.verifyDomain(deployment.providerProjectId, domain);
    if (result.verified) await deployment.update({ siteUrl: result.url || deployment.siteUrl, providerUrl: result.url || deployment.providerUrl });
    res.json(result);
  } catch (error: any) {
    logger.error({ err: error, storeId: store.id, domain }, 'Verify Vercel domain error');
    res.status(502).json({ error: error.message || 'Domain doğrulanamadı' });
  }
});

// POST /api/admin/site/deploy — managed deployment for the plan's provider (Option B uses per-store token)
siteRoutes.post('/deploy', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const provider = await storeHosting(store);
  // Optional per-request token override (user pastes token without saving)
  const override = req.body?.token ? { token: String(req.body.token), teamId: req.body?.teamId ? String(req.body.teamId) : null } : undefined;
  if (override?.token && provider === 'vercel') {
    // Verify quickly before deploy
    try { await verifyVercelToken(override.token, override.teamId); } catch (e: any) { return res.status(400).json({ error: e.message || 'Vercel token geçersiz' }); }
    // Persist if user wants to save (body.saveToken truthy)
    if (req.body?.saveToken) await store.update({ vercelToken: override.token, vercelTeamId: override.teamId || null });
  }
  try {
    const adapter = provider === 'vercel' ? getVercelAdapterForStore(store, override) : getHostingProvider(provider, store);
    const files = provider === 'vercel' ? await buildVercelArtifactFiles(store) : undefined;
    const result = await adapter.deploy({ storeId: store.id, siteCode: store.siteCode, siteUrl: store.siteUrl, files });
    const deployment = await SiteDeployment.create({
      storeId: store.id,
      status: result.status === 'ready' ? 'published' : 'draft',
      version: await nextVersion(store.id),
      siteCode: store.siteCode,
      domain: store.domain,
      siteUrl: result.url || store.siteUrl,
      themeSnapshot: store.theme || {},
      note: req.body?.note || `Managed ${provider} deployment`,
      provider,
      providerProjectId: result.projectId || null,
      providerDeploymentId: result.deploymentId || null,
      providerStatus: result.status,
      providerUrl: result.url || null,
      deployedAt: result.status === 'ready' ? new Date() : null,
    });
    res.status(result.status === 'ready' ? 200 : 202).json({ deployment: serializeDeployment(deployment) });
  } catch (error: any) {
    logger.error({ err: error, storeId: store.id, provider }, 'Managed site deployment error');
    const deployment = await SiteDeployment.create({
      storeId: store.id, status: 'failed', version: await nextVersion(store.id), siteCode: store.siteCode,
      domain: store.domain, siteUrl: store.siteUrl, themeSnapshot: store.theme || {}, note: req.body?.note || `Failed ${provider} deployment`,
      provider, providerStatus: 'error', providerError: String(error.message || error).slice(0, 2000),
    }).catch(() => null);
    res.status(502).json({ error: error.message || 'Deployment failed', deployment: deployment ? serializeDeployment(deployment) : null });
  }
});

siteRoutes.get('/deployments/:id/status', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const deployment = await SiteDeployment.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
    if (!deployment.providerDeploymentId || deployment.providerStatus !== 'pending') return res.json({ deployment: serializeDeployment(deployment) });
    const adapter = deployment.provider === 'vercel' ? getVercelAdapterForStore(store) : getHostingProvider(deployment.provider, store);
    const result = await adapter.getStatus(deployment.providerDeploymentId);
    await deployment.update({ providerStatus: result.status, providerUrl: result.url || deployment.providerUrl, providerError: result.error || null, status: result.status === 'ready' ? 'published' : result.status === 'error' ? 'failed' : deployment.status, deployedAt: result.status === 'ready' ? new Date() : deployment.deployedAt });
    res.json({ deployment: serializeDeployment(deployment) });
  } catch (error: any) {
    logger.error({ err: error }, 'Deployment status error');
    res.status(502).json({ error: error.message || 'Deployment status unavailable' });
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


