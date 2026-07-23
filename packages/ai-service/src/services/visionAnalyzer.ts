import axios from 'axios';
import fs from 'fs';
import { ProductSpecs, ProductCategory } from '../types';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const VISION_MODEL = process.env.VISION_MODEL || 'llama3.2-vision';

interface ProviderConfig {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  authType?: string;
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

async function analyzeWithOllama(
  imagePath: string,
  category: ProductCategory
): Promise<ProductSpecs> {
  const imageBase64 = fs.readFileSync(imagePath).toString('base64');

  const res = await axios.post(`${OLLAMA_URL}/api/generate`, {
    model: VISION_MODEL,
    prompt: buildVisionPrompt(category),
    images: [imageBase64],
    stream: false,
    options: { temperature: 0.1, top_p: 0.9 },
  });

  const text: string = res.data.response;

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Vision API did not return valid JSON: ${text.slice(0, 200)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);

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

export async function analyzeProductImage(
  imagePath: string,
  category: ProductCategory,
  providerConfig?: ProviderConfig
): Promise<ProductSpecs> {
  // Use Ollama for vision analysis (LLaVA/llama3.2-vision)
  // Future: extend to support GPT-4o, Claude 3, Gemini vision APIs
  return analyzeWithOllama(imagePath, category);
}