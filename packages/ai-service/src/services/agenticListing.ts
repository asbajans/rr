import { ProductCategory, ProductSpecs } from '../types';
import { analyzeProductImage } from './visionAnalyzer.js';
import { callLlm, ChatMessage, ProviderConfig } from './llmProvider.js';

export interface AgenticListingInput {
  category?: ProductCategory;
  shortDescription?: string;
  keywords?: string;
  notes?: string;
  suggestPrice?: boolean;
  targetMarketplaces?: string[];
}

export interface AgenticListingResult {
  specs: ProductSpecs;
  title: string;
  description: string;
  short_description: string;
  meta_title: string;
  meta_description: string;
  keywords: string[];
  slug: string;
  category: string;
  attributes: Record<string, string>;
  bullet_points: string[];
  price_suggestion: { min: number; max: number; currency: string; rationale: string } | null;
}

const CATEGORY_LIST = ['giyim', 'taki', 'kozmetik', 'ayakkabi', 'canta', 'elektronik', 'ev_dekorasyon', 'spor', 'diger'];

function buildSystemPrompt(): string {
  return `You are an expert e-commerce listing agent for the Turkish market. You turn a product photo + detected specs into a complete, publish-ready listing draft.

Rules:
- Return ONLY valid JSON, no markdown, no code blocks
- Use persuasive, natural Turkish
- Avoid promotional forbidden words for Trendyol: "en iyi", "kaliteli", "orijinal", "garantili", "bedava", "ücretsiz", "toptan", "profesyonel", "kalite", "birinci sınıf"
- Title max 60 characters
- Amazon bullet points max 200 characters each
- SEO meta title max 60 chars, meta description max 160 chars`;
}

function buildPrompt(
  specs: ProductSpecs,
  input: AgenticListingInput
): string {
  const marketplaces = input.targetMarketplaces?.length
    ? input.targetMarketplaces.join(', ')
    : 'Trendyol, N11, Hepsiburada';

  return `Product Specifications (detected from image):
- Material: ${specs.material}
- Color: ${specs.color}
- Type: ${specs.type}
- Style: ${specs.style}
- Pattern: ${specs.pattern || 'N/A'}
- Brand: ${specs.brand || 'N/A'}
- Dimensions: ${specs.dimensions || 'N/A'}
- Detected Category: ${specs.category}

Seller Notes:
${input.shortDescription ? `- Short Description: ${input.shortDescription}` : ''}
${input.keywords ? `- Keywords: ${input.keywords}` : ''}
${input.notes ? `- Additional Notes: ${input.notes}` : ''}

Target Marketplaces: ${marketplaces}
Suggest Price Range: ${input.suggestPrice !== false ? 'YES - estimate a reasonable market price range for this product type' : 'NO - omit price suggestion'}

Return the following JSON exactly:
{
  "title": "short catchy product title (max 60 chars, no forbidden words)",
  "short_description": "1-2 sentence short description",
  "description": "HTML long description, 200-300 words, persuasive",
  "meta_title": "SEO title max 60 chars",
  "meta_description": "SEO description max 160 chars",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "slug": "url-friendly-slug-in-turkish",
  "category": "one of: ${CATEGORY_LIST.join(', ')}",
  "attributes": { "Renk": "${specs.color}", "Materyal": "${specs.material}", "Stil": "${specs.style}", "Tür": "${specs.type}", ...other relevant attributes },
  "bullet_points": ["5 persuasive bullets for Amazon"],
  "price_suggestion": ${input.suggestPrice !== false
    ? '{ "min": <number>, "max": <number>, "currency": "TRY", "rationale": "short reasoning" }'
    : 'null'}
}`;
}

function parseJsonResponse(raw: string): any {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`LLM did not return valid JSON:\n${raw.slice(0, 300)}`);
  }

  return JSON.parse(jsonMatch[0]);
}

async function generateListingDraft(
  specs: ProductSpecs,
  input: AgenticListingInput,
  providerConfig?: ProviderConfig
): Promise<Omit<AgenticListingResult, 'specs'>> {
  const config: ProviderConfig = providerConfig?.baseUrl
    ? {
        baseUrl: providerConfig.baseUrl,
        model: providerConfig.model || process.env.OLLAMA_LLM_MODEL || 'llama3',
        apiKey: providerConfig.apiKey,
        authType: providerConfig.authType || 'bearer',
      }
    : {
        baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_LLM_MODEL || 'llama3',
      };

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildPrompt(specs, input) },
  ];

  const raw = await callLlm(config, messages, { temperature: 0.4, maxTokens: 2048 });
  const data = parseJsonResponse(raw);

  const category = CATEGORY_LIST.includes(data.category) ? data.category : specs.category;

  const priceSuggestion =
    input.suggestPrice !== false && data.price_suggestion && typeof data.price_suggestion === 'object'
      ? {
          min: Number(data.price_suggestion.min) || 0,
          max: Number(data.price_suggestion.max) || 0,
          currency: data.price_suggestion.currency || 'TRY',
          rationale: data.price_suggestion.rationale || '',
        }
      : null;

  return {
    title: data.title || '',
    description: data.description || '',
    short_description: data.short_description || '',
    meta_title: data.meta_title || '',
    meta_description: data.meta_description || '',
    keywords: Array.isArray(data.keywords) ? data.keywords : [],
    slug: data.slug || '',
    category,
    attributes: data.attributes && typeof data.attributes === 'object' ? data.attributes : {},
    bullet_points: Array.isArray(data.bullet_points) ? data.bullet_points : [],
    price_suggestion: priceSuggestion,
  };
}

export async function generateAgenticListing(
  imagePath: string,
  input: AgenticListingInput,
  providerConfig?: ProviderConfig
): Promise<AgenticListingResult> {
  const category = input.category || 'diger';
  const specs = await analyzeProductImage(imagePath, category, providerConfig);
  const draft = await generateListingDraft(specs, input, providerConfig);
  return { specs, ...draft };
}
