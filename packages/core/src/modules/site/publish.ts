/**
 * Pure helpers for the site publish/deploy feature (Faz 8). Kept side-effect
 * free so the versioning/rollback semantics can be unit-tested without a DB.
 */

export type DeploymentView = {
  id: number;
  storeId: number;
  status: string;
  provider?: string | null;
  providerProjectId?: string | null;
  providerDeploymentId?: string | null;
  providerStatus?: string | null;
  providerUrl?: string | null;
  providerError?: string | null;
  version: number;
  siteCode: string | null;
  domain: string | null;
  siteUrl: string | null;
  note: string | null;
  deployedAt: Date | null;
  revertedAt: Date | null;
  createdAt: Date;
};

export type PublishedSnapshot = {
  themeSnapshot: object;
  siteCode: string;
  domain: string | null;
  siteUrl: string | null;
};

/**
 * Next publish version = highest published version + 1 (starts at 1).
 */
export function computeNextVersion(publishedVersions: number[]): number {
  if (publishedVersions.length === 0) return 1;
  return Math.max(...publishedVersions) + 1;
}

/**
 * Captures the current published state so it can be restored on rollback.
 */
export function snapshotOf(state: {
  theme?: object | null;
  siteCode: string;
  domain?: string | null;
  siteUrl?: string | null;
}): PublishedSnapshot {
  return {
    themeSnapshot: state.theme || {},
    siteCode: state.siteCode,
    domain: state.domain ?? null,
    siteUrl: state.siteUrl ?? null,
  };
}

/**
 * Rollback resolution: which snapshot fields are restored from the target
 * deployment vs kept from the current store.
 */
export function resolveRollbackTarget(current: {
  theme?: object | null;
  siteCode: string;
  domain?: string | null;
  siteUrl?: string | null;
}, target: Partial<PublishedSnapshot> | null | undefined) {
  const snapshot = target?.themeSnapshot;
  return {
    theme: (snapshot && typeof snapshot === 'object' ? snapshot : {}) as object,
    siteCode: (target?.siteCode || current.siteCode) as string,
    domain: target?.domain !== undefined ? target.domain : (current.domain ?? null),
    siteUrl: target?.siteUrl !== undefined ? target.siteUrl : (current.siteUrl ?? null),
  };
}

export function serializeDeployment(d: DeploymentView) {
  return {
    id: d.id,
    storeId: d.storeId,
    status: d.status,
    provider: d.provider ?? 'rahatio',
    providerProjectId: d.providerProjectId ?? null,
    providerDeploymentId: d.providerDeploymentId ?? null,
    providerStatus: d.providerStatus ?? null,
    providerUrl: d.providerUrl ?? null,
    providerError: d.providerError ?? null,
    version: d.version,
    siteCode: d.siteCode,
    domain: d.domain,
    siteUrl: d.siteUrl,
    note: d.note,
    deployedAt: d.deployedAt,
    revertedAt: d.revertedAt,
    createdAt: d.createdAt,
  };
}
