import http from 'http';
import https from 'https';
import fs from 'fs';
import { ProductSpecs, ProductCode } from '../types/index.js';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function httpGet(url: string, timeoutMs = 12000): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' } }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('search timeout')));
  });
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

async function searchGoogleCse(query: string, maxResults: number): Promise<WebSearchResult[]> {
  const key = process.env.SEARCH_API_KEY;
  const cx = process.env.SEARCH_ENGINE_ID;
  if (!key || !cx) return [];
  const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=${Math.min(maxResults, 10)}`;
  const json = await httpGet(url, 12000);
  const data = JSON.parse(json);
  return (data.items || [])
    .slice(0, maxResults)
    .map((it: any) => ({ title: it.title || '', url: it.link || '', snippet: it.snippet || '' }))
    .filter((r: WebSearchResult) => r.title || r.snippet);
}

async function searchDuckDuckGo(query: string, maxResults: number): Promise<WebSearchResult[]> {
  const html = await httpGet(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, 12000);
  // Each result block is a <div class="result ...">. Splitting on `class="result`
  // followed by a word boundary avoids splitting on result__a/result__snippet.
  const parts = html.split(/class="result\b/);
  const results: WebSearchResult[] = [];
  for (let i = 1; i < parts.length && results.length < maxResults; i++) {
    const block = parts[i];
    const titleMatch = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    if (!titleMatch) continue;
    let url = titleMatch[1];
    if (url.startsWith('//duckduckgo.com/l/?uddg=')) {
      try { url = decodeURIComponent(url.replace('//duckduckgo.com/l/?uddg=', '')); } catch { /* keep raw */ }
    }
    results.push({
      title: decodeEntities(stripTags(titleMatch[2])),
      url,
      snippet: snippetMatch ? decodeEntities(stripTags(snippetMatch[1])).slice(0, 220) : '',
    });
  }
  return results.slice(0, maxResults);
}

/**
 * Best-effort web search used to look up detected part/model/barcode codes so
 * the listing agent can write an accurate title + description. Uses Google
 * Programmable Search when SEARCH_API_KEY/SEARCH_ENGINE_ID are configured,
 * otherwise falls back to a keyless DuckDuckGo HTML scrape. Never throws.
 */
export async function searchWeb(query: string, maxResults = 6): Promise<WebSearchResult[]> {
  if (process.env.SEARCH_API_KEY && process.env.SEARCH_ENGINE_ID) {
    try {
      const r = await searchGoogleCse(query, maxResults);
      if (r.length > 0) return r;
    } catch { /* fall through to DDG */ }
  }
  try {
    return await searchDuckDuckGo(query, maxResults);
  } catch {
    return [];
  }
}

function httpPost(url: string, body: string, timeoutMs = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const urlObj = new URL(url);
    const req = client.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => reject(new Error(`GCV HTTP ${res.statusCode}: ${Buffer.concat(chunks).toString('utf8').slice(0, 300)}`)));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('GCV request timeout')));
    req.write(body);
    req.end();
  });
}

/**
 * Google Cloud Vision API — WEB_DETECTION reverse image search.
 * Finds similar images on the web, best-guess labels, and pages with matching
 * images. Used for salvage parts to identify vehicle compatibility.
 * Returns [] when GOOGLE_CLOUD_VISION_API_KEY is not set or on any error.
 */
