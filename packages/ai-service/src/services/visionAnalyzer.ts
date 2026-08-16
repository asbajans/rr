import fs from 'fs';
import path from 'path';
import { ProductCode, ProductSpecs, AiAttribute } from '../types';
import { callLlm, ChatMessage, ProviderConfig } from './llmProvider.js';
import { SectorConfig, buildSectorFor } from './sectorConfig.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const VISION_MODEL = process.env.VISION_MODEL || 'llama3.2-vision';

const CODE_TYPES = ['barcode', 'part_code', 'model', 'serial', 'label_text'];

function parseCodes(raw: unknown): ProductCode[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c === 'object')
    .map((c: any) => {
      const type = CODE_TYPES.includes(c.type) ? c.type : 'label_text';
      const value = typeof c.value === 'string' ? c.value.trim() : '';
      const confidence =
        typeof c.confidence === 'number' ? Math.max(0, Math.min(1, c.confidence)) : undefined;
      return { type, value, confidence };
    })
    .filter((c) => c.value.length > 0);
}

function parseStrings(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string' && s.trim().length > 0) : [];
}

export interface VisionProviderConfig {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  authType?: string;
  maxTokens?: number;
  reasoningEffort?: string;
}

function mimeFromPath(p: string): string {
  const ext = path.extname(p).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    case '.bmp': return 'image/bmp';
    default: return 'image/jpeg';
  }
}

function buildVisionPrompt(category: string, sector: SectorConfig): string {
  const focus = sector.focus.length ? sector.focus.map((f) => `- ${f}`).join('\n') : '- material, style and purpose of the product';
  const schema = Object.entries(sector.attributeSchema)
    .map(([name, what]) => `"${name}": "${what}"`)
    .join(',\n  ');

  return `You are a professional product analyst specializing in ${sector.label} products. Analyze the provided product photo(s) carefully and thoroughly (more than one photo means the same product is shown from different angles/close-ups — combine the evidence).

This category's key details to look for:
${focus}

Additionally, ALWAYS:
- Transcribe EVERY piece of readable text visible in the image: care labels, size tags, ingredient lists, model/part numbers, brand logos, engraving, "Made in ..." marks. Reproduce codes and numbers EXACTLY as shown.
- If a barcode, part code, model number or serial number is visible, report it separately in "codes" with its type.
- Do NOT invent text that is not legible; if a code is partly illegible, note it in "observations" and mark low confidence.

Extract the following attributes from the photo:
{
  "material": "main material of the product",
  "color": "dominant color(s)",
  "type": "specific product type",
  "style": "style (classic, modern, sportive, etc.)",
  "pattern": "pattern if any",
  "brand": "brand name if visible on product",
  "dimensions": "estimated dimensions if inferrable",
  "weight": "weight if inferrable",
  ${schema},
  "visibleText": "single string with ALL readable text transcribed, joined with ' | '",
  "codes": [
    { "type": "barcode|part_code|model|serial|label_text", "value": "exact code", "confidence": 0.0 }
  ],
  "observations": ["any other notable detail visible in the photo (engraving, contents, condition, markings)"],
  "category": "${category}"
}

Be precise and descriptive. Use Turkish for values. If a fixed field (material, style, etc.) is not determinable, use an empty string.`;
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function repairJson(s: string): string {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,(\s*[}\]])/g, '$1')
    .replace(/\u00a0/g, ' ');
}

function tryParse(s: string): any | null {
  try { return JSON.parse(s); } catch { return null; }
}

// Models often wrap/append text around the JSON. Try progressively:
// direct → balanced-object extraction → repair (curly quotes/trailing commas) →
// longest valid prefix (handles trailing prose/truncation).
function parseJsonResponse(text: string): any {
  const direct = tryParse(text);
  if (direct) return direct;

  const extracted = extractJsonObject(text);
  const candidates = extracted ? [extracted, repairJson(extracted)] : [];
  for (const c of candidates) {
    const parsed = tryParse(c);
    if (parsed) return parsed;
  }

  if (extracted) {
    for (let i = extracted.length - 1; i >= 0; i--) {
      if (extracted[i] === '}' || extracted[i] === ']') {
        const parsed = tryParse(extracted.slice(0, i + 1));
        if (parsed) return parsed;
      }
    }
  }

  throw new Error(`Vision API did not return valid JSON: ${(extracted || text).slice(0, 300)}`);
}

export async function analyzeProductImage(
  imagePath: string | string[],
  category: string,
  providerConfig?: VisionProviderConfig,
  attributes?: AiAttribute[]
): Promise<ProductSpecs> {
  const paths = Array.isArray(imagePath) ? imagePath : [imagePath];
  const sector = buildSectorFor(category, attributes);

  const config: ProviderConfig = providerConfig?.baseUrl
    ? {
        baseUrl: providerConfig.baseUrl,
        model: providerConfig.model || VISION_MODEL,
        apiKey: providerConfig.apiKey,
        authType: (providerConfig.authType as 'bearer' | 'api-key' | 'none') || 'bearer',
        maxTokens: providerConfig.maxTokens,
        reasoningEffort: providerConfig.reasoningEffort,
      }
    : { baseUrl: OLLAMA_URL, model: VISION_MODEL };

  const imageParts = paths.map((p) => {
    const imageBase64 = fs.readFileSync(p).toString('base64');
    const mime = mimeFromPath(p);
    return { type: 'image_url' as const, image_url: { url: `data:${mime};base64,${imageBase64}` } };
  });

  const messages: ChatMessage[] = [
    { role: 'system', content: buildVisionPrompt(category, sector) },
    {
      role: 'user',
      content: [
        { type: 'text', text: `Analyze these ${imageParts.length} product photo(s) of the same product and return the JSON.` },
        ...imageParts,
      ],
    },
  ];

  const text = await callLlm(config, messages, {
    temperature: 0.1,
    maxTokens: config.maxTokens,
    reasoningEffort: config.reasoningEffort,
    responseFormatJson: true,
  });
  const parsed = parseJsonResponse(text);

  return {
    material: parsed.material || '',
    color: parsed.color || '',
    type: parsed.type || '',
    style: parsed.style || '',
    pattern: parsed.pattern,
    brand: parsed.brand,
    dimensions: parsed.dimensions,
    weight: parsed.weight,
    category,
    visibleText: typeof parsed.visibleText === 'string' ? parsed.visibleText : '',
    codes: parseCodes(parsed.codes),
    observations: parseStrings(parsed.observations),
  };
}
