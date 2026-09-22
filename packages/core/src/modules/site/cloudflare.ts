import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

type CfApiError = { message: string; code?: number; status?: number };

function cfConfig() {
  const c: any = (config as any).cloudflare;
  return {
    token: String(c?.apiToken || '').trim(),
    accountId: String(c?.accountId || '').trim(),
    zoneId: String(c?.zoneId || '').trim(),
    tunnelId: String(c?.tunnelId || '').trim(),
    fallbackOrigin: String(c?.fallbackOrigin || 'saas.rahatio.com.tr').trim().toLowerCase(),
    cnameTarget: String(c?.cnameTarget || 'customers.rahatio.com.tr').trim().toLowerCase(),
    originService: String(c?.originService || 'http://192.168.0.243:3690').trim(),
  };
}

export function isCloudflareConfigured(): boolean {
  const { token, accountId, zoneId, tunnelId } = cfConfig();
  return Boolean(token && accountId && zoneId && tunnelId);
}

export function getCloudflarePublicConfig() {
  const { fallbackOrigin, cnameTarget, zoneId } = cfConfig();
  const zoneName = 'rahatio.com.tr';
  return {
    configured: isCloudflareConfigured(),
    fallbackOrigin,
    cnameTarget,
    zoneId,
    zoneName,
    tunnelId: cfConfig().tunnelId,
    originService: cfConfig().originService,
  };
}

async function cfFetch(path: string, init: RequestInit & { accountScoped?: boolean } = {}): Promise<any> {
  const { token } = cfConfig();
  if (!token) throw Object.assign(new Error('Cloudflare API token yok — CLOUDFLARE_API_TOKEN tanımlayın'), { status: 503 });
  const url = `https://api.cloudflare.com/client/v4${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers as any),
    },
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const msg = json.errors?.[0]?.message || json.message || `Cloudflare API ${res.status}`;
    const err: CfApiError = new Error(msg);
    (err as any).status = res.status;
    (err as any).code = json.errors?.[0]?.code;
    (err as any).raw = json;
    throw err;
  }
  return json;
}

// ── Tunnel ──────────────────────────────────────────────────────────
// Remote-managed tunnel config is at PUT /accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations
// Docs: https://developers.cloudflare.com/api/resources/zero_trust/subresources/tunnels/subresources/cloudflared/subresources/configurations/

export type TunnelIngressRule = { hostname?: string; service: string; path?: string; originRequest?: any };

export async function getTunnelConfig(): Promise<{ version: number; ingress: TunnelIngressRule[] }> {
  const { accountId, tunnelId } = cfConfig();
  const json = await cfFetch(`/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`);
  const cfg = json.result?.config || json.result;
  return {
    version: json.result?.version ?? 0,
    ingress: Array.isArray(cfg?.ingress) ? cfg.ingress : [],
  };
}

export async function putTunnelConfig(ingress: TunnelIngressRule[]): Promise<void> {
  const { accountId, tunnelId } = cfConfig();
  // ensure catch-all last
  const hasCatchAll = ingress.some((r) => !r.hostname && r.service?.startsWith('http_status:'));
  const finalIngress = hasCatchAll ? ingress : [...ingress, { service: 'http_status:404' }];
  await cfFetch(`/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, {
    method: 'PUT',
    body: JSON.stringify({ config: { ingress: finalIngress } }),
  });
}

export async function ensureTunnelHostname(hostname: string, service: string): Promise<{ added: boolean; alreadyExists: boolean }> {
  const h = hostname.trim().toLowerCase();
  const { ingress } = await getTunnelConfig();
  const exists = ingress.some((r) => (r.hostname || '').toLowerCase() === h && r.service === service);
  if (exists) return { added: false, alreadyExists: true };
  // insert before catch-all
  const catchIdx = ingress.findIndex((r) => !r.hostname && r.service?.startsWith('http_status:'));
  const next = [...ingress];
  const rule: TunnelIngressRule = { hostname: h, service, originRequest: {} };
  if (catchIdx >= 0) next.splice(catchIdx, 0, rule);
  else {
    // remove existing http_status:404 and re-add at end
    const filtered = next.filter((r) => r.service !== 'http_status:404');
    filtered.push(rule);
    filtered.push({ service: 'http_status:404' });
    await putTunnelConfig(filtered);
    return { added: true, alreadyExists: false };
  }
  await putTunnelConfig(next);
  return { added: true, alreadyExists: false };
}

export async function removeTunnelHostname(hostname: string): Promise<{ removed: boolean }> {
  const h = hostname.trim().toLowerCase();
  const { ingress } = await getTunnelConfig();
  const next = ingress.filter((r) => (r.hostname || '').toLowerCase() !== h);
  if (next.length === ingress.length) return { removed: false };
  await putTunnelConfig(next);
  return { removed: true };
}