export async function searchWithGoogleVision(imagePath: string): Promise<WebSearchResult[]> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) return [];

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const fileSizeMB = imageBuffer.length / (1024 * 1024);

    if (imageBuffer.length < 100) {
      console.warn(`[GCV] Image file too small (${imageBuffer.length}B), likely download failed — skipping: ${imagePath}`);
      return [];
    }

    if (fileSizeMB > 10) {
      console.warn(`[GCV] Image too large (${fileSizeMB.toFixed(1)}MB), skipping`);
      return [];
    }

    const base64Image = imageBuffer.toString('base64');

    const requestBody = JSON.stringify({
      requests: [
        {
          image: { content: base64Image },
          features: [{ type: 'WEB_DETECTION', maxResults: 10 }],
        },
      ],
    });

    const url = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`;
    const json = await httpPost(url, requestBody, 30000);
    const data = JSON.parse(json);

    if (data.error) {
      console.error(`[GCV] API error:`, JSON.stringify(data.error).slice(0, 500));
      return [];
    }

    const annotation = data.responses?.[0]?.webDetection;
    if (!annotation) {
      console.warn('[GCV] No webDetection in response');
      return [];
    }

    const results: WebSearchResult[] = [];
    const seen = new Set<string>();

    if (annotation.bestGuessLabels?.length) {
      const label = annotation.bestGuessLabels[0].label;
      if (label) {
        results.push({ title: `[GCV Best Guess] ${label}`, url: '', snippet: label });
      }
    }

    if (annotation.webEntities?.length) {
      for (const entity of annotation.webEntities) {
        if (entity.description && !seen.has(entity.description)) {
          seen.add(entity.description);
          results.push({
            title: `[GCV Entity] ${entity.description}`,
            url: '',
            snippet: `Güven: ${Math.round((entity.score || 0) * 100)}%`,
          });
        }
      }
    }

    if (annotation.pagesWithMatchingImages?.length) {
      for (const page of annotation.pagesWithMatchingImages.slice(0, 8)) {
        const pageTitle = page.title || page.url || '';
        if (pageTitle && !seen.has(page.url)) {
          seen.add(page.url);
          results.push({
            title: pageTitle,
            url: page.url || '',
            snippet: '',
          });
        }
      }
    }

    console.log(`[GCV] Found ${results.length} results for ${imagePath}`);
    return results.slice(0, 12);
  } catch (err: any) {
    console.error(`[GCV] searchWithGoogleVision failed:`, err?.message || err);
    return [];
  }
}

/** Known vehicle makes, longest-first for correct matching ("mercedes-benz" beats "mercedes"). */
export const VEHICLE_MAKES = [
  'mercedes-benz', 'mercedes', 'volkswagen', 'volvo', 'scania', 'renault',
  'peugeot', 'citroen', 'toyota', 'honda', 'nissan', 'fiat', 'ford', 'opel',
  'hyundai', 'kia', 'bmw', 'audi', 'seat', 'skoda', 'daf', 'iveco', 'man',
  'isuzu', 'mitsubishi', 'suzuki', 'mazda', 'chevrolet', 'dodge', 'jeep',
  'land rover', 'byd', 'tesla', 'togg', 'bmc', 'temsa', 'otokar', 'karsan',
  'ankara', 'tata', 'ashok leyland', 'howo', 'shacman', 'foton', 'dongfeng',
  'sinotruk', 'gaz', 'kamaz', 'uaz', 'lada', 'zil', 'praga', 'tatra', 'saviem',
  'berliet', 'uniq', 'feldbinder',
];

const ACRONYM_MAKES = new Set(['bmc', 'daf', 'man', 'iveco', 'uaz', 'gaz', 'zil', 'togg', 'byd']);

/** Extracts a known vehicle make from a GCV best-guess / entity label. */
export function extractBrandFromGcvLabel(label: string): string | null {
  if (!label) return null;
  const normalized = label.trim().toLowerCase();
  for (const make of VEHICLE_MAKES) {
    if (normalized.startsWith(make) || normalized.includes(` ${make} `) || normalized.endsWith(` ${make}`)) {
      if (ACRONYM_MAKES.has(make)) return make.toUpperCase();
      return make.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return null;
}

export interface GcvProductAnalysis {
  bestGuess: string;
  entities: string[];
  labels: string[];
  objects: string[];
  text: string;
  /** Pages with matching images from WEB_DETECTION (search results for salvage references). */
  pages: WebSearchResult[];
}

/**
 * Full Google Cloud Vision image analysis used for ÇIKMA (salvage) products.
 * Runs WEB_DETECTION + LABEL_DETECTION + TEXT_DETECTION + OBJECT_LOCALIZATION
 * and logs every result under the [GCV-ANALYSIS] prefix. Returns null when no
 * API key is configured, the image is invalid, or the API call fails.
 */
export async function analyzeProductImageWithGcv(imagePath: string): Promise<GcvProductAnalysis | null> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) return null;

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const fileSizeMB = imageBuffer.length / (1024 * 1024);
    if (imageBuffer.length < 100) {
      console.warn(`[GCV-ANALYSIS] Image file too small (${imageBuffer.length}B), skipping: ${imagePath}`);
      return null;
    }
    if (fileSizeMB > 10) {
      console.warn(`[GCV-ANALYSIS] Image too large (${fileSizeMB.toFixed(1)}MB), skipping`);
      return null;
    }

    const base64Image = imageBuffer.toString('base64');
    const requestBody = JSON.stringify({
      requests: [
        {
          image: { content: base64Image },
          features: [
            { type: 'WEB_DETECTION', maxResults: 10 },
            { type: 'LABEL_DETECTION', maxResults: 15 },
            { type: 'TEXT_DETECTION', maxResults: 5 },
            { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
          ],
        },
      ],
    });

    const url = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`;
    const json = await httpPost(url, requestBody, 30000);
    const data = JSON.parse(json);

    if (data.error) {
      console.error(`[GCV-ANALYSIS] API error:`, JSON.stringify(data.error).slice(0, 500));
      return null;
    }

    const response = data.responses?.[0];
    if (!response) {
      console.warn('[GCV-ANALYSIS] No response from GCV');
      return null;
    }

    const bestGuess = response.webDetection?.bestGuessLabels?.[0]?.label?.trim() || '';
    const entities = (response.webDetection?.webEntities || [])
      .map((e: any) => e.description?.trim())
      .filter((d: string) => d)
      .slice(0, 10);
    const labels = (response.labelAnnotations || [])
      .map((l: any) => l.description?.trim())
      .filter((d: string) => d)
      .slice(0, 15);
    const objects = (response.localizedObjectAnnotations || [])
      .map((o: any) => o.name?.trim())
      .filter((d: string) => d)
      .slice(0, 10);
    const text = response.textAnnotations?.[0]?.description?.trim() || '';

    const pages: WebSearchResult[] = [];
    const seenPages = new Set<string>();
    for (const page of (response.webDetection?.pagesWithMatchingImages || []).slice(0, 8)) {
      const pageTitle = page.title || page.url || '';
      if (page.url && !seenPages.has(page.url)) {
        seenPages.add(page.url);
        pages.push({ title: pageTitle, url: page.url, snippet: '' });
      }
    }

    const analysis: GcvProductAnalysis = { bestGuess, entities, labels, objects, text, pages };

    console.log(`[GCV-ANALYSIS] ===== Google Cloud Vision full analysis =====`);
    console.log(`[GCV-ANALYSIS] bestGuess: ${bestGuess || '- none -'}`);
    console.log(`[GCV-ANALYSIS] entities: ${entities.length ? entities.join(' | ') : '- none -'}`);
    console.log(`[GCV-ANALYSIS] labels: ${labels.length ? labels.join(' | ') : '- none -'}`);
    console.log(`[GCV-ANALYSIS] objects: ${objects.length ? objects.join(' | ') : '- none -'}`);
    console.log(`[GCV-ANALYSIS] detectedText: ${text ? text.slice(0, 600) : '- none -'}`);
    console.log(`[GCV-ANALYSIS] matchedPages (${pages.length}): ${pages.length ? pages.slice(0, 6).map((p) => p.url || p.title).join(' | ') : '- none -'}`);
    console.log(`[GCV-ANALYSIS] ==============================================`);

    return analysis;
  } catch (err: any) {
    console.error(`[GCV-ANALYSIS] analyzeProductImageWithGcv failed:`, err?.message || err);
    return null;
  }
}

