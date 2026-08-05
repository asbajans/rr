import type { AiAnalysisResult } from '@rahatio/shared';

/**
 * Maps the ai-service snake_case response to the shared camelCase contract
 * (AiAnalysisResult) used for JSON schema validation.
 */
export function normalizeAiResponse(raw: any): AiAnalysisResult {
  const r = raw ?? {};
  const specs = r.specs && typeof r.specs === 'object' ? r.specs : undefined;
  const attributes: Record<string, string> = { ...(r.attributes ?? {}) };
  if (specs) {
    for (const key of ['material', 'color', 'type', 'style', 'pattern', 'brand', 'category']) {
      if (specs[key] && !attributes[key]) attributes[key] = String(specs[key]);
    }
  }

  return {
    productType: r.productType || undefined,
    title: r.title || '',
    description: r.description || '',
    shortDescription: r.short_description || undefined,
    slug: r.slug || undefined,
    category: r.category || specs?.category || undefined,
    attributes,
    tags: Array.isArray(r.tags) ? r.tags : undefined,
    keywords: Array.isArray(r.keywords) ? r.keywords : [],
    bulletPoints: Array.isArray(r.bullet_points) ? r.bullet_points : undefined,
    metaTitle: r.meta_title || undefined,
    metaDescription: r.meta_description || undefined,
    specs,
    priceSuggestion: r.price_suggestion ?? null,
    categoryCandidates: Array.isArray(r.category_candidates) ? r.category_candidates : [],
    warnings: Array.isArray(r.warnings) ? r.warnings : [],
    confidence: r.confidence && typeof r.confidence === 'object' ? r.confidence : {},
  };
}
