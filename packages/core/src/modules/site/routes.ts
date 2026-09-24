import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import crypto from 'crypto';
import { promises as dns } from 'node:dns';
import https from 'node:https';
import http from 'node:http';
import { Store } from '../../models/Store.model.js';
import { Plan } from '../../models/Plan.model.js';
import { SiteDeployment } from '../../models/SiteDeployment.model.js';
import { logger } from '../../utils/logger.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { computeNextVersion, resolveRollbackTarget, serializeDeployment } from './publish.js';
import { getHostingProvider, getVercelAdapterForStore, verifyVercelToken } from './providers.js';
import { buildVercelArtifactFiles } from '../slave/routes.js';
import { config } from '../../config/index.js';
import {
  isCloudflareConfigured,
  getCloudflarePublicConfig,
  getTunnelConfig,
  ensureFallbackIngress,
  ensureSaaSDnsRecords,
  createCustomHostname,
  getCustomHostname,
  getCustomHostnameStatus,
  deleteCustomHostname,
  getFallbackOrigin,
  putFallbackOrigin,
  getZoneByName,
  createZone,
  listDnsRecordsForZone,
  createDnsRecordForZone,
  updateDnsRecordForZone,
  deleteDnsRecordForZone,
  getZoneDetails,
  deleteZone,
  ensureTunnelHostname,
  removeTunnelHostname,
} from './cloudflare.js';

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

function normalizeDomainInput(v: string): string {
  return v.trim().toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
}
function getStoreDomains(store: any): Array<{ domain: string; verified: boolean; method?: string | null; addedAt?: string; lastCheckedAt?: string | null }> {
  const raw = (store as any).domains;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; } }
  // Fallback to single domain field
  if ((store as any).domain) return [{ domain: String((store as any).domain).toLowerCase(), verified: true, addedAt: new Date().toISOString() }];
  return [];
}
function domainVerificationToken(storeId: number, domain: string): string {
  return crypto.createHmac('sha256', (config as any).internal?.key || 'fallback').update(`domain-verify:${storeId}:${domain}`).digest('hex').slice(0,24);
}
function fetchHealthForDomain(domain: string, timeoutMs = 6000): Promise<{ ok: boolean; body?: any; error?: string }> {
  return new Promise((resolve) => {
    const tryFetch = (proto: 'https'|'http', cb:(r:any)=>void) => {
      const mod = proto === 'https' ? https : http;
      const req = mod.get(`${proto}://${domain}/health`, { timeout: timeoutMs }, (res) => {
        let data=''; res.on('data',c=>data+=c); res.on('end',()=>{
          try { const j=JSON.parse(data); cb({ ok: res.statusCode===200 && j.status==='ok', body: j }); } catch { cb({ ok:false, error:'invalid json' }); }
        });
      });
      req.on('error', (e:any)=> cb({ ok:false, error: e.message }));
      req.on('timeout', ()=> { req.destroy(); cb({ ok:false, error:'timeout' }); });
    };
    tryFetch('https', (r1)=> {
      if (r1.ok) resolve(r1);
      else tryFetch('http', (r2)=> resolve(r2.ok? r2 : r1));
    });
  });
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

// Domain Yönetimi — max 5, her domain ayrı doğrulama (Vercel / PHP health / Cloudflare SaaS)
siteRoutes.get('/domains', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const domains = getStoreDomains(store);
  const cf = getCloudflarePublicConfig();
  // Enrich unverified domains with SaaS instructions if Cloudflare configured
  const enriched = await Promise.all(domains.map(async (d: any) => {
    if (d.verified || !isCloudflareConfigured()) return d;
    try {
      // Full zone (NS) workflow — show actual per-zone NS, not hardcoded
      if (d.zoneId) {
        try {
          const zone = await getZoneDetails(d.zoneId).catch(() => null) || await getZoneByName(d.domain).catch(() => null);
          if (zone && Array.isArray(zone.name_servers) && zone.name_servers.length) {
            return { ...d, cloudflare: { zoneId: zone.id, status: zone.status, nameServers: zone.name_servers, cnameTarget: cf.cnameTarget, fallbackOrigin: cf.fallbackOrigin, hint: `NS değiştir: ${d.domain} -> ${zone.name_servers.join(' / ')}` } } as any;
          }
        } catch {}
      }
      const st = await getCustomHostnameStatus(d.domain).catch(() => null);
      if (st?.found && st.verification) {
        return { ...d, cloudflare: { status: st.status, sslStatus: st.sslStatus, verification: st.verification, cnameTarget: cf.cnameTarget, fallbackOrigin: cf.fallbackOrigin } } as any;
      }
      return { ...d, cloudflare: { cnameTarget: cf.cnameTarget, fallbackOrigin: cf.fallbackOrigin, hint: `DNS'te CNAME oluştur: ${d.domain} -> ${cf.cnameTarget}` } } as any;
    } catch { return d; }
  }));
  res.json({ domains: enriched, max: 5, primary: (store as any).domain || null, cloudflare: cf });
});

