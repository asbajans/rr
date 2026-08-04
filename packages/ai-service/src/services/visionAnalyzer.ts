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

function parseJsonResponse(text: string): any {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Vision API did not return valid JSON: ${text.slice(0, 200)}`);
  }
  return JSON.parse(jsonMatch[0]);
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

  const text = await callLlm(config, messages, { temperature: 0.1, maxTokens: 1024 });
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