/**
 * Builds ProductSpecs from a GCV analysis. Uses the best guess / web entities to
 * determine the make + product name, TEXT_DETECTION for visible text/codes, and
 * labels/objects for observations. Fields GCV cannot infer (material, color,
 * style) are taken from the vision-model `fallback` specs.
 */
export function buildSpecsFromGcv(
  analysis: GcvProductAnalysis,
  category: string,
  fallback: ProductSpecs
): ProductSpecs {
  const specs: ProductSpecs = { ...fallback, category };

  const guess = analysis.bestGuess || analysis.entities.join(' ');
  const brand = extractBrandFromGcvLabel(guess);
  if (brand) specs.brand = brand;

  if (analysis.text) {
    specs.visibleText = analysis.text;
    const codes = parseGcvCodes(analysis.text);
    if (codes.length) specs.codes = codes;
  }

  const observations: string[] = [];
  if (analysis.bestGuess) observations.push(`Google görsel araması: ${analysis.bestGuess}`);
  if (analysis.labels.length) observations.push(`Etiketler: ${analysis.labels.slice(0, 6).join(', ')}`);
  if (analysis.objects.length) observations.push(`Nesneler: ${analysis.objects.slice(0, 6).join(', ')}`);
  if (analysis.entities.length) observations.push(`Web varlıkları: ${analysis.entities.slice(0, 5).join(', ')}`);
  specs.observations = [...(fallback.observations || []), ...observations];

  return specs;
}

