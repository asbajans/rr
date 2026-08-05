/**
 * JSON schema validation for structured AI analysis output.
 * Invalid AI output must never become a draft (AGENTOPEN.md Faz 0 / §7).
 */
import { z } from 'zod';
import type { AiAnalysisResult } from '../dto/ai';

const CategoryCandidateSchema = z.object({
  name: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

const ProductSpecsSchema = z
  .object({
    material: z.string().optional(),
    color: z.string().optional(),
    type: z.string().optional(),
    style: z.string().optional(),
    pattern: z.string().optional(),
    brand: z.string().optional(),
    dimensions: z.string().optional(),
    weight: z.string().optional(),
    category: z.string().optional(),
  })
  .passthrough();

const PriceSuggestionSchema = z
  .object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
    currency: z.string().min(1),
    rationale: z.string().optional(),
  })
  .nullable()
  .optional();

export const AiAnalysisResultSchema = z.object({
  productType: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  shortDescription: z.string().optional(),
  slug: z.string().optional(),
  category: z.string().optional(),
  attributes: z.record(z.string()),
  tags: z.array(z.string()).optional(),
  keywords: z.array(z.string()),
  bulletPoints: z.array(z.string()).optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  specs: ProductSpecsSchema.optional(),
  priceSuggestion: PriceSuggestionSchema,
  categoryCandidates: z.array(CategoryCandidateSchema),
  warnings: z.array(z.string()),
  confidence: z.record(z.number()),
});

export class AiResponseValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Invalid AI response: ${issues.join('; ')}`);
    this.name = 'AiResponseValidationError';
    this.issues = issues;
  }
}

/**
 * Validates and normalizes a raw AI analysis response.
 * @throws AiResponseValidationError when the payload does not match the schema.
 */
export function parseAiResponse(data: unknown): AiAnalysisResult {
  const result = AiAnalysisResultSchema.safeParse(data);
  if (!result.success) {
    throw new AiResponseValidationError(
      result.error.issues.map(
        (i) => `${i.path.join('.') || 'root'}: ${i.message}`,
      ),
    );
  }
  return result.data as AiAnalysisResult;
}
