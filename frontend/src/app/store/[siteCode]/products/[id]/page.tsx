'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Minus, Sparkles } from 'lucide-react'
import { api } from '@/lib/api-client'
import { useCart } from '@/lib/cart'
import type { StoreProduct } from '@/lib/types'

export default function StoreProductDetailPage() {
  const { siteCode, id } = useParams<{ siteCode: string; id: string }>()
  const router = useRouter()
  const { addItem } = useCart()
  const [product, setProduct] = useState<StoreProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (!siteCode || !id) return
    api.getStoreProduct(siteCode, id)
      .then(setProduct)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [siteCode, id])

  function handleAddToCart() {
    if (!product) return
    addItem({
      product_id: product['product.id'],
      sku: product['product.code'],
      name: product['product.label'],
      price: product.price ?? 0,
      image: product.image ?? undefined,
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
        <Link href={`/store/${siteCode}`} className="mt-4 inline-block text-sm text-zinc-500 hover:text-zinc-900">
          Mağazaya Dön
        </Link>
      </div>
    )
  }

  const [recommendations, setRecommendations] = useState<StoreProduct[]>([])
  const [loadingRecs, setLoadingRecs] = useState(false)

  useEffect(() => {
    if (!product || !siteCode) return
    // Fetch all products for AI recommendations
    api.getStoreFront(siteCode).then(r => {
      const allProducts = r.products || []
      if (allProducts.length > 1) {
        setLoadingRecs(true)
        api.aiRecommend(product, allProducts, 'similar')
          .then(res => setRecommendations(res.results.slice(0, 4)))
          .catch(() => {})
          .finally(() => setLoadingRecs(false))
      }
    }).catch(() => {})
  }, [product, siteCode])

  if (!product) return null

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href={`/store/${siteCode}`} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" /> Mağazaya Dön
      </Link>

      <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-xl bg-zinc-100">
          {product.image ? (
            <img src={product.image} alt={product['product.label']} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-300">
              <svg className="h-24 w-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
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
            <div className="mt-6 text-sm leading-relaxed text-zinc-600">{product.description}</div>
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
                  : 'bg-zinc-900 text-white hover:bg-zinc-800'
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
                image: product.image ?? undefined,
                quantity,
              })
              router.push(`/store/${siteCode}/cart`)
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
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {recommendations.map((p: any) => (
                <Link key={p['product.id']} href={`/store/${siteCode}/products/${p['product.id']}`}
                  className="group rounded-xl border border-zinc-200 p-3 transition-colors hover:border-zinc-300">
                  <div className="aspect-square overflow-hidden rounded-lg bg-zinc-100">
                    {p.image ? (
                      <img src={p.image} alt={p['product.label']} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
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
    </div>
  )
}
