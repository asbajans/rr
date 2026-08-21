import type { Metadata } from 'next'
import ProductDetailClient from './ProductDetailClient'
import { canonicalForProduct, seoTitleFor, seoDescriptionFor, stripHtml } from '@/lib/store-seo'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.rahatio.com.tr'

type ProductRow = {
  id: number
  title?: string
  slug?: string | null
  description?: string | null
  seoTitle?: string | null
  seo_title?: string | null
  seoDescription?: string | null
  seo_description?: string | null
  images?: unknown
  image?: string | null
  priceTRY?: number | null
  priceUSD?: number | null
  price?: number | null
  quantity?: number | null
  stock?: number | null
  tags?: string[] | null
  brand?: string | null
  category?: { name?: string } | null
  sku?: string
  'product.label'?: string
}

type StoreRow = {
  name?: string
  domain?: string | null
  siteUrl?: string | null
  site_code?: string
  siteCode?: string
}

async function fetchStoreProduct(siteCode: string, id: string): Promise<{ product: ProductRow | null; store: StoreRow | null }> {
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 5000)
    const [prodRes, storeRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/store/${encodeURIComponent(siteCode)}/products/${encodeURIComponent(id)}`, {
        signal: controller.signal,
        next: { revalidate: 60 },
      }),
      fetch(`${API_BASE}/api/store/${encodeURIComponent(siteCode)}`, {
        signal: controller.signal,
        next: { revalidate: 60 },
      }),
    ])
    clearTimeout(t)

    let product: ProductRow | null = null
    let store: StoreRow | null = null

    if (prodRes.status === 'fulfilled' && prodRes.value.ok) {
      const j: any = await prodRes.value.json().catch(() => null)
      product = j?.product ?? j ?? null
    }
    if (storeRes.status === 'fulfilled' && storeRes.value.ok) {
      const j: any = await storeRes.value.json().catch(() => null)
      const s = j?.store ?? j ?? null
      if (s) store = s as StoreRow
    }
    return { product, store }
  } catch {
    return { product: null, store: null }
  }
}

function mapStoreProduct(p: ProductRow): any {
  if (!p) return null
  const imagesRaw: unknown[] = Array.isArray((p as any).images) ? (p as any).images : []
  const images: string[] = imagesRaw
    .map((img: unknown) => (typeof img === 'string' ? img : (img as any)?.url ?? (img as any)?.src ?? null))
    .filter(Boolean) as string[]
  const firstImage = images[0] ?? (p as any).image ?? null
  const label = (p as any).title ?? (p as any)['product.label'] ?? ''
  const price = (p as any).priceTRY ?? (p as any).priceUSD ?? (p as any).price ?? null
  const currency = (p as any).priceTRY != null ? 'TRY' : (p as any).priceUSD != null ? 'USD' : 'TRY'
  return {
    'product.id': String((p as any).id ?? (p as any)['product.id'] ?? ''),
    'product.code': (p as any).sku ?? (p as any).code ?? '',
    'product.label': label,
    'product.status': (p as any).isActive !== undefined ? ((p as any).isActive ? 1 : 0) : 1,
    price,
    currency,
    image: firstImage,
    images,
    description: (p as any).description ?? null,
    tags: (p as any).tags ?? null,
    attributes: (p as any).attributes ?? null,
    seo_title: (p as any).seoTitle ?? (p as any).seo_title ?? null,
    seo_description: (p as any).seoDescription ?? (p as any).seo_description ?? null,
    slug: (p as any).slug ?? null,
    brand: (p as any).brand ?? null,
    category: (p as any).category ?? null,
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ siteCode: string; id: string }> }
): Promise<Metadata> {
  const { siteCode, id } = await params
  const { product: raw, store } = await fetchStoreProduct(siteCode, id)
  if (!raw) return {}

  const pTitle = String((raw as any).title ?? (raw as any)['product.label'] ?? '')
  const fallbackTitle = pTitle || 'Ürün'
  const title = seoTitleFor(raw as any) || fallbackTitle
  const desc = seoDescriptionFor(raw as any) || stripHtml((raw as any).description ?? '').slice(0, 160)
  const canonical = canonicalForProduct(store as any, siteCode, raw as any)
  const rawImages: unknown[] = Array.isArray((raw as any).images) ? (raw as any).images : []
  const ogImage = rawImages.length
    ? (typeof rawImages[0] === 'string' ? String(rawImages[0]) : ((rawImages[0] as any)?.url ?? null))
    : ((raw as any).image ?? null)
  const storeName = (store as any)?.name ?? siteCode

  return {
    title: `${title} | ${storeName}`,
    description: desc || undefined,
    alternates: { canonical },
    openGraph: {
      title: `${title} | ${storeName}`,
      description: desc || undefined,
      url: canonical,
      siteName: storeName,
      type: 'website',
      images: ogImage ? [{ url: ogImage, alt: title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${storeName}`,
      description: desc || undefined,
      images: ogImage ? [ogImage] : undefined,
    },
    robots: { index: true, follow: true },
  }
}

export default async function StoreProductDetailPage(
  { params }: { params: Promise<{ siteCode: string; id: string }> }
) {
  const { siteCode, id } = await params
  const { product: raw, store } = await fetchStoreProduct(siteCode, id)

  const initialProduct = raw ? mapStoreProduct(raw) : null
  const canonical = raw ? canonicalForProduct(store as any, siteCode, raw as any) : null
  const pAny: any = raw as any
  const title = raw ? (seoTitleFor(raw as any) || pAny?.title || pAny?.['product.label'] || '') : ''
  const desc = raw ? (seoDescriptionFor(raw as any) || stripHtml(pAny?.description ?? '').slice(0, 160)) : ''
  const ogImg: string | null = (() => {
    if (!raw) return null
    const arr: unknown[] = Array.isArray((pAny as any).images) ? (pAny as any).images : []
    if (arr.length) return typeof arr[0] === 'string' ? String(arr[0]) : ((arr[0] as any)?.url ?? null)
    return (pAny as any).image ?? null
  })()
  const price = raw ? ((pAny.priceTRY ?? pAny.priceUSD ?? pAny.price) ?? null) : null
  const currency = raw ? ((pAny.priceTRY != null ? 'TRY' : pAny.priceUSD != null ? 'USD' : 'TRY') as string) : 'TRY'
  const stockVal = raw ? (pAny.quantity ?? pAny.stock ?? null) : null
  const inStock = stockVal == null || Number(stockVal) > 0
  const storeName = (store as any)?.name ?? siteCode

  const jsonLdProduct = raw ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    description: desc || undefined,
    image: ogImg || undefined,
    sku: pAny?.sku ?? pAny?.['product.code'] ?? undefined,
    brand: pAny?.brand ? { '@type': 'Brand', name: String(pAny.brand) } : undefined,
    offers: price != null ? {
      '@type': 'Offer',
      price: String(price),
      priceCurrency: currency,
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: canonical ?? undefined,
      seller: storeName ? { '@type': 'Organization', name: storeName } : undefined,
    } : undefined,
  } : null

  const jsonLdBreadcrumb = raw ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: storeName, item: store ? canonical?.replace(/\/products\/[^/]+$/, '') ?? canonical ?? undefined : undefined },
      { '@type': 'ListItem', position: 2, name: title, item: canonical ?? undefined },
    ],
  } : null

  return (
    <>
      {canonical && <link rel="canonical" href={canonical} />}
      {jsonLdProduct && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdProduct) }} />}
      {jsonLdBreadcrumb && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />}
      <ProductDetailClient siteCode={siteCode} productId={id} initialProduct={initialProduct as any} />
    </>
  )
}