// Cloudflare SaaS public config — frontend guide needs it without auth? keep auth for now
siteRoutes.get('/cloudflare', authMiddleware, requireRole('owner', 'admin'), requireStore, async (_req: Request, res: Response) => {
  res.json(getCloudflarePublicConfig());
});

siteRoutes.post('/cloudflare/setup', authMiddleware, requireRole('owner', 'admin'), requireStore, async (_req: Request, res: Response) => {
  if (!isCloudflareConfigured()) return res.status(503).json({ error: 'Cloudflare API yapılandırılmadı — CLOUDFLARE_API_TOKEN / ACCOUNT_ID / ZONE_ID / TUNNEL_ID gerekli' });
  try {
    await ensureFallbackIngress();
    const dnsRes = await ensureSaaSDnsRecords();
    let fb: any = null;
    try { fb = await getFallbackOrigin(); } catch {}
    if (!fb || String(fb.origin || '').toLowerCase() !== getCloudflarePublicConfig().fallbackOrigin.toLowerCase()) {
      try { fb = await putFallbackOrigin(getCloudflarePublicConfig().fallbackOrigin); } catch (e: any) { logger.warn({ err: e }, 'putFallbackOrigin failed'); }
    }
    const { ingress } = await getTunnelConfig();
    res.json({ ok: true, dns: dnsRes, fallbackOrigin: fb, ingressCount: ingress.length, cnameTarget: getCloudflarePublicConfig().cnameTarget, fallbackOriginHost: getCloudflarePublicConfig().fallbackOrigin });
  } catch (e: any) {
    logger.error({ err: e }, 'Cloudflare setup error');
    res.status(502).json({ error: e.message || 'Cloudflare kurulumu başarısız' });
  }
});

