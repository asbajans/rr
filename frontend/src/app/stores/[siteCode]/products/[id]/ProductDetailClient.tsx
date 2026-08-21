'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Minus, Sparkles, ZoomIn, Tag } from 'lucide-react'
import { api } from '@/lib/api-client'
import { useCart } from '@/lib/cart'
import { storeBase } from '@/lib/store-path'
import type { StoreProduct } from '@/lib/types'

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
}

export default function ProductDetailClient({
  siteCode,
  productId,
  initialProduct,
}: {
  siteCode: string
  productId: string
  initialProduct?: StoreProduct | null
}) {
  const router = useRouter()
  const { addItem } = useCart()
  const [product, setProduct] = useState<StoreProduct | null>(initialProduct ?? null)
  const [loading, setLoading] = useState(!initialProduct)
  const [error, setError] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [recommendations, setRecommendations] = useState<StoreProduct[]>([])
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [selectedImage, setSelectedImage] = useState(0)
  const [zoomImage, setZoomImage] = useState<string | null>(null)

  useEffect(() => {
    if (initialProduct) return
    if (!siteCode || !productId) return
    api.getStoreProduct(siteCode, productId)
      .then((p) => setProduct(p as any))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [siteCode, productId, initialProduct])

  useEffect(() => {
    if (!product || !siteCode) return
    setLoadingRecs(true)
    api.getStoreFront(siteCode)
      .then(r => {
        const allProducts = r.products || []
        if (allProducts.length > 1) {
          setRecommendations(findSimilarProducts(product, allProducts))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingRecs(false))
  }, [product, siteCode])

  // Client-side title/meta as fallback (server generateMetadata covers crawlers; this keeps the tab title live on client nav)
  useEffect(() => {
    if (!product) return
    const p: any = product
    const seoTitle = (p.seo_title ?? p.seoTitle ?? '').trim() || p['product.label'] || ''
    const seoDescRaw = (p.seo_description ?? p.seoDescription ?? '').trim()
    const plainDesc = (() => {
      if (seoDescRaw) return seoDescRaw
      const raw = p.description ?? ''
      return raw
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160)
    })()
    if (seoTitle) document.title = `${seoTitle} — ${p['product.label'] ? '' : ''}`.trim() || seoTitle
    const upsertMeta = (attr: string, key: string, content: string) => {
      if (!content) return
      let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }
    if (plainDesc) upsertMeta('name', 'description', plainDesc)
  }, [product])

  function findSimilarProducts(target: StoreProduct, products: StoreProduct[], limit = 4): StoreProduct[] {
    const words = String(target['product.label'] || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
    if (words.length === 0) return []
    return products
      .filter(p => p['product.id'] !== target['product.id'])
      .map(p => {
        const label = String(p['product.label'] || '').toLowerCase()
        const score = words.reduce((acc, w) => acc + (label.includes(w) ? 1 : 0), 0)
        return { p, score }
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => x.p)
  }

  const allImages: string[] = product?.images?.length
    ? product.images
    : product?.image
    ? [product.image]
    : []

  function handleAddToCart() {
    if (!product) return
    addItem({
      product_id: product['product.id'],
      sku: product['product.code'],
      name: product['product.label'],
      price: product.price ?? 0,
      image: allImages[0] ?? undefined,
      quantity,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-sm text-zinc-500">Yükleniyor...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-sm text-red-600">{error}</p>
        <Link href={storeBase(siteCode)} className="mt-4 inline-block text-sm text-zinc-500 hover:text-zinc-900">
          Mağazaya Dön
        </Link>
      </div>
    )
  }

  if (!product) return null

  // JSON-LD is emitted by the server wrapper; keep a lightweight client LD for SPA nav parity
  const pAny: any = product
  const seoTitle = (pAny.seo_title ?? pAny.seoTitle ?? '').trim() || pAny['product.label'] || ''
  const seoDescRaw = (pAny.seo_description ?? pAny.seoDescription ?? '').trim()
  const plainDescForLd = seoDescRaw || (pAny.description ? pAny.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) : '')
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: seoTitle,
    description: plainDescForLd || undefined,
    image: allImages[0] || undefined,
    sku: pAny['product.code'] || undefined,
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href={storeBase(siteCode)} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" /> Mağazaya Dön
      </Link>

      <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-2">
        <div>
          <div
            className="group relative aspect-square overflow-hidden rounded-xl bg-zinc-100 cursor-zoom-in"
            onClick={() => allImages[selectedImage] && setZoomImage(allImages[selectedImage])}
          >
            {allImages[selectedImage] ? (
              <img src={allImages[selectedImage]} alt={product['product.label']}
                className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-300">
                <svg className="h-24 w-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="h-3 w-3" /> Tam Boyut
            </div>
          </div>

          {allImages.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {allImages.map((img, idx) => (
                <button key={idx} onClick={() => setSelectedImage(idx)}
                  className={`flex-shrink-0 h-16 w-16 overflow-hidden rounded-lg border-2 transition-colors ${
                    idx === selectedImage ? 'border-zinc-900' : 'border-zinc-200 hover:border-zinc-400'
                  }`}>
                  <img src={img} alt={`Görsel ${idx + 1}`} className="h-full w-full object-contain bg-zinc-50" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-3xl font-bold text-zinc-900">{product['product.label']}</h1>
          {product.price !== null && (
            <p className="mt-4 text-2xl font-semibold text-zinc-900">
              {product.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {product.currency ?? 'TRY'}
            </p>
          )}
          {product.description && (
            <div className="mt-6 text-sm leading-relaxed text-zinc-600 prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }} />
          )}
          {pAny.tags && pAny.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {pAny.tags.map((tag: string, i: number) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600">
                  <Tag className="h-3 w-3" /> {tag}
                </span>
              ))}
            </div>
          )}
          {pAny.attributes && Object.keys(pAny.attributes).length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-zinc-900 mb-2">Ürün Özellikleri</h3>
              <div className="rounded-lg border border-zinc-200 divide-y divide-zinc-100">
                {Object.entries(pAny.attributes).map(([key, value]) => (
                  <div key={key} className="flex justify-between px-3 py-2 text-xs">
                    <span className="text-zinc-500">{key}</span>
                    <span className="text-zinc-900 font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 text-xs text-zinc-400">SKU: {product['product.code']}</div>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center rounded-lg border border-zinc-300">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2 text-zinc-500 hover:text-zinc-900">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-12 text-center text-sm font-medium">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="p-2 text-zinc-500 hover:text-zinc-900">
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              className={`flex-1 rounded-lg px-6 py-3 text-sm font-medium transition-colors ${
                added
                  ? 'bg-green-500 text-white'
                  : 'sf-btn-primary text-white hover:bg-zinc-800'
              }`}
            >
              {added ? 'Sepete Eklendi ✓' : 'Sepete Ekle'}
            </button>
          </div>

          <button
            onClick={() => {
              addItem({
                product_id: product['product.id'],
                sku: product['product.code'],
                name: product['product.label'],
                price: product.price ?? 0,
                image: allImages[0] ?? undefined,
                quantity,
              })
              router.push(`${storeBase(siteCode)}/cart`)
            }}
            className="mt-2 w-full rounded-lg border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Hemen Al
          </button>
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="mt-16">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-zinc-400" />
            <h2 className="text-lg font-semibold text-zinc-900">Benzer Ürünler</h2>
            {loadingRecs && <span className="text-xs text-zinc-400">Yükleniyor...</span>}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {recommendations.map((p: any) => (
              <Link key={p['product.id']} href={`${storeBase(siteCode)}/products/${p['product.id']}`}
                className="group rounded-xl border border-zinc-200 p-3 transition-colors hover:border-zinc-300">
                <div className="aspect-square overflow-hidden rounded-lg bg-zinc-100">
                  {p.image ? (
                    <img src={p.image} alt={p['product.label']} className="h-full w-full object-contain transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-200">
                      <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <h3 className="mt-2 text-sm font-medium text-zinc-900 truncate">{p['product.label']}</h3>
                {p.price !== null && (
                  <p className="text-sm font-semibold text-zinc-900">{p.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {p.currency ?? 'TRY'}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {zoomImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-zoom-out"
          onClick={() => setZoomImage(null)}>
          <img src={zoomImage} alt="Tam boyut"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg" />
          <button onClick={() => setZoomImage(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl font-bold">&times;</button>
        </div>
      )}
    </div>
  )
}
