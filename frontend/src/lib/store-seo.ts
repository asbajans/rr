import type { StoreProduct } from './types'

const PLATFORM_HOST = 'rahatio.com.tr'

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function seoTitleFor(product: StoreProduct | { label?: string; seo_title?: string | null; seoTitle?: string | null; title?: string | null }): string {
  const p: any = product as any
  const seo = String(p.seo_title ?? p.seoTitle ?? '').trim()
  if (seo) return seo
  return String(p.label ?? p['product.label'] ?? p.title ?? '').trim()
}

export function seoDescriptionFor(
  product: StoreProduct | { description?: string | null; seo_description?: string | null; seoDescription?: string | null }
): string {
  const p: any = product as any
  const seo = String(p.seo_description ?? p.seoDescription ?? '').trim()
  if (seo) return seo
  const raw = String(p.description ?? p['product.description'] ?? '') as string
  const plain = stripHtml(raw)
  return plain.slice(0, 160)
}

function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null
  let d = domain.trim().toLowerCase()
  if (!d) return null
  d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')
  if (!d || d === PLATFORM_HOST || d.endsWith('.' + PLATFORM_HOST)) return null
  if (d === 'localhost' || d.endsWith('.localhost')) return null
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(d)) return null
  return d
}

export function storeOrigin(store: { domain?: string | null; siteUrl?: string | null; site_code?: string; siteCode?: string } | null | undefined): string {
  const d = normalizeDomain(store?.domain ?? (store as any)?.siteUrl ?? null)
  if (d) return `https://${d}`
  return `https://${PLATFORM_HOST}`
}

export function canonicalForProduct(
  store: { domain?: string | null; siteUrl?: string | null; site_code?: string; siteCode?: string } | null,
  siteCode: string,
  product: { id?: string | number; slug?: string | null }
): string {
  const origin = storeOrigin(store)
  const slug = product.slug ? String(product.slug) : String(product.id ?? '')
  const code = store?.site_code ?? store?.siteCode ?? siteCode
  const basePath = normalizeDomain(store?.domain ?? (store as any)?.siteUrl ?? null)
    ? `/products/${slug}`
    : `/stores/${code}/products/${slug}`
  return `${origin}${basePath}`
}

export function canonicalForStore(
  store: { domain?: string | null; siteUrl?: string | null; site_code?: string; siteCode?: string } | null,
  siteCode: string,
  path: string = ''
): string {
  const origin = storeOrigin(store)
  const code = store?.site_code ?? store?.siteCode ?? siteCode
  const hasCustomDomain = !!normalizeDomain(store?.domain ?? (store as any)?.siteUrl ?? null)
  const base = hasCustomDomain ? '' : `/stores/${code}`
  const clean = path ? `/${path.replace(/^\/+/, '')}` : ''
  return `${origin}${base}${clean}`
}

export function productJsonLd(
  product: StoreProduct & { price?: number | null; currency?: string | null; quantity?: number | null; stock?: number | null },
  store: { name?: string; domain?: string | null; siteUrl?: string | null; site_code?: string; siteCode?: string } | null,
  siteCode: string,
  canonical: string
): Record<string, unknown> {
  const images: string[] = Array.isArray((product as any).images) ? (product as any).images : []
  const firstImage = (product as any).image || images[0] || null
  const price = (product as any).price ?? null
  const currency = (product as any).currency ?? 'TRY'
  const stockVal = (product as any).quantity ?? (product as any).stock ?? null
  const inStock = stockVal == null || Number(stockVal) > 0
  const desc = seoDescriptionFor(product as any)
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: seoTitleFor(product as any),
    description: desc || undefined,
    image: firstImage || undefined,
    sku: (product as any)['product.code'] || undefined,
    brand: (product as any).brand ? { '@type': 'Brand', name: (product as any).brand } : undefined,
    offers: price != null ? {
      '@type': 'Offer',
      price: String(price),
      priceCurrency: currency,
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: canonical,
      seller: store?.name ? { '@type': 'Organization', name: store.name } : undefined,
    } : undefined,
  }
}
