import http from 'http';
import https from 'https';
import fs from 'fs';

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
