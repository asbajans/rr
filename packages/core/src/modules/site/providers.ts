/** Hosting provider boundary for Phase 8B.
 *
 * Provider credentials and deployment side effects stay outside route code.
 * The first implementation keeps Rahatio hosting local; Vercel/custom
 * adapters can be added without changing the store or frontend contract.
 */
export type HostingProvider = 'rahatio' | 'vercel' | 'custom';

export type ProviderDeploymentState = 'pending' | 'ready' | 'error';

export interface HostingProviderAdapter {
  readonly kind: HostingProvider;
  deploy(input: { storeId: number; siteCode: string; siteUrl?: string | null }): Promise<{
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
}

class RahatioHostingAdapter implements HostingProviderAdapter {
  readonly kind = 'rahatio' as const;

  async deploy(input: { storeId: number; siteCode: string; siteUrl?: string | null }) {
    return { status: 'ready' as const, url: input.siteUrl || `/stores/${input.siteCode}` };
  }

  async getStatus(_deploymentId: string) {
    return { status: 'ready' as const };
  }
}

export function getHostingProvider(kind: string | null | undefined): HostingProviderAdapter {
  // Vercel/custom are deliberately explicit until their credentials and
  // deployment implementation are configured. Never silently deploy them as
  // Rahatio hosting.
  if (kind === 'vercel' || kind === 'custom') {
    throw new Error(`Hosting provider '${kind}' is not configured yet`);
  }
  return new RahatioHostingAdapter();
}
