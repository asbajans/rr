import { ProductSpecs, ProductCode, AiAttribute } from '../types';
import { analyzeProductImage } from './visionAnalyzer.js';
import { callLlm, ChatMessage, ProviderConfig } from './llmProvider.js';
import { SectorConfig, buildSectorFor, formatCodes } from './sectorConfig.js';
import { searchWeb, searchWithGoogleVision, WebSearchResult } from './webSearch.js';

export type ProductCondition = 'new' | 'refurbished' | 'used' | 'salvage';

export const CONDITION_LABELS: Record<ProductCondition, string> = {
  new: 'Yeni',
  refurbished: 'Yenilenmiş',
  used: 'İkinci El',
  salvage: 'Çıkma',
};

export function conditionLabel(condition?: ProductCondition | string): string {
  return CONDITION_LABELS[condition as ProductCondition] || '';
}

export interface AgenticListingInput {
  category?: string;
  /** User-defined attributes for a custom category; directs vision + listing prompts. */
  categoryAttributes?: AiAttribute[];
  /** Condition of the product: new / refurbished / used / salvage. */
  condition?: ProductCondition | string;
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
  category_candidates: { name: string; confidence: number }[];
  warnings: string[];
  confidence: Record<string, number>;
}

const CATEGORY_LIST = ['giyim', 'taki', 'kozmetik', 'ayakkabi', 'canta', 'elektronik', 'ev_dekorasyon', 'spor', 'diger'];

const CODE_ATTRIBUTE_LABELS: Record<string, string> = {
  barcode: 'Barkod',
  part_code: 'Parça Kodu',
  model: 'Model No',
  serial: 'Seri No',
  label_text: 'Etiket Bilgisi',
};

function mergeCodeAttributes(attributes: Record<string, string>, codes?: ProductCode[]): Record<string, string> {
  if (!codes || codes.length === 0) return attributes;
  const merged = { ...attributes };
  for (const code of codes) {
    const label = CODE_ATTRIBUTE_LABELS[code.type];
    if (!label || !code.value) continue;
    const existing = Object.entries(merged).find(([k, v]) => k === label || v === code.value);
    if (!existing) {
      merged[label] = code.value;
    }
  }
  return merged;
}

function codeWarnings(codes?: ProductCode[]): string[] {
  const warnings: string[] = [];
  if (!codes || codes.length === 0) return warnings;
  for (const code of codes) {
    if (typeof code.confidence === 'number' && code.confidence < 0.6) {
      warnings.push(`Fotoğrafta okunan "${code.value}" (${CODE_ATTRIBUTE_LABELS[code.type] || code.type}) düşük güvenli, doğrulanması önerilir.`);
    }
  }
  return warnings;
}

