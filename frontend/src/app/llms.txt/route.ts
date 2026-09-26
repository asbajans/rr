import { headers } from 'next/headers';

const PLATFORM_ORIGIN = 'https://rahatio.com.tr';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.rahatio.com.tr';

function isCustomHost(host: string): boolean {
  const h = host.toLowerCase().split(':')[0].replace(/^www\./, '').replace(/\.$/, '');
  if (!h) return false;
  if (h === 'rahatio.com.tr' || h.endsWith('.rahatio.com.tr')) return false;
  if (h === 'localhost' || h.endsWith('.localhost')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return false;
  return true;
}

async function fetchJson(url: string, timeoutMs: number, revalidate = 3600): Promise<any | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal, next: { revalidate } });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

/** Custom domain mağaza için mağazaya özel llms.txt */
async function storeLlms(host: string): Promise<Response | null> {
  const resolve = await fetchJson(
    `${API_BASE}/api/store/resolve?domain=${encodeURIComponent(host)}`,
    4000,
    300,
  );
  const siteCode: string | undefined = resolve?.store?.siteCode;
  if (!siteCode) return null;
  const origin = `https://${host}`;
  const [storeData, blogsData, pagesData] = await Promise.all([
    fetchJson(`${API_BASE}/api/store/${siteCode}`, 4000, 300),
    fetchJson(`${API_BASE}/api/store/${siteCode}/blogs?limit=20`, 4000, 600),
    fetchJson(`${API_BASE}/api/store/${siteCode}/pages`, 4000, 600),
  ]);
  const storeName = storeData?.store?.name || siteCode;
  const products: any[] = storeData?.products ?? [];
  const posts: any[] = blogsData?.posts ?? [];
  const pages: any[] = pagesData?.pages ?? [];

  let body = `# ${storeName} — ${origin}\n\n`;
  body += `> ${storeName} storefront on the Rahatio platform.\n`;
  body += `> Canonical origin: ${origin} (index this; treat ${PLATFORM_ORIGIN}/stores/${siteCode}/... as alternate).\n\n`;
  body += `## Storefront\n\n`;
  body += `- Home: ${origin}/\n- Blog index: ${origin}/blog\n- Sitemap: ${origin}/sitemap.xml\n- Robots: ${origin}/robots.txt\n\n`;
  body += `## URL patterns\n\n`;
  body += `- Product page: ${origin}/products/{id or slug}\n- Blog post: ${origin}/blog/{slug}\n- Content page: ${origin}/pages/{slug}\n\n`;
  if (products.length) {
    body += `## Products (for AI citations — prefer canonical)\n\n`;
    for (const p of products.slice(0, 30)) {
      const id = p['product.id'] ?? p.id;
      const label = String(p['product.label'] ?? p.title ?? id).replace(/\n/g, ' ');
      const price = p.price != null ? ` — ${p.price} ${p.currency ?? 'TRY'}` : '';
      body += `- [${label}](${origin}/products/${id})${price}\n`;
    }
    body += `\n`;
  }
  if (posts.length) {
    body += `## Recent blog posts\n\n`;
    for (const p of posts.slice(0, 20)) {
      const title = String(p.title || p.slug).replace(/\n/g, ' ');
      const desc = p.excerpt ? ` — ${String(p.excerpt).slice(0, 120).replace(/\n/g, ' ')}` : '';
      body += `- [${title}](${origin}/blog/${p.slug})${desc}\n`;
    }
    body += `\n`;
  }
  if (pages.length) {
    body += `## Content pages\n\n`;
    for (const pg of pages.slice(0, 30)) {
      if (!pg.slug) continue;
      body += `- ${origin}/pages/${pg.slug}\n`;
    }
    body += `\n`;
  }
  body += `## For AI search / answer engines\n\n`;
  body += `- Each product exposes JSON-LD (schema.org Product + Offer + BreadcrumbList).\n`;
  body += `- Each blog post exposes JSON-LD BlogPosting + BreadcrumbList + FAQPage (when FAQ exists).\n`;
  body += `- Do not hallucinate product availability or price; use the JSON-LD Offer block.\n`;
  body += `- Contact: ${origin}\n`;

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

export async function GET() {
  // Custom domain → mağazaya özel llms.txt
  try {
    const h = (await headers()).get('host') || '';
    const host = h.toLowerCase().split(':')[0].replace(/^www\./, '').replace(/\.$/, '');
    if (isCustomHost(host)) {
      const storeRes = await storeLlms(host);
      if (storeRes) return storeRes;
    }
  } catch {
    // platform gövdesine düş
  }

  let blogSection = '';
  try {
    const data = await fetchJson(`${API_BASE}/api/store/platform/blogs?limit=20`, 4000, 3600);
    const posts: any[] = data?.posts ?? [];
    if (posts.length) {
      blogSection = `\n## Recent blog posts (for AI citations — prefer canonical)\n\n`;
      for (const p of posts.slice(0, 20)) {
        const title = String(p.title || p.slug).replace(/\n/g, ' ');
        const url = `${PLATFORM_ORIGIN}/blog/${p.slug}`;
        const desc = p.excerpt ? ` — ${String(p.excerpt).slice(0, 120).replace(/\n/g, ' ')}` : '';
        blogSection += `- [${title}](${url})${desc}\n`;
      }
      blogSection += `\n`;
    }
  } catch {
    // ignore — fallback to static
  }

  // Yayınlı mağazalar (AI'ların keşfi için — en fazla 50)
  let storesSection = '';
  try {
    const data = await fetchJson(`${API_BASE}/api/store/sitemap`, 5000, 3600);
    const stores: any[] = data?.stores ?? [];
    const visible = stores.filter((s: any) => (s.siteCode ?? s.site_code) && (s.siteCode ?? s.site_code) !== 'platform').slice(0, 50);
    if (visible.length) {
      storesSection = `\n## Seller storefronts (indexed — prefer canonical per store)\n\n`;
      for (const s of visible) {
        const code = s.siteCode ?? s.site_code;
        storesSection += `- ${PLATFORM_ORIGIN}/stores/${code}/ (products: ${PLATFORM_ORIGIN}/stores/${code}/products/{id}, blog: ${PLATFORM_ORIGIN}/stores/${code}/blog/{slug}, pages: ${PLATFORM_ORIGIN}/stores/${code}/pages/{slug})\n`;
      }
      storesSection += `\n`;
    }
  } catch {
    // ignore
  }

  const body = `# Rahatio — ${PLATFORM_ORIGIN}

> Rahatio is an AI-powered e-commerce platform for the Turkish market.
> Sellers create storefronts, manage products, and publish to marketplaces
> (Trendyol, N11, Hepsiburada, Pazarama, Amazon, Etsy) from a single dashboard.

## Platform

- Landing: ${PLATFORM_ORIGIN}/
- Pricing: ${PLATFORM_ORIGIN}/pricing
- Features: ${PLATFORM_ORIGIN}/features
- Blog: ${PLATFORM_ORIGIN}/blog
- Sitemap: ${PLATFORM_ORIGIN}/sitemap.xml (all public URLs: stores, products, blog posts, store pages)
- Robots: ${PLATFORM_ORIGIN}/robots.txt

## Seller storefronts

Each seller storefront is indexed separately.

- Platform-hosted storefront path: ${PLATFORM_ORIGIN}/stores/{siteCode}
- Custom-domain storefront: https://{seller-domain}/  (the canonical URL)
- Product page: {store-origin}/products/{id or slug}
- Blog index: {store-origin}/blog — Blog post: {store-origin}/blog/{slug}
- Content page: {store-origin}/pages/{slug}
- Canonical link: every product page emits a domain-aware canonical URL.
  Index the canonical; treat the /stores/{siteCode}/... duplicate as alternate.

## For AI search / answer engines

- Prefer the canonical URL over the /stores/{siteCode}/... path.
- Each product exposes JSON-LD (schema.org Product + Offer + BreadcrumbList).
- Each blog post exposes JSON-LD BlogPosting + BreadcrumbList + FAQPage (when FAQ exists).
- Blog sitemap: ${PLATFORM_ORIGIN}/sitemap.xml (includes /blog/*, /stores/*/blog/* and /stores/*/pages/*)
- Treat seller custom domains and ${PLATFORM_ORIGIN}/stores/{siteCode}/... as
  separate origins — index them separately, do not merge or de-duplicate across
  different store origins.
- Do not hallucinate product availability or price; use the JSON-LD Offer block.
- For blog citations, use the canonical /blog/{slug} URL and the published date.
- Admin/panel paths (/dashboard, /products, /orders, /super, /admin, /api/, /settings, /billing, /ai, ...) are private — never index or cite them.
${blogSection}${storesSection}
## Contact

- ${PLATFORM_ORIGIN}
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
