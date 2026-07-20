import { ProductSpecs, SellerNotes, SeoContent, TrendyolListing, AmazonListing } from '../types';
import { callOllama } from './ollama.js';

function buildSystemPrompt(): string {
  return `You are an expert e-commerce copywriter and SEO specialist for the Turkish market.
You generate high-converting product listings in Turkish.

Rules:
- Return ONLY valid JSON, no markdown, no code blocks
- Use persuasive, natural Turkish
- Avoid promotional forbidden words for Trendyol: "en iyi", "kaliteli", "orijinal", "garantili", "bedava", "ücretsiz", "toptan", "profesyonel", "kalite", "birinci sınıf"
- Keep titles under 60 characters for Trendyol
- Amazon bullet points must be max 200 characters each
- SEO meta title max 60 chars, meta description max 160 chars`;
}

function buildPrompt(
  specs: ProductSpecs,
  notes: SellerNotes,
  imageUrls: string[]
): string {
  return `Product Specifications:
- Material: ${specs.material}
- Color: ${specs.color}
- Type: ${specs.type}
- Style: ${specs.style}
- Pattern: ${specs.pattern || 'N/A'}
- Brand: ${specs.brand || 'N/A'}
- Dimensions: ${specs.dimensions || 'N/A'}
- Category: ${specs.category}

Seller Notes:
${notes.shortDescription ? `- Short Description: ${notes.shortDescription}` : ''}
${notes.keywords ? `- Keywords: ${notes.keywords}` : ''}
${notes.targetAudience ? `- Target Audience: ${notes.targetAudience}` : ''}
${notes.notes ? `- Additional Notes: ${notes.notes}` : ''}

Product Image URLs:
${imageUrls.map((u, i) => `  ${i + 1}. ${u}`).join('\n')}

Generate the following JSON structure exactly:

{
  "seo": {
    "metaTitle": "SEO title max 60 chars",
    "metaDescription": "SEO description max 160 chars",
    "slug": "url-friendly-slug-in-turkish",
    "longDescription": "Persuasive 200-300 word HTML product description for website",
    "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
  },
  "trendyol": {
    "title": "Trendyol title under 60 chars, no forbidden words",
    "description": "Short description for Trendyol",
    "attributes": {
      "Renk": "${specs.color}",
      "Materyal": "${specs.material}",
      "Stil": "${specs.style}",
      ...other relevant attributes
    },
    "forbiddenWordsRemoved": ["list of any forbidden words you avoided"]
  },
  "amazon": {
    "bulletPoints": [
      "Bullet 1: key feature/benefit (max 200 chars)",
      "Bullet 2: material/quality detail",
      "Bullet 3: usage/style benefit",
      "Bullet 4: care instructions or dimensions",
      "Bullet 5: guarantee/satisfaction"
    ],
    "description": "Short product description for Amazon",
    "keywords": "search terms separated by spaces"
  }
}`;
}

async function callOllamaLocal(prompt: string): Promise<string> {
  return callOllama(prompt, buildSystemPrompt(), { temperature: 0.3, top_p: 0.95 });
}

function parseJsonResponse(raw: string) {
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

export async function generateListings(
  specs: ProductSpecs,
  notes: SellerNotes,
  imageUrls: string[],
  onProgress: (msg: string) => void
): Promise<{
  seo: SeoContent;
  trendyol: TrendyolListing;
  amazon: AmazonListing;
}> {
  onProgress('Yapay zeka metinleri oluşturuluyor...');

  const prompt = buildPrompt(specs, notes, imageUrls);
  const raw = await callOllamaLocal(prompt);
  const data = parseJsonResponse(raw);

  return {
    seo: data.seo as SeoContent,
    trendyol: data.trendyol as TrendyolListing,
    amazon: data.amazon as AmazonListing,
  };
}
