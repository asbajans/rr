import { AiAttribute } from '../types';
import { callLlm, ChatMessage, ProviderConfig } from './llmProvider.js';

export interface CategoryAttributesInput {
  name: string;
  keywords?: string;
  notes?: string;
}

function buildSystemPrompt(): string {
  return `You are a Turkish e-commerce taxonomy expert. For a given product category you design the attribute schema that sellers and listing engines (Trendyol, N11, Hepsiburada, Amazon) expect for that category.

Rules:
- Return ONLY valid JSON, no markdown, no code blocks
- Attribute names in Turkish (e.g. "Renk", "Materyal", "Model No", "Numara")
- 8-15 attributes, ordered by importance (brand/commercial attributes first, then technical)
- Each attribute gets a "description" explaining exactly what to extract from a product photo
- Prefer attributes that are observable from an image (labels, codes, material, color, size); avoid subjective attributes
- NEVER invent brand, model or certification names
- Include attributes for visible text/codes (barcode, part/model/serial numbers) when relevant for this category
- Do not include generic fields like "title", "description", "price", "stock"`;
}

function buildPrompt(input: CategoryAttributesInput): string {
  return `Product category: ${input.name}
${input.keywords ? `Additional context keywords: ${input.keywords}` : ''}
${input.notes ? `Seller notes: ${input.notes}` : ''}

Return the following JSON exactly:
{
  "attributes": [
    { "name": "Attribute Name", "description": "what to look for in the product photo and how to express it" }
  ]
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

export async function generateCategoryAttributes(
  input: CategoryAttributesInput,
  providerConfig?: ProviderConfig
): Promise<{ attributes: AiAttribute[] }> {
  const config: ProviderConfig = providerConfig?.baseUrl
    ? {
        baseUrl: providerConfig.baseUrl,
        model: providerConfig.model || process.env.OLLAMA_LLM_MODEL || 'llama3',
        apiKey: providerConfig.apiKey,
        authType: providerConfig.authType || 'bearer',
        maxTokens: providerConfig.maxTokens,
        reasoningEffort: providerConfig.reasoningEffort,
      }
    : {
        baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_LLM_MODEL || 'llama3',
      };

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildPrompt(input) },
  ];

  const raw = await callLlm(config, messages, {
    temperature: 0.3,
    maxTokens: config.maxTokens,
    reasoningEffort: config.reasoningEffort,
    responseFormatJson: true,
  });
  const data = parseJsonResponse(raw);

  const attributes: AiAttribute[] = Array.isArray(data.attributes)
    ? data.attributes
        .filter((a: any) => a && typeof a === 'object' && typeof a.name === 'string' && a.name.trim())
        .map((a: any) => ({
          name: a.name.trim(),
          description: typeof a.description === 'string' ? a.description.trim() : undefined,
        }))
    : [];

  if (attributes.length === 0) {
    throw new Error('LLM returned no category attributes');
  }

  return { attributes };
}