siteRoutes.post('/domains', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  const store = (req as any).store;
  let domain = String(req.body?.domain || '').trim().toLowerCase();
  domain = normalizeDomainInput(domain);
  if (!isValidHostname(domain)) return res.status(400).json({ error: 'Geçerli bir domain girin (örn. magaza.com.tr)' });
  const domains = getStoreDomains(store);
  if (domains.length >= 5) return res.status(400).json({ error: 'En fazla 5 domain ekleyebilirsiniz' });
  if (domains.some(d => d.domain === domain) || (store as any).domain === domain) return res.status(400).json({ error: 'Bu domain zaten ekli' });
  // Global uniqueness: domain başka mağazada kullanılıyor mu?
  const existsPrimary = await Store.findOne({ where: { domain } as any });
  if (existsPrimary && (existsPrimary as any).id !== store.id) return res.status(400).json({ error: 'Bu domain başka bir mağaza tarafından kullanılıyor' });
  // Check JSONB array contains domain (raw query)
  try {
    const [rows]: any = await (Store as any).sequelize.query(`SELECT id FROM stores WHERE domains @> '[{"domain":"${domain.replace(/'/g, "''")}"}]'::jsonb AND id != ${Number(store.id)} LIMIT 1`);
    if (rows && rows.length) return res.status(400).json({ error: 'Bu domain başka bir mağaza tarafından kullanılıyor' });
  } catch {}
  const entry: any = { domain, verified: false, method: null, addedAt: new Date().toISOString(), lastCheckedAt: null as string | null };
  const next = [...domains, entry];
  await store.update({ domains: next as any });
  // Legacy single domain sync for backward compat
  if (!(store as any).domain) await store.update({ domain } as any);

  // Cloudflare NS: zone oluştur ve DNS'i hazırla (best-effort)
  const hosting = await storeHosting(store);
  if (hosting !== 'vercel' && isCloudflareConfigured()) {
    try {
      await ensureFallbackIngress().catch(() => {});
      let zone: any = null;
      try { zone = await getZoneByName(domain); } catch {}
      if (!zone) {
        try { zone = await createZone(domain); } catch (e: any) {
          logger.warn({ err: e, domain }, 'createZone failed — frontend will show NS guide');
        }
      }
      if (zone) {
        // Apex ve www için gerekli kayıtları oluştur (proxied)
        const cnameTarget = getCloudflarePublicConfig().cnameTarget;
        try {
          const existing = await listDnsRecordsForZone(zone.id).catch(() => []);
          const hasWww = existing.some((r: any) => String(r.name).toLowerCase() === `www.${domain}`.toLowerCase() && r.type === 'CNAME');
          const hasApex = existing.some((r: any) => String(r.name).toLowerCase() === domain.toLowerCase() && r.type === 'CNAME');
          if (!hasWww) await createDnsRecordForZone(zone.id, { type: 'CNAME', name: `www.${domain}`, content: cnameTarget, proxied: true, ttl: 1, comment: 'Rahatio storefront' }).catch(() => {});
          if (!hasApex) await createDnsRecordForZone(zone.id, { type: 'CNAME', name: domain, content: cnameTarget, proxied: true, ttl: 1, comment: 'Rahatio storefront apex' }).catch(() => {});
        } catch {}
        // Tunnel ingress for both
        try { await ensureTunnelHostname(`www.${domain}`, getCloudflarePublicConfig().originService).catch(() => {}); } catch {}
        try { await ensureTunnelHostname(domain, getCloudflarePublicConfig().originService).catch(() => {}); } catch {}
        entry.method = 'cloudflare_ns';
        entry.zoneId = zone.id;
        entry.zoneStatus = zone.status;
        entry.nameServers = zone.name_servers;
        const idx = next.findIndex((d: any) => d.domain === domain);
        if (idx >= 0) {
          next[idx] = { ...next[idx], method: 'cloudflare_ns', zoneId: zone.id, zoneStatus: zone.status, nameServers: zone.name_servers, lastCheckedAt: new Date().toISOString() } as any;
          await store.update({ domains: [...next] as any });
        }
      }
    } catch (e: any) {
      logger.warn({ err: e, domain }, 'Cloudflare NS post-domain hook failed');
    }
  }

  const cf = getCloudflarePublicConfig();
  const zoneForHint = await getZoneByName(domain).catch(() => null);
  const enriched: any = { ...entry };
  if (isCloudflareConfigured()) {
    if (zoneForHint) {
      enriched.cloudflare = { zoneId: zoneForHint.id, zoneStatus: zoneForHint.status, nameServers: zoneForHint.name_servers, cnameTarget: cf.cnameTarget, fallbackOrigin: cf.fallbackOrigin };
      enriched.zoneId = zoneForHint.id;
    } else {
      const nsHint = Array.isArray((entry as any).nameServers) && (entry as any).nameServers.length ? ((entry as any).nameServers as string[]).join(' / ') : null;
      enriched.cloudflare = { cnameTarget: cf.cnameTarget, fallbackOrigin: cf.fallbackOrigin, nameServers: (entry as any).nameServers || null, hint: nsHint ? `NS değiştir: ${domain} -> ${nsHint}` : `NS değiştir: ${domain} -> Cloudflare NS'lerine yönlendirin` };
    }
  }
  res.json({ domains: next, domain, entry: enriched, cloudflare: cf, zone: zoneForHint });
});

