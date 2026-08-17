import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProductSpecs } from '../types';

vi.mock('../services/llmProvider.js', () => ({
  callLlm: vi.fn(),
}));

vi.mock('../services/visionAnalyzer.js', () => ({
  analyzeProductImage: vi.fn(),
}));

vi.mock('../services/webSearch.js', () => ({
  searchWeb: vi.fn(),
}));

import { generateAgenticListing, conditionLabel } from '../services/agenticListing.js';
import { callLlm } from '../services/llmProvider.js';
import { analyzeProductImage } from '../services/visionAnalyzer.js';
import { searchWeb } from '../services/webSearch.js';

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
    vi.mocked(callLlm).mockReset();
    vi.mocked(analyzeProductImage).mockReset();
    vi.mocked(searchWeb).mockReset();
    vi.mocked(callLlm).mockResolvedValue(llmJson);
    vi.mocked(analyzeProductImage).mockResolvedValue(specs);
    vi.mocked(searchWeb).mockResolvedValue([]);
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

  it('merges detected codes into attributes and warns on low confidence', async () => {
    vi.mocked(analyzeProductImage).mockResolvedValue({
      ...specs,
      visibleText: 'Model No: RH-1234 | Made in TR',
      codes: [
        { type: 'model', value: 'RH-1234', confidence: 0.95 },
        { type: 'barcode', value: '8690000000000', confidence: 0.4 },
      ],
      observations: ['İç tabanda numara yazısı var'],
    });
    const result = await generateAgenticListing('/tmp/img.png', { suggestPrice: false });

    expect(result.attributes['Model No']).toBe('RH-1234');
    expect(result.attributes['Barkod']).toBe('8690000000000');
    expect(result.warnings.some((w) => w.includes('8690000000000'))).toBe(true);
  });

  it('looks up detected codes on the web before generating the listing', async () => {
    vi.mocked(analyzeProductImage).mockResolvedValue({
      ...specs,
      brand: 'Bosch',
      codes: [{ type: 'part_code', value: '0986AB1234', confidence: 0.9 }],
    });
    vi.mocked(searchWeb).mockResolvedValue([
      { title: 'Bosch Fren Balatası 0986AB1234', url: 'https://example.com/1', snippet: 'Ön fren balatası seti' },
    ]);
    await generateAgenticListing('/tmp/img.png', { suggestPrice: false });

    expect(searchWeb).toHaveBeenCalled();
    const queries = vi.mocked(searchWeb).mock.calls.map((c) => c[0]);
    expect(queries.some((q) => q.includes('0986AB1234'))).toBe(true);
  });

  it('maps product conditions to Turkish labels used in title/description', () => {
    expect(conditionLabel('new')).toBe('Yeni');
    expect(conditionLabel('refurbished')).toBe('Yenilenmiş');
    expect(conditionLabel('used')).toBe('İkinci El');
    expect(conditionLabel('salvage')).toBe('Çıkma');
    expect(conditionLabel(undefined)).toBe('');
  });

  it('returns empty references (no crash) when web search fails', async () => {
    vi.mocked(analyzeProductImage).mockResolvedValue({
      ...specs,
      codes: [{ type: 'model', value: 'XYZ-1', confidence: 0.7 }],
    });
    vi.mocked(searchWeb).mockRejectedValue(new Error('network'));
    const result = await generateAgenticListing('/tmp/img.png', { condition: 'used', suggestPrice: false });
    expect(result.title).toBe('Kadın Siyah Deri Günlük Ayakkabı');
  });

  it('triggers multi-query salvage search when condition is salvage', async () => {
    vi.mocked(analyzeProductImage).mockResolvedValue({
      ...specs,
      brand: 'Bosch',
      codes: [{ type: 'part_code', value: '0986AB1234', confidence: 0.95 }],
    });
    vi.mocked(searchWeb).mockResolvedValue([
      { title: 'Bosch Fren Balatası 0986AB1234 Toyota Corolla', url: 'https://example.com/1', snippet: 'Toyota Corolla E90 uyumlu ön fren balatası' },
      { title: '0986AB1234 Söküm Talimatı', url: 'https://example.com/2', snippet: 'Tekerlek sökülerek erişilir' },
    ]);
    await generateAgenticListing('/tmp/img.png', { condition: 'salvage', suggestPrice: false });

    expect(searchWeb).toHaveBeenCalled();
    const queries = vi.mocked(searchWeb).mock.calls.map((c) => c[0]);
    expect(queries.some((q) => q.includes('0986AB1234') && q.includes('çıkma'))).toBe(true);
    expect(queries.some((q) => q.includes('Bosch') && q.includes('araç uyumu'))).toBe(true);
  });

  it('does not trigger salvage search when condition is not salvage', async () => {
    vi.mocked(analyzeProductImage).mockResolvedValue({
      ...specs,
      brand: 'Bosch',
      codes: [{ type: 'part_code', value: '0986AB1234', confidence: 0.95 }],
    });
    vi.mocked(searchWeb).mockResolvedValue([]);
    await generateAgenticListing('/tmp/img.png', { condition: 'new', suggestPrice: false });

    const queries = vi.mocked(searchWeb).mock.calls.map((c) => c[0]);
    expect(queries.every((q) => !q.includes('çıkma'))).toBe(true);
  });

  it('uses salvage search results for reference instead of basic code search', async () => {
    vi.mocked(analyzeProductImage).mockResolvedValue({
      ...specs,
      brand: 'Bosch',
      codes: [{ type: 'part_code', value: '0986AB1234', confidence: 0.95 }],
    });
    vi.mocked(searchWeb).mockResolvedValue([
      { title: 'Bosch Fren Balatası 0986AB1234', url: 'https://example.com/1', snippet: 'Toyota Corolla E90 ön fren balatası seti, 1993-1997' },
    ]);
    await generateAgenticListing('/tmp/img.png', { condition: 'salvage', suggestPrice: false });

    expect(searchWeb).toHaveBeenCalled();
    const queries = vi.mocked(searchWeb).mock.calls.map((c) => c[0]);
    expect(queries.some((q) => q.includes('söküm'))).toBe(true);
    expect(queries.some((q) => q.includes('uyumlu'))).toBe(true);
  });
});