// Ensure at least the SaaS fallback origin is routed via tunnel
export async function ensureFallbackIngress(): Promise<void> {
  const { fallbackOrigin, originService } = cfConfig();
  try {
    await ensureTunnelHostname(fallbackOrigin, originService);
    logger.info(`Cloudflare tunnel ingress ensured for fallback ${fallbackOrigin} -> ${originService}`);
  } catch (e: any) {
    logger.warn({ err: e }, `ensureFallbackIngress failed for ${fallbackOrigin}`);
    throw e;
  }
}

// ── DNS ─────────────────────────────────────────────────____________

export async function listDnsRecords(params: { name?: string; type?: string } = {}): Promise<any[]> {
  const { zoneId } = cfConfig();
  const qs = new URLSearchParams();
  if (params.name) qs.set('name', params.name);
  if (params.type) qs.set('type', params.type);
  qs.set('per_page', '50');
  const json = await cfFetch(`/zones/${zoneId}/dns_records?${qs.toString()}`);
  return json.result || [];
}

export async function createDnsRecord(input: { type: 'A' | 'CNAME' | 'TXT'; name: string; content: string; proxied?: boolean; ttl?: number; comment?: string }): Promise<any> {
  const { zoneId } = cfConfig();
  const json = await cfFetch(`/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({
      type: input.type,
      name: input.name,
      content: input.content,
      proxied: input.proxied ?? true,
      ttl: input.ttl ?? 1,
      comment: input.comment,
    }),
  });
  return json.result;
}

export async function ensureSaaSDnsRecords(): Promise<{ fallback: any; target: any }> {
  const { fallbackOrigin, cnameTarget, tunnelId } = cfConfig();
  const tunnelCname = `${tunnelId}.cfargotunnel.com`;
  // fallback: saas.rahatio.com.tr -> tunnel
  let fallback: any = null;
  let target: any = null;
  const existing = await listDnsRecords();
  const byName = (n: string) => existing.find((r: any) => String(r.name).toLowerCase() === n.toLowerCase());
  const fb = byName(fallbackOrigin);
  if (!fb) {
    fallback = await createDnsRecord({ type: 'CNAME', name: fallbackOrigin, content: tunnelCname, proxied: true, comment: 'Rahatio SaaS fallback origin — tunnel' });
  } else {
    fallback = fb;
    // fix if not pointing to tunnel
    if (String(fb.content).toLowerCase() !== tunnelCname.toLowerCase()) {
      logger.warn(`Fallback DNS ${fallbackOrigin} points to ${fb.content}, expected ${tunnelCname}`);
    }
  }
  const ct = byName(cnameTarget);
  if (!ct) {
    target = await createDnsRecord({ type: 'CNAME', name: cnameTarget, content: fallbackOrigin, proxied: true, comment: 'Rahatio SaaS CNAME target — customers point here' });
  } else {
    target = ct;
  }
  return { fallback, target };
}

// ── Per-zone helpers (for customer-owned zones moved to our account) ──

export async function getZoneByName(name: string): Promise<any | null> {
  const normalized = name.trim().toLowerCase();
  const json = await cfFetch(`/zones?name=${encodeURIComponent(normalized)}&per_page=5`);
  const list: any[] = json.result || [];
  return list.find((z: any) => String(z.name).toLowerCase() === normalized) || null;
}

export async function createZone(name: string): Promise<any> {
  const { accountId } = cfConfig();
  const json = await cfFetch(`/zones`, {
    method: 'POST',
    body: JSON.stringify({ name: name.trim().toLowerCase(), account: { id: accountId }, jump_start: true, type: 'full' }),
  });
  return json.result;
}

export async function listDnsRecordsForZone(zoneId: string, params: { name?: string; type?: string } = {}): Promise<any[]> {
  const qs = new URLSearchParams();
  if (params.name) qs.set('name', params.name);
  if (params.type) qs.set('type', params.type);
  qs.set('per_page', '100');
  const json = await cfFetch(`/zones/${zoneId}/dns_records?${qs.toString()}`);
  return json.result || [];
}

export async function createDnsRecordForZone(zoneId: string, input: { type: string; name: string; content: string; ttl?: number; proxied?: boolean; priority?: number; comment?: string }): Promise<any> {
  const body: any = {
    type: input.type.toUpperCase(),
    name: input.name,
    content: input.content,
    ttl: input.ttl ?? 1,
    comment: input.comment,
  };
  if (input.proxied !== undefined) body.proxied = input.proxied;
  if (input.priority !== undefined) body.priority = input.priority;
  // Cloudflare API expects MX priority at top level, some types use data
  const json = await cfFetch(`/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return json.result;
}

export async function updateDnsRecordForZone(zoneId: string, recordId: string, input: { type?: string; name?: string; content?: string; ttl?: number; proxied?: boolean; priority?: number; comment?: string }): Promise<any> {
  const body: any = {};
  if (input.type) body.type = input.type.toUpperCase();
  if (input.name) body.name = input.name;
  if (input.content) body.content = input.content;
  if (input.ttl !== undefined) body.ttl = input.ttl;
  if (input.proxied !== undefined) body.proxied = input.proxied;
  if (input.priority !== undefined) body.priority = input.priority;
  if (input.comment !== undefined) body.comment = input.comment;
  const json = await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return json.result;
}

export async function deleteDnsRecordForZone(zoneId: string, recordId: string): Promise<void> {
  await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, { method: 'DELETE' });
}