siteRoutes.delete('/domains/:domain', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const raw = String(req.params.domain || '').toLowerCase();
  const domain = normalizeDomainInput(raw);
  const beforeDomains = getStoreDomains(store);
  const removedEntry: any = beforeDomains.find((d: any) => d.domain === domain) || null;
  let domains = beforeDomains;
  const before = domains.length;
  domains = domains.filter(d => d.domain !== domain);
  if (domains.length === before) {
    if ((store as any).domain === domain) {
      await store.update({ domain: null as any, domains } as any);
      if (isCloudflareConfigured()) {
        for (const h of [domain, `www.${domain}`]) {
          try { await deleteCustomHostname(h); } catch {}
          try { await removeTunnelHostname(h); } catch {}
        }
        const zid = (removedEntry as any)?.zoneId || (removedEntry as any)?.zone_id;
        if (zid) { try { await deleteZone(zid); } catch (e: any) { logger.warn({ err: e, domain, zid }, 'deleteZone failed'); } }
      }
      return res.json({ domains });
    }
    return res.status(404).json({ error: 'Domain bulunamadı' });
  }
  await store.update({ domains: domains as any });
  if ((store as any).domain === domain) {
    const nextPrimary = domains.find((d: any) => d.verified)?.domain || domains[0]?.domain || null;
    await store.update({ domain: nextPrimary as any } as any);
  }
  if (isCloudflareConfigured()) {
    for (const h of [domain, `www.${domain}`]) {
      try { await deleteCustomHostname(h); } catch (e: any) { logger.warn({ err: e, domain: h }, 'deleteCustomHostname failed'); }
      try { await removeTunnelHostname(h); } catch (e: any) { logger.warn({ err: e, domain: h }, 'removeTunnelHostname failed'); }
    }
    const zid = removedEntry?.zoneId || (removedEntry as any)?.zone_id;
    if (zid) {
      try { await deleteZone(zid); logger.info(`Cloudflare zone ${zid} deleted for ${domain}`); } catch (e: any) { logger.warn({ err: e, domain, zid }, 'deleteZone failed'); }
    }
  }
  res.json({ domains });
});

