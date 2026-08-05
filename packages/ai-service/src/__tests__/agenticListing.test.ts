import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProductSpecs } from '../types';

vi.mock('../services/llmProvider.js', () => ({
  callLlm: vi.fn(),
}));

vi.mock('../services/visionAnalyzer.js', () => ({
  analyzeProductImage: vi.fn(),
}));

import { generateAgenticListing } from '../services/agenticListing.js';
import { callLlm } from '../services/llmProvider.js';
import { analyzeProductImage } from '../services/visionAnalyzer.js';

const specs: ProductSpecs = {
  material: 'Deri',
  color: 'Siyah',
  type: 'Günlük ayakkabı',
  style: 'Klasik',
  category: 'ayakkabi',
};

const llmJson = JSON.stringify({
  title: 'Kadın Siyah Deri Günlük Ayakkabı',
  short_description: 'Rahat kullanımlı günlük ayakkabı.',
  description: '<p>Uzun açıklama</p>',
  meta_title: 'Kadın Siyah Deri Ayakkabı',
  meta_description: 'Günlük ayakkabı açıklaması',
  keywords: ['kadın ayakkabı', 'siyah deri'],
  slug: 'kadin-siyah-deri-gunluk-ayakkabi',
  category: 'ayakkabi',
  attributes: { Renk: 'Siyah', Materyal: 'Deri' },
  bullet_points: ['Rahat', 'Dayanıklı'],
  price_suggestion: { min: 300, max: 450, currency: 'TRY', rationale: 'Piyasa ortalaması' },
  category_candidates: [
    { name: 'Ayakkabı', confidence: 0.96 },
    { name: 'Kadın Ayakkabı', confidence: 0.91 },
  ],
  warnings: ['Numara bilgisi fotoğraftan belirlenemedi'],
  confidence: { title: 0.9, category: 0.96 },
});

describe('generateAgenticListing structured output', () => {
  beforeEach(() => {
    vi.mocked(callLlm).mockResolvedValue(llmJson);
    vi.mocked(analyzeProductImage).mockResolvedValue(specs);
  });

  it('emits category_candidates, warnings and confidence', async () => {
    const result = await generateAgenticListing('/tmp/img.png', { suggestPrice: true });

    expect(result.category_candidates).toHaveLength(2);
    expect(result.category_candidates[0]).toEqual({ name: 'Ayakkabı', confidence: 0.96 });
    expect(result.warnings).toContain('Numara bilgisi fotoğraftan belirlenemedi');
    expect(result.confidence.title).toBe(0.9);
    expect(result.price_suggestion?.min).toBe(300);
  });

  it('seeds default warnings when brand/dimensions are missing', async () => {
    vi.mocked(callLlm).mockResolvedValue(
      JSON.stringify({ ...JSON.parse(llmJson), warnings: [], confidence: {} })
    );
    const result = await generateAgenticListing('/tmp/img.png', { suggestPrice: false });

    expect(result.warnings.some((w) => w.includes('Marka'))).toBe(true);
    expect(result.price_suggestion).toBeNull();
    expect(result.confidence.title).toBe(0.5);
  });

  it('falls back to detected category when LLM returns an invalid one', async () => {
    vi.mocked(callLlm).mockResolvedValue(
      JSON.stringify({ ...JSON.parse(llmJson), category: 'bilinmeyen' })
    );
    const result = await generateAgenticListing('/tmp/img.png', {});
    expect(result.category).toBe('ayakkabi');
  });
});
