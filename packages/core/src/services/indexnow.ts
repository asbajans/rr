/**
 * IndexNow (indexnow.org) — hızlı indexleme servisi.
 *
 * Bing + Yandex + Naver + Seznam + Yep destekler. Google desteklemez
 * (Google için sitemap + Search Console yeterlidir).
 *
 * Kullanım:
 *   - Yeni/güncellenen ürün, blog yazısı ve sayfa kaydedilince `notifyIndexNow(urls)`
 *     fire-and-forget çağrılır (asla throw etmez, isteği bloklamaz).
 *   - Eski içerik için toplu gönderim: `POST /api/admin/seo/indexnow/submit-all`
 *
 * Kurulum:
 *   INDEXNOW_KEY=<32+ karakter hex>  (örn. `openssl rand -hex 16`)
 *   Anahtar dosyası frontend tarafından `https://{host}/{key}.txt` adresinde
 *   sunulur (frontend/src/app/[keytxt]/route.ts). Key yoksa gönderim skip edilir.
 */

const INDEXNOW_ENDPOINT = process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/IndexNow';
const PLATFORM_ORIGIN =
  process.env.APP_FRONTEND_URL || process.env.FRONTEND_URL || 'https://rahatio.com.tr';

export function getIndexNowKey(): string {
  return (process.env.INDEXNOW_KEY || '').trim();
}

export function isIndexNowEnabled(): boolean {
  return getIndexNowKey().length >= 8;
}

export function platformOrigin(): string {
  return PLATFORM_ORIGIN.replace(/\/$/, '');
}

function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  let d = String(domain).trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  if (!d || d === 'rahatio.com.tr' || d.endsWith('.rahatio.com.tr')) return null;
  if (d === 'localhost' || d.endsWith('.localhost')) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(d)) return null;
  return d;
}

/** Mağazanın canonical origin'i (custom domain varsa o, yoksa platform path değil origin). */
export function storeCanonicalOrigin(siteCode: string, domain?: string | null): string {
  const d = normalizeDomain(domain);
  if (d) return `https://${d}`;
  return platformOrigin();
}

/**
 * Bir mağaza içeriği için indexlenecek URL'leri üretir.
 * Her zaman platform path URL'sini içerir; custom domain varsa canonical URL'yi de ekler.
 */
export function storefrontUrlsFor(
  siteCode: string,
  kind: 'store' | 'product' | 'blog' | 'blog-index' | 'page',
  slugOrId?: string | number,
  domain?: string | null,
): string[] {
  const base = `${platformOrigin()}/stores/${siteCode}`;
  const custom = normalizeDomain(domain);
  const customBase = custom ? `https://${custom}` : null;
  const pathFor = (): string | null => {
    const s = slugOrId != null ? String(slugOrId) : '';
    switch (kind) {
      case 'store':
        return '';
      case 'product':
        return s ? `/products/${s}` : null;
      case 'blog':
        return s ? `/blog/${s}` : null;
      case 'blog-index':
        return '/blog';
      case 'page':
        return s ? `/pages/${s}` : null;
      default:
        return null;
    }
  };
  const path = pathFor();
  if (path === null) return [];
  const urls = [`${base}${path}`];
  if (customBase) urls.push(`${customBase}${path}`);
  return urls;
}

function groupByHost(urls: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const u of urls) {
    try {
      const host = new URL(u).host.toLowerCase();
      if (!host) continue;
      const arr = groups.get(host) ?? [];
      if (!arr.includes(u)) arr.push(u);
      groups.set(host, arr);
    } catch {
      // geçersiz URL — atla
    }
  }
  return groups;
}

async function submitForHost(host: string, urls: string[], key: string): Promise<boolean> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        urlList: urls.slice(0, 10000),
      }),
    });
    // 200/202 = ok, 429 = rate-limit (daha sonra tekrar denenebilir ama bloklama)
    return res.status === 200 || res.status === 202;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/**
 * URL'leri IndexNow'a gönderir. Fire-and-forget: promise döner ama
 * çağıran yerin `void notifyIndexNow(...)` / `.catch(()=>{})` ile
 * beklemeden çağırması önerilir. Asla throw etmez.
 */
export async function notifyIndexNow(urls: string | string[]): Promise<{ submitted: number; ok: boolean }> {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
  if (!list.length) return { submitted: 0, ok: false };
  const key = getIndexNowKey();
  if (!key) return { submitted: 0, ok: false };
  const groups = groupByHost(list);
  if (!groups.size) return { submitted: 0, ok: false };
  let submitted = 0;
  let ok = false;
  await Promise.all(
    [...groups.entries()].map(async ([host, hostUrls]) => {
      const success = await submitForHost(host, hostUrls, key);
      submitted += hostUrls.length;
      if (success) ok = true;
    }),
  );
  return { submitted, ok };
}

/** Tek mağaza içeriği için kısayol: URL'leri kur + gönder (await'lenmemesi önerilir). */
export function notifyStorefrontChange(
  siteCode: string,
  kind: 'store' | 'product' | 'blog' | 'blog-index' | 'page',
  slugOrId?: string | number,
  domain?: string | null,
): Promise<{ submitted: number; ok: boolean }> {
  return notifyIndexNow(storefrontUrlsFor(siteCode, kind, slugOrId, domain));
}