siteRoutes.post('/domains/:domain/verify', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const raw = String(req.params.domain || '').toLowerCase();
  const domain = normalizeDomainInput(raw);
  let domains = getStoreDomains(store);
  const idx = domains.findIndex(d => d.domain === domain);
  // Also allow verifying legacy primary even if not in array
  const isLegacyPrimary = (store as any).domain === domain && idx === -1;
  if (idx === -1 && !isLegacyPrimary) return res.status(404).json({ error: 'Domain bulunamadı — önce ekleyin' });

  const hosting = await storeHosting(store);
  let verified = false;
  let method: string | null = null;
  let detail: any = null;

  // Try Vercel verification if hosting is vercel and token exists
  if (hosting === 'vercel') {
    try {
      const deployment = await latestVercelDeployment(store.id);
      if (deployment?.providerProjectId) {
        const adapter = getVercelAdapterForStore(store);
        // Try verifyDomain, fallback to getDomain
        try {
          const r = await adapter.verifyDomain(deployment.providerProjectId, domain);
          verified = !!r.verified;
          detail = r;
          method = 'vercel';
          if (verified) {
            await store.update({ domain } as any);
            await deployment.update({ domain, siteUrl: r.url || deployment.siteUrl } as any);
          }
        } catch {
          const r2 = await adapter.getDomain(deployment.providerProjectId, domain);
          verified = !!r2.verified;
          detail = r2;
          method = 'vercel';
        }
      }
    } catch (e:any) { detail = { error: e.message }; }
  }

  // Cloudflare NS verification — primary for rahatio hosting when configured
  if (!verified && isCloudflareConfigured() && hosting !== 'vercel') {
    try {
      let zone: any = null;
      try { zone = await getZoneByName(domain); } catch {}
      if (!zone) {
        try { zone = await createZone(domain); } catch (e: any) { detail = { error: e.message }; }
        if (zone) {
          const cnameTarget = getCloudflarePublicConfig().cnameTarget;
          try {
            const existing = await listDnsRecordsForZone(zone.id).catch(() => [] as any[]);
            const hasWww = existing.some((r: any) => String(r.name).toLowerCase() === `www.${domain}`.toLowerCase() && r.type === 'CNAME');
            const hasApex = existing.some((r: any) => String(r.name).toLowerCase() === domain.toLowerCase() && r.type === 'CNAME');
            if (!hasWww) await createDnsRecordForZone(zone.id, { type: 'CNAME', name: `www.${domain}`, content: cnameTarget, proxied: true, ttl: 1, comment: 'Rahatio storefront' }).catch(() => {});
            if (!hasApex) await createDnsRecordForZone(zone.id, { type: 'CNAME', name: domain, content: cnameTarget, proxied: true, ttl: 1, comment: 'Rahatio storefront apex' }).catch(() => {});
          } catch {}
          try { await ensureTunnelHostname(`www.${domain}`, getCloudflarePublicConfig().originService).catch(() => {}); } catch {}
          try { await ensureTunnelHostname(domain, getCloudflarePublicConfig().originService).catch(() => {}); } catch {}
        }
      }
      if (zone) {
        let ns: string[] = [];
        try { const resolved = await dns.resolveNs(domain); ns = resolved.map((s: string) => s.toLowerCase()); } catch {}
        const expected: string[] = Array.isArray(zone.name_servers) ? (zone.name_servers as string[]).map((s: string) => s.toLowerCase()) : [];
        const pointsToCf = expected.length > 0 && expected.every((e) => ns.includes(e));
        const zoneActive = String(zone.status).toLowerCase() === 'active';
        if (pointsToCf && zoneActive) {
          verified = true;
          method = 'cloudflare_ns';
          detail = { zoneId: zone.id, zoneStatus: zone.status, nameServers: zone.name_servers, ns, verified: true };
        } else {
          const hint = expected.length ? `NS değiştir: ${domain} -> ${expected.join(' / ')}` : `NS değiştir: ${domain} -> Cloudflare NS'lerine yönlendirin`;
          detail = { zoneId: zone.id, zoneStatus: zone.status, nameServers: zone.name_servers, ns, pointsToCf, zoneActive, hint, expected };
          method = 'cloudflare_ns';
        }
        const dIdx = domains.findIndex((d: any) => d.domain === domain);
        if (dIdx !== -1) {
          domains[dIdx] = { ...domains[dIdx], zoneId: zone.id, zoneStatus: zone.status, nameServers: zone.name_servers, lastCheckedAt: new Date().toISOString(), verified, method: verified ? 'cloudflare_ns' : domains[dIdx].method } as any;
          await store.update({ domains: [...domains] as any });
          if (verified) await store.update({ domain } as any);
        } else if (isLegacyPrimary) {
          // will be handled below
        }
      } else {
        // Fallback to previous SaaS check if zone not created (e.g., token lacks zone create)
        try {
          const st = await getCustomHostnameStatus(domain);
          if (st.found && st.status === 'active') { verified = true; method = 'cloudflare'; detail = st; }
        } catch {}
      }
    } catch (e: any) {
      if (!detail) detail = { error: e.message };
    }
  }

  // Fallback / PHP health check — always try if not yet verified
  if (!verified) {
    try {
      const health = await fetchHealthForDomain(domain, 6000);
      if (health.ok && health.body && String(health.body.store).toLowerCase() === String(store.siteCode).toLowerCase()) {
        verified = true;
        method = method || 'php';
        detail = health.body;
      } else if (health.ok) {
        // Health ok but store mismatch — still consider verified if health is reachable and domain is not vercel-exclusive?
        // Require store match for php
        detail = health.body || { error: 'store mismatch' };
      } else {
        detail = detail || health;
      }
    } catch (e:any) { if (!detail) detail = { error: e.message }; }
  }

  // TXT fallback check (manual)
  if (!verified) {
    try {
      const token = domainVerificationToken(store.id, domain);
      const txts = await dns.resolveTxt(`_rahatio-verify.${domain}`).then(rs=> rs.map(r=>r.join('')).join(' ')).catch(()=> '');
      if (txts && txts.includes(token)) { verified = true; method = method || 'txt'; detail = { txt: true }; }
    } catch {}
  }

  // Update domains array — must copy array for JSONB dirty check (getStoreDomains returns same ref as store.domains)
  if (idx !== -1) {
    domains[idx] = { ...domains[idx], verified, method: method || domains[idx].method || null, lastCheckedAt: new Date().toISOString() };
    await store.update({ domains: [...domains] as any });
    if (verified) await store.update({ domain } as any);
  } else if (isLegacyPrimary) {
    // Promote legacy to array
    const entry = { domain, verified, method, addedAt: new Date().toISOString(), lastCheckedAt: new Date().toISOString() };
    const next = [...domains, entry];
    await store.update({ domains: next as any, domain: verified ? domain : (store as any).domain } as any);
    domains = next;
  }

  res.json({ domain, verified, method, detail, domains });
});

