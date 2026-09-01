/** Hosting provider boundary for Phase 8B.
 *
 * Provider credentials and deployment side effects stay outside route code.
 * The first implementation keeps Rahatio hosting local; Vercel/custom
 * adapters can be added without changing the store or frontend contract.
 */
export type HostingProvider = 'rahatio' | 'vercel' | 'custom';

import axios, { AxiosInstance } from 'axios';

export type ProviderDeploymentState = 'pending' | 'ready' | 'error';

export interface HostingProviderAdapter {
  readonly kind: HostingProvider;
  deploy(input: { storeId: number; siteCode: string; siteUrl?: string | null; files?: Array<{ file: string; data: string }> }): Promise<{
    status: ProviderDeploymentState;
    deploymentId?: string;
    projectId?: string;
    url?: string;
  }>;
  getStatus(deploymentId: string): Promise<{
    status: ProviderDeploymentState;
    url?: string;
    error?: string;
  }>;
  addDomain?(projectId: string, domain: string): Promise<ProviderDomainResult>;
  getDomain?(projectId: string, domain: string): Promise<ProviderDomainResult>;
  verifyDomain?(projectId: string, domain: string): Promise<ProviderDomainResult>;
}

export type ProviderDomainVerification = {
  type?: string;
  domain?: string;
  value?: string;
  reason?: string;
};

export type ProviderDomainResult = {
  domain: string;
  verified: boolean;
  configured?: boolean;
  verification: ProviderDomainVerification[];
  url?: string;
};

class RahatioHostingAdapter implements HostingProviderAdapter {
  readonly kind = 'rahatio' as const;

  async deploy(input: { storeId: number; siteCode: string; siteUrl?: string | null }) {
    return { status: 'ready' as const, url: input.siteUrl || `/stores/${input.siteCode}` };
  }

  async getStatus(_deploymentId: string) {
    return { status: 'ready' as const };
  }
}

class VercelHostingAdapter implements HostingProviderAdapter {
  readonly kind = 'vercel' as const;
  private readonly client: AxiosInstance;
  private readonly teamId?: string;

  constructor(token: string, teamId?: string) {
    this.teamId = teamId;
    this.client = axios.create({
      baseURL: 'https://api.vercel.com',
      timeout: 30_000,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
  }

  private query() { return this.teamId ? { teamId: this.teamId } : undefined; }

  async deploy(input: { storeId: number; siteCode: string; siteUrl?: string | null; files?: Array<{ file: string; data: string }> }) {
    if (!input.files?.length) throw new Error('Vercel deployment requires at least one artifact file');
    const name = `rahatio-${input.siteCode}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50);
    const project = await this.client.post('/v10/projects', { name, framework: null }, { params: this.query() }).catch(async (error: any) => {
      if (error.response?.status === 409) return this.client.get(`/v9/projects/${name}`, { params: this.query() });
      throw error;
    });
    const projectId = project.data?.id || project.data?.name || name;
    const deployment = await this.client.post('/v13/deployments', {
      name,
      project: projectId,
      target: 'production',
      files: input.files,
    }, { params: this.query() });
    return {
      status: 'pending' as const,
      deploymentId: deployment.data?.id,
      projectId,
      url: deployment.data?.url ? `https://${deployment.data.url}` : undefined,
    };
  }

  async getStatus(deploymentId: string) {
    const response = await this.client.get(`/v13/deployments/${encodeURIComponent(deploymentId)}`, { params: this.query() });
    const state = String(response.data?.readyState || response.data?.state || '').toUpperCase();
    return {
      status: state === 'READY' ? 'ready' as const : ['ERROR', 'CANCELED', 'CANCELLED'].includes(state) ? 'error' as const : 'pending' as const,
      url: response.data?.url ? `https://${response.data.url}` : undefined,
      error: response.data?.error?.message || response.data?.errorMessage,
    };
  }

  private domainResult(data: any, fallbackDomain: string): ProviderDomainResult {
    const domain = data?.name || data?.domain || fallbackDomain;
    const verification = Array.isArray(data?.verification)
      ? data.verification.map((item: any) => ({
          type: item?.type,
          domain: item?.domain || domain,
          value: item?.value,
          reason: item?.reason,
        }))
      : [];
    return {
      domain,
      verified: data?.verified === true,
      configured: data?.configured,
      verification,
      url: data?.verified ? `https://${domain}` : undefined,
    };
  }

  async addDomain(projectId: string, domain: string) {
    const encodedProject = encodeURIComponent(projectId);
    try {
      const response = await this.client.post(`/v10/projects/${encodedProject}/domains`, { name: domain }, { params: this.query() });
      return this.domainResult(response.data, domain);
    } catch (error: any) {
      if (error.response?.status !== 409) throw error;
      return this.getDomain(projectId, domain);
    }
  }

  async getDomain(projectId: string, domain: string) {
    const response = await this.client.get(`/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`, { params: this.query() });
    return this.domainResult(response.data, domain);
  }

  async verifyDomain(projectId: string, domain: string) {
    const response = await this.client.post(`/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}/verify`, {}, { params: this.query() });
    return this.domainResult(response.data, domain);
  }
}

/** Per-store Vercel token helper — prefers store token, then env fallback (legacy central). */
export function getVercelAdapterForStore(store?: any, override?: { token?: string; teamId?: string | null }): VercelHostingAdapter {
  const token = override?.token || store?.vercelToken || process.env.VERCEL_TOKEN;
  const teamId = override?.teamId !== undefined ? override.teamId || undefined : (store?.vercelTeamId || process.env.VERCEL_TEAM_ID || undefined);
  if (!token) throw new Error('Vercel token yok — ayarlardan kendi Vercel tokenını ekle veya merkezi VERCEL_TOKEN tanımla');
  return new VercelHostingAdapter(token, teamId || undefined);
}

export async function verifyVercelToken(token: string, teamId?: string | null): Promise<{ valid: boolean; user?: any; team?: any }> {
  const adapter = new VercelHostingAdapter(token, teamId || undefined);
  // Test token by fetching user; team param is added if present
  // Using private client via bracket access
  const client: any = (adapter as any).client;
  const params = teamId ? { teamId } : undefined;
  const userRes = await client.get('/v2/user', { params });
  return { valid: true, user: userRes.data?.user || userRes.data };
}

export function getHostingProvider(kind: string | null | undefined, store?: any, override?: { token?: string; teamId?: string | null }): HostingProviderAdapter {
  // Vercel: per-store token preferred, env fallback for legacy/migration
  if (kind === 'vercel') {
    return getVercelAdapterForStore(store, override);
  }
  if (kind === 'custom') throw new Error(`Hosting provider '${kind}' is not configured yet`);
  return new RahatioHostingAdapter();
}
