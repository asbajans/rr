import fs from 'fs';
import path from 'path';
import { ProductSpecs, ProductCategory } from '../types';
import { callLlm, ChatMessage, ProviderConfig } from './llmProvider.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const VISION_MODEL = process.env.VISION_MODEL || 'llama3.2-vision';

export interface VisionProviderConfig {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  authType?: string;
  maxTokens?: number;
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

function buildVisionPrompt(category: ProductCategory): string {
  return `You are a professional product analyst. Analyze this product image carefully.

Category: ${category}

Return ONLY a valid JSON object (no markdown, no extra text) with these fields:
{
  "material": "main material of the product",
  "color": "dominant color(s)",
  "type": "specific product type",
  "style": "style (classic, modern, sportive, etc.)",
  "pattern": "pattern if any",
  "brand": "brand name if visible on product",
  "dimensions": "estimated dimensions if inferrable",
  "category": "${category}"
}

Be precise and descriptive. Use Turkish for values.`;
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
  imagePath: string,
  category: ProductCategory,
  providerConfig?: VisionProviderConfig
): Promise<ProductSpecs> {
  const imageBase64 = fs.readFileSync(imagePath).toString('base64');
  const mime = mimeFromPath(imagePath);

  const config: ProviderConfig = providerConfig?.baseUrl
    ? {
        baseUrl: providerConfig.baseUrl,
        model: providerConfig.model || VISION_MODEL,
        apiKey: providerConfig.apiKey,
        authType: (providerConfig.authType as 'bearer' | 'api-key' | 'none') || 'bearer',
        maxTokens: providerConfig.maxTokens,
      }
    : { baseUrl: OLLAMA_URL, model: VISION_MODEL };

  const messages: ChatMessage[] = [
    { role: 'system', content: buildVisionPrompt(category) },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Analyze this product image and return the JSON.' },
        { type: 'image_url', image_url: { url: `data:${mime};base64,${imageBase64}` } },
      ],
    },
  ];

  const text = await callLlm(config, messages, { temperature: 0.1, maxTokens: config.maxTokens });
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
  };
}
