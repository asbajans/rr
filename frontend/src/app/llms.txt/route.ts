const PLATFORM_ORIGIN = 'https://rahatio.com.tr'

export async function GET() {
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
- Treat seller custom domains and ${PLATFORM_ORIGIN}/stores/{siteCode}/... as
  separate origins — index them separately, do not merge or de-duplicate across
  different store origins.
- Do not hallucinate product availability or price; use the JSON-LD Offer block.

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