// ── DNS Yönetimi (customer zone moved to our Cloudflare) ──
// Zone oluştur / NS taşı — müşteri NS'i lily/ricardo'ya alınca zone bizde oluşur
siteRoutes.post('/domains/:domain/zone', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  if (!isCloudflareConfigured()) return res.status(503).json({ error: 'Cloudflare yapılandırılmadı' });
  const raw = String(req.params.domain || '').toLowerCase();
  const domain = normalizeDomainInput(raw);
  if (!isValidHostname(domain)) return res.status(400).json({ error: 'Geçersiz domain' });
  const store = (req as any).store;
  let domains: any[] = getStoreDomains(store);
  const idx = domains.findIndex((d: any) => d.domain === domain);
  if (idx === -1 && (store as any).domain !== domain) return res.status(404).json({ error: 'Domain mağazaya ait değil' });

  try {
    let zone = await getZoneByName(domain);
    if (!zone) zone = await createZone(domain);
    // persist zoneId — copy array for JSONB dirty check
    if (idx !== -1) {
      domains[idx] = { ...domains[idx], zoneId: zone.id, zoneStatus: zone.status, nameServers: zone.name_servers, lastCheckedAt: new Date().toISOString() };
      await store.update({ domains: [...domains] as any });
    } else {
      // legacy primary
      const entry: any = { domain, verified: false, zoneId: zone.id, zoneStatus: zone.status, nameServers: zone.name_servers, addedAt: new Date().toISOString(), lastCheckedAt: new Date().toISOString() };
      domains = [...domains, entry];
      await store.update({ domains: [...domains] as any });
    }
    // Ensure SaaS records inside customer zone if they point www/@ to our target (optional auto-create)
    // Don't auto-create to avoid overwriting customer's MX
    res.json({ domain, zoneId: zone.id, zoneStatus: zone.status, nameServers: zone.name_servers, zone });
  } catch (e: any) {
    logger.error({ err: e, domain }, 'Create zone error');
    res.status(502).json({ error: e.message || 'Zone oluşturulamadı' });
  }
});

