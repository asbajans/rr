import { describe, expect, it } from 'vitest';
import {
  AiResponseValidationError,
  parseAiResponse,
} from '../schema/ai-response';

const validResponse = {
  productType: 'women_shoe',
  title: 'Kadın Siyah Deri Günlük Ayakkabı',
  description: 'Rahat kullanımlı günlük ayakkabı.',
  shortDescription: 'Günlük kullanım için ideal',
  slug: 'kadin-siyah-deri-gunluk-ayakkabi',
  category: 'ayakkabi',
  attributes: { color: 'Siyah', material: 'Deri' },
  tags: ['ayakkabı'],
  keywords: ['kadın ayakkabı', 'siyah deri'],
  bulletPoints: ['Rahat', 'Dayanıklı'],
  metaTitle: 'Kadın Siyah Deri Ayakkabı',
  metaDescription: 'Günlük ayakkabı',
  specs: { material: 'Deri', color: 'Siyah' },
  priceSuggestion: { min: 300, max: 450, currency: 'TRY' },
  categoryCandidates: [
    { name: 'Ayakkabı', confidence: 0.96 },
    { name: 'Kadın Ayakkabı', confidence: 0.91 },
  ],
  warnings: ['Numara bilgisi fotoğraftan belirlenemedi'],
  confidence: { title: 0.9, category: 0.96 },
};

describe('parseAiResponse', () => {
  it('accepts a well-formed AI analysis response', () => {
    const parsed = parseAiResponse(validResponse);
    expect(parsed.title).toBe('Kadın Siyah Deri Günlük Ayakkabı');
    expect(parsed.categoryCandidates).toHaveLength(2);
    expect(parsed.confidence.category).toBe(0.96);
  });

  it('accepts a minimal response with empty arrays', () => {
    const minimal = {
      title: 'Ürün',
      description: 'Açıklama',
      attributes: {},
      keywords: [],
      categoryCandidates: [],
      warnings: [],
      confidence: {},
    };
    expect(() => parseAiResponse(minimal)).not.toThrow();
  });

  it('rejects a response without a title', () => {
    const { title: _omit, ...bad } = validResponse;
    expect(() => parseAiResponse(bad)).toThrow(AiResponseValidationError);
  });

  it('rejects a response with malformed categoryCandidates', () => {
    const bad = {
      ...validResponse,
      categoryCandidates: [{ name: 'Ayakkabı' }],
    };
    expect(() => parseAiResponse(bad)).toThrow(AiResponseValidationError);
  });

  it('rejects non-object payloads', () => {
    expect(() => parseAiResponse('just text')).toThrow(
      AiResponseValidationError,
    );
    expect(() => parseAiResponse(null)).toThrow(AiResponseValidationError);
  });
});