function buildSystemPrompt(sector: SectorConfig, condition?: ProductCondition | string): string {
  const claimRules = sector.claimRestrictions?.length
    ? `Sector claim restrictions:\n${sector.claimRestrictions.map((r) => `- ${r}`).join('\n')}`
    : '';

  const isSalvage = condition === 'salvage';

  return `You are an expert e-commerce listing agent for the Turkish market specializing in ${sector.label}. You turn product photo(s) + detected specs into a complete, publish-ready listing draft.

Sector guidance:
${sector.listingGuidance}

Rules:
- Return ONLY valid JSON, no markdown, no code blocks
- Use persuasive, natural Turkish
- Avoid promotional forbidden words for Trendyol: "en iyi", "kaliteli", "orijinal", "garantili", "bedava", "ücretsiz", "toptan", "profesyonel", "kalite", "birinci sınıf", "endüstriyel" (özellikle yedek parça / oto parça ürünlerinde "endüstriyel" kelimesini asla kullanma)
- BRAND RULE: if a brand was detected in the photo (in the specs), the title MUST start with the brand name. NEVER invent a brand that is not in the specs
- CONDITION RULE: the product's condition is given in the prompt. Reflect it in the title (suffix in parentheses like "(Yeni)", "(Yenilenmiş)", "(İkinci El)", "(Çıkma)") and describe it honestly in the description + attributes ("Durum"). For "Yeni" keep the title clean and state "Yeni" naturally in description + attributes
- PART CODE RULE: if a part/model code is present it MUST be reproduced EXACTLY. For spare parts / automotive / industrial parts, include the code in the title (it is how buyers search). For other products include it in attributes + description only
- If "Reference Search Results" or "Salvage Reference Search Results" are provided, use them to determine the exact product name and description; do NOT contradict them and do NOT invent facts that are neither in the specs nor in the references
- Title max 60 characters, follow the sector title pattern: ${sector.titleTemplate}
- Amazon bullet points max 200 characters each
- SEO meta title max 60 chars, meta description max 160 chars
- NEVER invent facts that are not visible in the image: do not fabricate a brand, price, stock quantity, size, or technical specs
- Barcodes, part/model/serial codes detected from the photo MUST be reproduced EXACTLY and included both as attributes and naturally in the description
- Do not fabricate any code: if a code is uncertain it is provided with low confidence; use it only with high confidence, otherwise move it to warnings
- For health, cosmetic and food products, do NOT make medical or safety claims
- Only report high-confidence details; if a detail is uncertain, mark it in warnings
- Provide a "confidence" score (0-1) for each generated field
- Provide 2-3 "category_candidates" each with a confidence score (0-1)
${isSalvage ? `
SALVAGE (ÇIKMA) LISTING RULES — apply ONLY when the product condition is "Çıkma":
- Do NOT write generic marketing copy. Focus on FACTS: what vehicles/models the part fits, where it is used, and how to remove/install it
- Examine "Readable Text on Product" and "Additional Observations" carefully — they often contain vehicle brand names, model codes, part numbers, or OEM references that identify the vehicle
- Title MUST include: brand + part name + compatible vehicle model(s) + condition marker "(Çıkma)". Example: "Bosch Fren Balatası Seti Toyota Corolla E90 (Çıkma)"
- Description MUST include these sections (Turkish): "Uyumlu Araçlar" (compatible vehicles with years/models), "Kullanım Yeri" (where on the vehicle), "Söküm / Çıkarma Bilgisi" (removal guidance), "Montaj Notları" (installation notes)
- SEO meta_title and meta_description MUST contain the vehicle model + part name + "çıkma" so users searching "<araç modeli> <parça adı> çıkma" find this listing
- Keywords MUST include: "<marka> <parça> çıkma", "<araç modeli> <parça> uyumlu", "<parça kodu>", "<marka> <parça> söküm", "<araç modeli> <parça> çıkma"
- From "Salvage Reference Search Results": extract EVERY vehicle model/brand/year range mentioned. Include all of them in "Uyumlu Araçlar". If the results mention specific series (e.g., "Renault Magnum", "Mercedes Actros"), list them
- Do NOT fabricate vehicle compatibility — only include vehicles that appear in the Salvage Reference Search Results OR in the Visible Text / Observations
- Bullet points for Amazon should focus on: compatible vehicles, OEM/part code, condition details, removal notes
- Attributes MUST include: "Uyumlu Araçlar" (all compatible vehicles), "Kullanım Yeri", "Söküm Bilgisi", "Araç Tipi" (kamyon/kamyonet/binek/etc.)
` : ''}
${claimRules}`;
}