siteRoutes.get('/domains/:domain/zone', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  if (!isCloudflareConfigured()) return res.status(503).json({ error: 'Cloudflare yapılandırılmadı' });
  const domain = normalizeDomainInput(String(req.params.domain || ''));
  const store = (req as any).store;
  const entry: any = getStoreDomains(store).find((d: any) => d.domain === domain) || ((store as any).domain === domain ? { domain, zoneId: null } : null);
  if (!entry) return res.status(404).json({ error: 'Domain bulunamadı' });
  try {
    let zone: any = null;
    if (entry.zoneId) {
      try { zone = await getZoneDetails(entry.zoneId); } catch { zone = await getZoneByName(domain); }
    } else {
      zone = await getZoneByName(domain);
    }
    if (!zone) return res.json({ domain, zoneId: null, zoneStatus: 'not_created', nameServers: null });
    // sync if zone found but not stored — copy for dirty check
    if (!entry.zoneId) {
      const domains: any[] = getStoreDomains(store);
      const idx = domains.findIndex((d: any) => d.domain === domain);
      if (idx !== -1) {
        domains[idx] = { ...domains[idx], zoneId: zone.id, zoneStatus: zone.status, nameServers: zone.name_servers };
        await store.update({ domains: [...domains] as any });
      }
    }
    res.json({ domain, zoneId: zone.id, zoneStatus: zone.status, nameServers: zone.name_servers, zone });
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

siteRoutes.get('/domains/:domain/dns', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  if (!isCloudflareConfigured()) return res.status(503).json({ error: 'Cloudflare yapılandırılmadı' });
  const domain = normalizeDomainInput(String(req.params.domain || ''));
  const store = (req as any).store;
  const entry: any = getStoreDomains(store).find((d: any) => d.domain === domain) || ((store as any).domain === domain ? { domain } : null);
  if (!entry) return res.status(404).json({ error: 'Domain bulunamadı' });
  let zoneId: string | null = entry.zoneId || null;
  if (!zoneId) {
    const z: any = await getZoneByName(domain).catch(() => null);
    if (!z) return res.status(404).json({ error: 'Bu domain için Cloudflare zone yok — önce NS’i taşıyıp zone oluşturun', code: 'NO_ZONE' });
    zoneId = z.id;
  }
  try {
    const records = await listDnsRecordsForZone(zoneId!);
    res.json({ domain, zoneId, records });
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

siteRoutes.post('/domains/:domain/dns', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  if (!isCloudflareConfigured()) return res.status(503).json({ error: 'Cloudflare yapılandırılmadı' });
  const domain = normalizeDomainInput(String(req.params.domain || ''));
  const store = (req as any).store;
  const entry: any = getStoreDomains(store).find((d: any) => d.domain === domain) || ((store as any).domain === domain ? { domain } : null);
  if (!entry) return res.status(404).json({ error: 'Domain bulunamadı' });
  let zoneId: string | null = entry.zoneId || null;
  if (!zoneId) {
    const z: any = await getZoneByName(domain).catch(() => null);
    if (!z) return res.status(404).json({ error: 'Zone yok — önce zone oluşturun', code: 'NO_ZONE' });
    zoneId = z.id;
  }
  const { type, name, content, ttl, proxied, priority, comment } = req.body || {};
  if (!type || !content) return res.status(400).json({ error: 'type ve content gerekli' });
  const t = String(type).toUpperCase();
  if (!['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'SRV', 'CAA'].includes(t)) return res.status(400).json({ error: 'Desteklenmeyen type' });
  // Prevent deleting SaaS CNAME by mistake — allow but warn
  const recName = String(name || '@').trim() || '@';
  const fullName = recName === '@' || recName === domain ? domain : recName.includes('.') ? recName : `${recName}.${domain}`;
  try {
    const rec = await createDnsRecordForZone(zoneId!, { type: t, name: fullName, content: String(content), ttl: ttl ? Number(ttl) : 1, proxied: proxied ?? false, priority: priority ? Number(priority) : undefined, comment });
    res.json({ record: rec });
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

siteRoutes.put('/domains/:domain/dns/:recordId', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  if (!isCloudflareConfigured()) return res.status(503).json({ error: 'Cloudflare yapılandırılmadı' });
  const domain = normalizeDomainInput(String(req.params.domain || ''));
  const recordId = String(req.params.recordId || '');
  const store = (req as any).store;
  const entry: any = getStoreDomains(store).find((d: any) => d.domain === domain) || ((store as any).domain === domain ? { domain } : null);
  if (!entry) return res.status(404).json({ error: 'Domain bulunamadı' });
  let zoneId: string | null = entry.zoneId || null;
  if (!zoneId) {
    const z: any = await getZoneByName(domain).catch(() => null);
    if (!z) return res.status(404).json({ error: 'Zone yok' });
    zoneId = z.id;
  }
  try {
    const rec = await updateDnsRecordForZone(zoneId!, recordId, req.body || {});
    res.json({ record: rec });
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

siteRoutes.delete('/domains/:domain/dns/:recordId', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  if (!isCloudflareConfigured()) return res.status(503).json({ error: 'Cloudflare yapılandırılmadı' });
  const domain = normalizeDomainInput(String(req.params.domain || ''));
  const recordId = String(req.params.recordId || '');
  const store = (req as any).store;
  const entry: any = getStoreDomains(store).find((d: any) => d.domain === domain) || ((store as any).domain === domain ? { domain } : null);
  if (!entry) return res.status(404).json({ error: 'Domain bulunamadı' });
  let zoneId: string | null = entry.zoneId || null;
  if (!zoneId) {
    const z: any = await getZoneByName(domain).catch(() => null);
    if (!z) return res.status(404).json({ error: 'Zone yok' });
    zoneId = z.id;
  }
  try {
    await deleteDnsRecordForZone(zoneId!, recordId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
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


