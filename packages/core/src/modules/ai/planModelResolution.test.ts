import { describe, expect, it } from 'vitest';
import { resolvePlanModel } from './planModelResolution.js';

describe('plan-level AI model resolution', () => {
  it('prefers the plan override over the scenario default', () => {
    const r = resolvePlanModel({
      overrideModelId: 5,
      overrideProviderId: 2,
      scenarioModelId: 3,
      scenarioProviderId: 1,
      globalModelId: 9,
      globalProviderId: 1,
    });
    expect(r).toEqual({ modelId: 5, providerId: 2 });
  });

  it('falls back to the scenario model when no override is set', () => {
    const r = resolvePlanModel({ scenarioModelId: 3, scenarioProviderId: 1, globalModelId: 9, globalProviderId: 1 });
    expect(r).toEqual({ modelId: 3, providerId: 1 });
  });

  it('uses the global default when scenario has no model', () => {
    const r = resolvePlanModel({ globalModelId: 9, globalProviderId: 1 });
    expect(r).toEqual({ modelId: 9, providerId: 1 });
  });

  it('falls back to the global provider when a candidate model has none', () => {
    const r = resolvePlanModel({ scenarioModelId: 3, scenarioProviderId: null, globalProviderId: 1 });
    expect(r).toEqual({ modelId: 3, providerId: 1 });
  });

  it('returns nulls when nothing is configured', () => {
    const r = resolvePlanModel({});
    expect(r).toEqual({ modelId: null, providerId: null });
  });

  it('treats a missing/disabled override as absent (scenario wins)', () => {
    const r = resolvePlanModel({ scenarioModelId: 3, scenarioProviderId: 1 });
    expect(r).toEqual({ modelId: 3, providerId: 1 });
  });
});