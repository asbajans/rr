import { beforeEach, describe, expect, it, vi } from 'vitest';

const { integrationFindOne, mappingFindOne } = vi.hoisted(() => ({
  integrationFindOne: vi.fn(),
  mappingFindOne: vi.fn(),
}));

vi.mock('../../models/AiProductDraft.model.js', () => ({ AiProductDraft: class {} }));
vi.mock('../../models/MarketplaceIntegration.model.js', () => ({
  MarketplaceIntegration: { findOne: integrationFindOne },
}));
vi.mock('../../models/Category.model.js', () => ({
  MarketplaceCategoryMapping: { findOne: mappingFindOne },
}));

import { validateDraftForChannels } from './channelRequirements.js';

const draft = (overrides: Record<string, unknown> = {}) => ({
  storeId: 1,
  title: 'Ürün',
  description: 'Açıklama',
  suggestedPrice: 100,
  quantity: 5,
  categoryId: 10,
  attributes: { brand: 'Demo' },
  ...overrides,
}) as any;

describe('AI Studio channel validation contract', () => {
  beforeEach(() => {
    integrationFindOne.mockReset();
    mappingFindOne.mockReset();
    integrationFindOne.mockResolvedValue({ isActive: true });
    mappingFindOne.mockResolvedValue({ marketplace: 'trendyol' });
  });

  it('returns an actionable suggestion for missing product fields', async () => {
    const [result] = await validateDraftForChannels(draft({ title: '', suggestedPrice: null }), ['storefront']);

    expect(result).toMatchObject({
      status: 'missing-fields',
      missingFields: ['title', 'price'],
    });
    expect(result.suggestion).toContain('title, price');
  });

  it('explains that a marketplace integration must be connected', async () => {
    integrationFindOne.mockResolvedValue(null);

    const [result] = await validateDraftForChannels(draft(), ['trendyol']);

    expect(result.status).toBe('integration-not-connected');
    expect(result.suggestion).toMatch(/entegrasyon/i);
  });

  it('explains that category mapping must be completed', async () => {
    mappingFindOne.mockResolvedValue(null);

    const [result] = await validateDraftForChannels(draft(), ['trendyol']);

    expect(result.status).toBe('category-mapping-needed');
    expect(result.suggestion).toMatch(/kategori/i);
  });

  it('returns ready when the draft and channel prerequisites are complete', async () => {
    const [result] = await validateDraftForChannels(draft(), ['trendyol']);

    expect(result).toMatchObject({ status: 'ready', missingFields: [] });
    expect(result.suggestion).toBeUndefined();
  });
});