export async function getZoneDetails(zoneId: string): Promise<any> {
  const json = await cfFetch(`/zones/${zoneId}`);
  return json.result;
}

// ── Custom Hostnames (for SaaS) ───────────────────────────────────
// POST /zones/{zone_id}/custom_hostnames  {hostname, ssl:{method, type}, custom_origin_server?}

export type CfCustomHostname = {
  id: string;
  hostname: string;
  status: string; // pending | active | blocked | etc
  ssl: { status: string; method: string | null; validation_records?: any[]; validation_errors?: any[] };
  ownership_verification?: { type: string; name: string; value: string };
  ownership_verification_http?: { http_url: string; http_body: string };
  verification_errors?: string[];
  created_at?: string;
};

export async function createCustomHostname(hostname: string, opts: { method?: 'http' | 'txt' } = {}): Promise<CfCustomHostname> {
  const { zoneId } = cfConfig();
  const h = hostname.trim().toLowerCase();
  const body: any = {
    hostname: h,
    ssl: { method: opts.method || 'http', type: 'dv' },
  };
  const json = await cfFetch(`/zones/${zoneId}/custom_hostnames`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return json.result as CfCustomHostname;
}

export async function getCustomHostname(hostnameOrId: string): Promise<CfCustomHostname | null> {
  const { zoneId } = cfConfig();
  const h = hostnameOrId.trim().toLowerCase();
  // Try list filter first
  try {
    const json = await cfFetch(`/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(h)}&per_page=10`);
    const list: CfCustomHostname[] = json.result || [];
    const found = list.find((x) => x.hostname.toLowerCase() === h);
    if (found) {
      // fetch full by id to get verification fields (list omits some)
      const full = await cfFetch(`/zones/${zoneId}/custom_hostnames/${found.id}`);
      return full.result as CfCustomHostname;
    }
    // also try by id directly if look like uuid
    if (/^[0-9a-f-]{20,}$/i.test(hostnameOrId)) {
      const byId = await cfFetch(`/zones/${zoneId}/custom_hostnames/${hostnameOrId}`);
      return byId.result as CfCustomHostname;
    }
    return null;
  } catch (e: any) {
    if (e.status === 404) return null;
    throw e;
  }
}

export async function deleteCustomHostname(hostnameOrId: string): Promise<void> {
  const { zoneId } = cfConfig();
  let id = hostnameOrId;
  if (!/^[0-9a-f-]{32,}$/i.test(id) && id.includes('.')) {
    const found = await getCustomHostname(id);
    if (!found) return;
    id = found.id;
  }
  await cfFetch(`/zones/${zoneId}/custom_hostnames/${id}`, { method: 'DELETE' });
}

export async function getCustomHostnameStatus(hostname: string): Promise<{
  found: boolean;
  hostname: string;
  status: string | null;
  sslStatus: string | null;
  verification: { type: string; name?: string; value?: string; http_url?: string; http_body?: string } | null;
  raw?: CfCustomHostname;
}> {
  const ch = await getCustomHostname(hostname);
  if (!ch) return { found: false, hostname, status: null, sslStatus: null, verification: null };
  const ov: any = (ch as any).ownership_verification || (ch as any).ownership_verification_http;
  let verification: any = null;
  if ((ch as any).ownership_verification) {
    verification = { type: (ch as any).ownership_verification.type || 'txt', name: (ch as any).ownership_verification.name, value: (ch as any).ownership_verification.value };
  } else if ((ch as any).ownership_verification_http) {
    verification = { type: 'http', http_url: (ch as any).ownership_verification_http.http_url, http_body: (ch as any).ownership_verification_http.http_body };
  }
  // ssl validation_records fallback
  const sslRec = (ch.ssl as any)?.validation_records?.[0];
  if (!verification && sslRec) {
    verification = { type: sslRec.txt_name ? 'txt' : 'http', name: sslRec.txt_name, value: sslRec.txt_value, http_url: sslRec.http_url, http_body: sslRec.http_body };
  }
  return {
    found: true,
    hostname: ch.hostname,
    status: ch.status,
    sslStatus: (ch.ssl as any)?.status || null,
    verification,
    raw: ch,
  };
}

// Fallback origin CRUD (for SaaS) — https://developers.cloudflare.com/api/resources/custom_hostnames/subresources/fallback_origin/
export async function getFallbackOrigin(): Promise<any | null> {
  const { zoneId } = cfConfig();
  try {
    const json = await cfFetch(`/zones/${zoneId}/custom_hostnames/fallback_origin`);
    return json.result;
  } catch (e: any) {
    if (e.status === 404) return null;
    throw e;
  }
}

export async function putFallbackOrigin(origin: string): Promise<any> {
  const { zoneId } = cfConfig();
  const json = await cfFetch(`/zones/${zoneId}/custom_hostnames/fallback_origin`, {
    method: 'PUT',
    body: JSON.stringify({ origin }),
  });
  return json.result;
}