function buildPrompt(
  specs: ProductSpecs,
  input: AgenticListingInput,
  sector: SectorConfig,
  referenceResults: WebSearchResult[] = []
): string {
  const marketplaces = input.targetMarketplaces?.length
    ? input.targetMarketplaces.join(', ')
    : 'Trendyol, N11, Hepsiburada';

  const schema = Object.entries(sector.attributeSchema)
    .map(([name]) => `"${name}": "<value>"`)
    .join(',\n    ');

  const codes = formatCodes(specs.codes);
  const observations = specs.observations?.length
    ? specs.observations.map((o) => `- ${o}`).join('\n')
    : '';
  const condition = conditionLabel(input.condition);
  const reference = referenceResults
    .map((r, i) => `${i + 1}. ${r.title}${r.snippet ? ` — ${r.snippet}` : ''}${r.url ? ` (${r.url})` : ''}`)
    .join('\n');

  const isSalvage = input.condition === 'salvage';

  return `Product Specifications (detected from image):
- Material: ${specs.material}
- Color: ${specs.color}
- Type: ${specs.type}
- Style: ${specs.style}
- Pattern: ${specs.pattern || 'N/A'}
- Brand: ${specs.brand || 'N/A'}
- Dimensions: ${specs.dimensions || 'N/A'}
- Weight: ${specs.weight || 'N/A'}
- Detected Category: ${specs.category}

Product Condition: ${condition || 'belirtilmemiş'}

Readable Text on Product:
${specs.visibleText ? `- ${specs.visibleText}` : '- None transcribed'}

Detected Codes (must be reproduced exactly, do not invent others):
${codes || '- None'}

Additional Observations:
${observations || '- None'}

Seller Notes:
${input.shortDescription ? `- Short Description: ${input.shortDescription}` : ''}
${input.keywords ? `- Keywords: ${input.keywords}` : ''}
${input.notes ? `- Additional Notes: ${input.notes}` : ''}

${isSalvage ? `Salvage Reference Search Results (web lookup for vehicle compatibility, usage, and removal info):
${reference || '- None available — rely on detected specs only'}

IMPORTANT for ÇIKMA (salvage) products:
- Extract ALL COMPATIBLE VEHICLES from the reference results (make/model/series/year range). If results mention specific series like "Renault Magnum", "Mercedes Actros", list them all
- Also check "Readable Text on Product" and "Additional Observations" — they may contain OEM part numbers, vehicle brand names, or model references (e.g., döküm yazıları, etiket numaraları)
- Extract USAGE LOCATION (where on the vehicle this part is used)
- Extract REMOVAL/INSTALLATION notes from the results
- If no reference results are available, use ONLY the detected specs, visible text and codes; do NOT fabricate vehicle compatibility` : `Reference Search Results (web lookup of the detected codes — use these to determine the exact product name and description; do not contradict them):
${reference || '- None available'}`}

Target Marketplaces: ${marketplaces}
Suggest Price Range: ${input.suggestPrice !== false ? 'YES - estimate a reasonable market price range for this product type' : 'NO - omit price suggestion'}

Return the following JSON exactly:
{
  "title": "${isSalvage ? 'BRAND + part name + compatible vehicle model(s) + "(Çıkma)". Must include vehicle model for SEO. Example: "Bosch Fren Balatası Toyota Corolla E90 (Çıkma)"' : 'BRAND (if known) + product type + condition marker. Max 60 chars. Follow pattern ${sector.titleTemplate}. Examples: \'Bosch Fren Balatası Seti (Yeni)\', \'Siemens Röle (Çıkma)\''}",
  "short_description": "${isSalvage ? '1-2 sentences: what the part is, which vehicles it fits, condition details' : '1-2 sentence short description'}",
  "description": "HTML long description, ${isSalvage ? '200-300 words, FACT-BASED: sections for Uyumlu Araçlar, Kullanım Yeri, Söküm Bilgisi, Montaj Notları' : '200-300 words, persuasive'}",
  "meta_title": "SEO title max 60 chars${isSalvage ? ' — MUST include vehicle model + part name + "çıkma"' : ''}",
  "meta_description": "SEO description max 160 chars${isSalvage ? ' — MUST include vehicle model + part name + "çıkma" for search visibility' : ''}",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"${isSalvage ? ' — include "<brand> <part> çıkma", "<vehicle> <part> uyumlu", "<part code>", "<brand> <part> söküm"' : ''}],
  "slug": "url-friendly-slug-in-turkish",
  "category": "one of: ${CATEGORY_LIST.join(', ')}",
  "attributes": {
    "Renk": "${specs.color}",
    "Materyal": "${specs.material}",
    "Stil": "${specs.style}",
    "Tür": "${specs.type}",
    "Durum": "${condition}",
    ${schema},
    ...other relevant attributes and any detected codes (e.g. "Model No", "Parça Kodu", "Barkod", "Seri No")${isSalvage ? `,
    "Uyumlu Araçlar": "<all compatible vehicles from reference results: brand + model + series + year range, comma-separated>",
    "Kullanım Yeri": "<where on the vehicle this part is used>",
    "Söküm Bilgisi": "<brief removal guidance>",
    "Araç Tipi": "<kamyon/kamyonet/binek/ticari/ağır vasıta/otobüs>"` : ''}
  },
  "bullet_points": ["5 ${isSalvage ? 'bullet points focusing on compatible vehicles, OEM code, condition, removal notes' : 'persuasive bullets for Amazon'}"],
  "price_suggestion": ${input.suggestPrice !== false
    ? '{ "min": <number>, "max": <number>, "currency": "TRY", "rationale": "short reasoning" }'
    : 'null'},
  "category_candidates": [
    { "name": "best category name", "confidence": 0.0 },
    { "name": "second best category name", "confidence": 0.0 }
  ],
  "warnings": ["anything uncertain or not detectable from the photo"],
  "confidence": { "title": 0.0, "category": 0.0, "description": 0.0, "attributes": 0.0 }
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
  providerConfig?: ProviderConfig,
  referenceResults?: WebSearchResult[]
): Promise<Omit<AgenticListingResult, 'specs'>> {
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

  const sector = buildSectorFor(input.category || 'diger', input.categoryAttributes);

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(sector, input.condition) },
    { role: 'user', content: buildPrompt(specs, input, sector, referenceResults) },
  ];

  const raw = await callLlm(config, messages, {
    temperature: 0.4,
    maxTokens: config.maxTokens,
    reasoningEffort: config.reasoningEffort,
    responseFormatJson: true,
  });
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

  const categoryCandidates = Array.isArray(data.category_candidates)
    ? data.category_candidates
        .filter((c: any) => c && typeof c === 'object' && typeof c.name === 'string')
        .map((c: any) => ({
          name: c.name,
          confidence: typeof c.confidence === 'number' ? Math.max(0, Math.min(1, c.confidence)) : 0,
        }))
    : [];
  if (categoryCandidates.length === 0 && category) {
    categoryCandidates.push({ name: category, confidence: 0.5 });
  }

  const warnings: string[] = Array.isArray(data.warnings)
    ? data.warnings.filter((w: any) => typeof w === 'string')
    : [];
  if (!specs.brand) warnings.push('Marka fotoğraftan tanımlanamadı, boş bırakıldı.');
  if (!specs.dimensions) warnings.push('Boyut/ölçü bilgisi fotoğraftan belirlenemedi.');
  warnings.push(...codeWarnings(specs.codes));

  const confidence: Record<string, number> =
    data.confidence && typeof data.confidence === 'object' ? data.confidence : {};
  confidence.title = typeof confidence.title === 'number' ? confidence.title : 0.5;
  confidence.category = typeof confidence.category === 'number' ? confidence.category : 0.5;
  confidence.description = typeof confidence.description === 'number' ? confidence.description : 0.5;

  return {
    title: data.title || '',
    description: data.description || '',
    short_description: data.short_description || '',
    meta_title: data.meta_title || '',
    meta_description: data.meta_description || '',
    keywords: Array.isArray(data.keywords) ? data.keywords : [],
    slug: data.slug || '',
    category,
    attributes: mergeCodeAttributes(
      data.attributes && typeof data.attributes === 'object' ? data.attributes : {},
      specs.codes
    ),
    bullet_points: Array.isArray(data.bullet_points) ? data.bullet_points : [],
    price_suggestion: priceSuggestion,
    category_candidates: categoryCandidates,
    warnings,
    confidence,
  };
}

/**
 * Looks up detected part/model/barcode codes on the web so the listing agent
 * can write an accurate title + description (best-effort; never throws).
 */
async function searchForCodes(codes?: ProductCode[]): Promise<WebSearchResult[]> {
  if (!codes || codes.length === 0) return [];
  const code =
    codes.find((c) => ['part_code', 'model', 'serial', 'barcode'].includes(c.type)) || codes[0];
  if (!code || !code.value.trim()) return [];

  const results: WebSearchResult[] = [];
  const seen = new Set<string>();
  for (const q of [`"${code.value}"`, `${code.value} ${code.type === 'part_code' ? 'parça' : ''}`.trim()]) {
    let batch: WebSearchResult[] = [];
    try {
      batch = await searchWeb(q, 5);
    } catch {
      batch = [];
    }
    if (!Array.isArray(batch)) batch = [];
    for (const r of batch) {
      if (r.title && !seen.has(r.title)) {
        seen.add(r.title);
        results.push(r);
      }
    }
  }
  return results.slice(0, 6);
}

/**
 * Salvage-only: builds multi-query web search targeting vehicle compatibility,
 * usage context, and removal/installation guidance. Uses ALL detected codes,
 * visible text markings, and part type synonyms to maximize search coverage.
 * Best-effort; never throws.
 */
async function searchForSalvageReferences(
  specs: ProductSpecs,
  input: AgenticListingInput,
  imagePath?: string
): Promise<WebSearchResult[]> {
  const brand = specs.brand?.trim();
  const codes = specs.codes || [];
  const category = specs.category || input.category || '';
  const type = specs.type || '';
  const visibleText = specs.visibleText || '';

  // Step 1: Google Cloud Vision reverse image search (if API key configured)
  const gcvResults = imagePath ? await searchWithGoogleVision(imagePath) : [];

  const queries: string[] = [];
  const seenQueries = new Set<string>();
  const addQ = (q: string) => {
    const clean = q.trim().replace(/\s+/g, ' ');
    if (clean.length >= 3 && !seenQueries.has(clean.toLowerCase())) {
      seenQueries.add(clean.toLowerCase());
      queries.push(clean);
    }
  };

  const allCodeValues = codes
    .filter((c) => c.value?.trim())
    .map((c) => c.value.trim());

  for (const cv of allCodeValues.slice(0, 2)) {
    addQ(`"${cv}"`);
    addQ(`${cv} çıkma parça`);
    if (brand) addQ(`${brand} ${cv} araç uyumu`);
    if (brand) addQ(`${brand} ${cv} söküm`);
  }

  if (visibleText) {
    const lines = visibleText.split(/[\n|/]+/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 4)) {
      if (line.length >= 3 && !allCodeValues.some((cv) => line === cv)) {
        addQ(`"${line}"`);
        addQ(`${line} çıkma parça`);
      }
    }
    const words = visibleText.replace(/[^\w\sğüşıöçĞÜŞİÖÇ]/g, ' ').split(/\s+/).filter((w) => w.length >= 3);
    const meaningful = words.filter((w) => !/^\d+$/.test(w) && w.length >= 3);
    if (meaningful.length >= 2) {
      addQ(`${meaningful.slice(0, 4).join(' ')} araç uyumu`);
    }
  }

  if (brand && type) {
    addQ(`${brand} ${type} çıkma`);
    addQ(`${brand} ${type} uyumlu araç`);
  }

  if (brand && category) {
    addQ(`${brand} ${category} parça uyumlu araç`);
  }

  if (type) {
    addQ(`${type} çıkma parça`);
    addQ(`${type} hangi araca uyumlu`);
  }

  const vehicleHints = extractVehicleHints(specs);
  for (const hint of vehicleHints.slice(0, 3)) {
    if (brand) addQ(`${brand} ${hint}`);
    if (type) addQ(`${type} ${hint}`);
  }

  if (queries.length === 0) return [];

  const results: WebSearchResult[] = [];
  const seen = new Set<string>();
  const maxQueries = Math.min(queries.length, 15);
  for (const q of queries.slice(0, maxQueries)) {
    let batch: WebSearchResult[] = [];
    try {
      batch = await searchWeb(q, 5);
    } catch {
      batch = [];
    }
    if (!Array.isArray(batch)) batch = [];
    for (const r of batch) {
      if (r.title && !seen.has(r.title)) {
        seen.add(r.title);
        results.push(r);
      }
    }
  }
  // Step 3: Merge — GCV results first (visual search), then text results
  const merged: WebSearchResult[] = [];
  const mergedSeen = new Set<string>();
  for (const r of [...gcvResults, ...results]) {
    const key = r.title || r.url;
    if (key && !mergedSeen.has(key)) {
      mergedSeen.add(key);
      merged.push(r);
    }
  }
  return merged.slice(0, 20);
}

/**
 * Tries to extract vehicle hints (kamyon, kamyonet, binek, ticari, ağır vasıta,
 * trailer, dorse etc.) from specs and visible text.
 */
function extractVehicleHints(specs: ProductSpecs): string[] {
  const hints: string[] = [];
  const all = `${specs.type} ${specs.style} ${specs.visibleText || ''}`.toLowerCase();

  const vehicleTerms: [RegExp, string][] = [
    [/\bkamyon\b/, 'kamyon'],
    [/\bkamyonet\b/, 'kamyonet'],
    [/\bbinek\b/, 'binek'],
    [/\bticari\b/, 'ticari araç'],
    [/\bağır\s*vasıta\b/, 'ağır vasıta'],
    [/\b(otobüs|minibüs)\b/, 'otobüs/minibüs'],
    [/\bdorse\b/, 'dorse'],
    [/\brömork\b/, 'römork'],
    [/\bçekici\b/, 'çekici'],
    [/\btraktör\b/, 'traktör'],
  ];

  for (const [re, label] of vehicleTerms) {
    if (re.test(all) && label) hints.push(label);
  }

  const brandMatch = all.match(/\b(renault|mercedes|volvo|man|scania|daf|iveco|fiat|ford|volkswagen|bmw|toyota|hyundai|seat)\b/);
  if (brandMatch) hints.push(brandMatch[1]);

  return [...new Set(hints)];
}

export async function generateAgenticListing(
  imagePath: string | string[],
  input: AgenticListingInput,
  providerConfig?: ProviderConfig
): Promise<AgenticListingResult> {
  const category = input.category || 'diger';
  const specs = await analyzeProductImage(imagePath, category, providerConfig, input.categoryAttributes);

  const isSalvage = input.condition === 'salvage';
  const referenceResults = isSalvage
    ? await searchForSalvageReferences(specs, input, Array.isArray(imagePath) ? imagePath[0] : imagePath)
    : await searchForCodes(specs.codes);

  const draft = await generateListingDraft(specs, input, providerConfig, referenceResults);
  return { specs, ...draft };
}