/** Strips scripts/styles/tags from an HTML page, returning plain lowercase text. */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:amp|nbsp|quot|#39|lt|gt);/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Extracts "<make> <model>" vehicle combinations from plain text. */
function extractVehicleMakesFromText(text: string, limit = 30): string[] {
  const found = new Set<string>();
  for (const make of VEHICLE_MAKES) {
    const escaped = make.replace(/[-]/g, '\\-');
    const re = new RegExp(`(^|[^a-zçğıöşü])(${escaped}\\s[a-zçğıöşü0-9][a-zçğıöşü0-9\\-]{1,30})`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const v = m[2];
      if (v && v.length <= 40 && !/^\d+$/.test(v)) found.add(v);
      if (found.size >= limit) break;
    }
    if (found.size >= limit) break;
  }
  return [...found];
}

/**
 * Fetches the GCV matched-image pages (pagesWithMatchingImages) and extracts
 * compatible vehicle make/model combinations from their CONTENT — parts
 * listing pages usually carry "Fits / Uyumlu araçlar" lists that the title
 * alone does not include. Best-effort; never throws.
 */
export async function extractCompatibleVehiclesFromPages(
  pages: WebSearchResult[],
  maxPages = 6
): Promise<string[]> {
  const uniqueUrls = [...new Set(pages.map((p) => p.url).filter((u) => u && u.startsWith('http')))].slice(0, maxPages);
  if (uniqueUrls.length === 0) return [];

  const found = new Set<string>();
  await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        const html = await httpGet(url, 10000);
        if (!html) return;
        for (const v of extractVehicleMakesFromText(htmlToPlainText(html))) {
          found.add(v);
          if (found.size >= 30) break;
        }
      } catch { /* best-effort: skip unreadable pages */ }
    })
  );

  if (found.size) {
    console.log(`[GCV] Compatible vehicles from ${uniqueUrls.length} matched pages: ${[...found].slice(0, 12).join(', ')}`);
  }
  return [...found].slice(0, 25);
}

function parseGcvCodes(text: string): ProductCode[] {
  const codes: ProductCode[] = [];
  const lines = text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length >= 3);
  for (const line of lines.slice(0, 8)) {
    let token = line.replace(/[\s|:/]+$/, '').replace(/^[#*:;.]+/, '').trim();
    token = token.replace(/^(no|no\.|parça|part|model|ürün|kod)[:\s]*/i, '').trim();
    // Long bare numbers (8+ digits) are usually AD / listing item numbers or
    // phone/watermark digits from the photo source site — NOT part codes. They
    // must not reach the prompt as a "part_code" or the LLM will treat them as
    // OEM part numbers. Shorter numerics (6-7) are kept as plausible part codes.
    const isNumeric = /^\d{6,7}$/.test(token);
    const isAdNumber = /^\d{8,}$/.test(token);
    const isAlnum = /^[A-Z0-9][A-Z0-9\-./]{3,}$/i.test(token) && /[A-Z]/i.test(token) && /\d/.test(token);
    if ((isNumeric || isAlnum) && !isAdNumber) {
      codes.push({ type: 'part_code', value: token, confidence: 0.7 });
    }
  }
  return codes;
}
