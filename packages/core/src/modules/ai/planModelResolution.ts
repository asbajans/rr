export interface ResolvedModel {
  modelId: number | null;
  providerId: number | null;
}

export interface ResolveOptions {
  /** Plan-level override model (found & active). Absent when no override or it was disabled/missing. */
  overrideModelId?: number | null;
  overrideProviderId?: number | null;
  /** Scenario default model/config. */
  scenarioModelId?: number | null;
  scenarioProviderId?: number | null;
  /** Global default fallback. */
  globalModelId?: number | null;
  globalProviderId?: number | null;
}

/**
 * Plan-first model resolution order:
 *  1. plan override (when available)
 *  2. scenario default model
 *  3. global default model
 * A candidate model without its own provider falls back to the global default
 * provider. Returns nulls when nothing is configured.
 */
export function resolvePlanModel(opts: ResolveOptions = {}): ResolvedModel {
  if (opts.overrideModelId != null) {
    return {
      modelId: opts.overrideModelId,
      providerId: opts.overrideProviderId ?? opts.globalProviderId ?? null,
    };
  }
  if (opts.scenarioModelId != null) {
    return {
      modelId: opts.scenarioModelId,
      providerId: opts.scenarioProviderId ?? opts.globalProviderId ?? null,
    };
  }
  if (opts.globalModelId != null) {
    return {
      modelId: opts.globalModelId,
      providerId: opts.globalProviderId ?? null,
    };
  }
  return { modelId: null, providerId: null };
}