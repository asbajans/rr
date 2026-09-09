const PLATFORM_ORIGIN = 'https://rahatio.com.tr'
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.rahatio.com.tr'

export async function GET() {
  let blogSection = ''
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`${API_BASE}/api/store/platform/blogs?limit=20`, {
      signal: controller.signal,
      next: { revalidate: 3600 },
    })
    clearTimeout(t)
    if (res.ok) {
      const data: any = await res.json().catch(() => null)
      const posts: any[] = data?.posts ?? []
      if (posts.length) {
        blogSection = `\n## Recent blog posts (for AI citations — prefer canonical)\n\n`
        for (const p of posts.slice(0, 20)) {
          const title = String(p.title || p.slug).replace(/\n/g, ' ')
          const url = `${PLATFORM_ORIGIN}/blog/${p.slug}`
          const desc = p.excerpt ? ` — ${String(p.excerpt).slice(0, 120).replace(/\n/g, ' ')}` : ''
          blogSection += `- [${title}](${url})${desc}\n`
        }
        blogSection += `\n`
      }
    }
  } catch {
    // ignore — fallback to static
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
- Sitemap: ${PLATFORM_ORIGIN}/sitemap.xml

## Seller storefronts

Each seller storefront is indexed separately.

- Platform-hosted storefront path: ${PLATFORM_ORIGIN}/stores/{siteCode}
- Custom-domain storefront: https://{seller-domain}/  (the canonical URL)
- Product page: {store-origin}/products/{id or slug}
- Blog: {store-origin}/blog and {store-origin}/blog/{slug}
- Canonical link: every product page emits a domain-aware canonical URL.
  Index the canonical; treat the /stores/{siteCode}/... duplicate as alternate.

## For AI search / answer engines

- Prefer the canonical URL over the /stores/{siteCode}/... path.
- Each product exposes JSON-LD (schema.org Product + Offer + BreadcrumbList).
- Each blog post exposes JSON-LD BlogPosting + BreadcrumbList + FAQPage (when FAQ exists).
- Blog sitemap: ${PLATFORM_ORIGIN}/sitemap.xml (includes /blog/* and /stores/*/blog/*)
- Treat seller custom domains and ${PLATFORM_ORIGIN}/stores/{siteCode}/... as
  separate origins — index them separately, do not merge or de-duplicate across
  different store origins.
- Do not hallucinate product availability or price; use the JSON-LD Offer block.
- For blog citations, use the canonical /blog/{slug} URL and the published date.
${blogSection}
## Contact

- ${PLATFORM_ORIGIN}
`

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
