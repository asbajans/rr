'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { api } from '@/lib/api-client'
import { storeBase } from '@/lib/store-path'
import type { StoreProduct, StoreHomepage } from '@/lib/types'
import StoreHero from '@/components/store/StoreHero'

function toStoreProduct(p: any): StoreProduct {
  const images = Array.isArray(p.images) ? p.images : p.images ?? []
  const allImages: string[] = images
    .map((img: any) => typeof img === 'string' ? img : img?.url ?? img?.src ?? null)
    .filter(Boolean)
  const firstImage = allImages.length > 0 ? allImages[0] : null
  return {
    'product.id': String(p.id ?? p['product.id'] ?? ''),
    'product.code': p.sku ?? p.code ?? '',
    'product.label': p.title ?? p.label ?? '',
    'product.status': p.isActive ?? (p.status ?? 1),
    price: p.price ?? p.priceTRY ?? null,
    currency: p.price_currency ?? (p.priceTRY != null ? 'TRY' : p.priceUSD != null ? 'USD' : 'TRY'),
    image: firstImage,
    images: allImages,
    description: p.description ?? null,
    tags: p.tags ?? null,
    attributes: p.attributes ?? null,
  }
}

export default function StoreFrontPage() {
  const { siteCode } = useParams<{ siteCode: string }>()
  const pageSize = 24
  const [storeName, setStoreName] = useState('')
  const [homepage, setHomepage] = useState<StoreHomepage | null>(null)
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const searchRef = useRef('')
  const reqId = useRef(0)

  const fetchProducts = useCallback(async (pageNum: number, q: string, append: boolean) => {
    const current = ++reqId.current
    try {
      const res = await api.getStoreProducts(siteCode, { page: pageNum, limit: pageSize, search: q || undefined })
      if (current !== reqId.current) return
      setProducts(prev => append ? [...prev, ...res.data.map(toStoreProduct)] : res.data.map(toStoreProduct))
      setPage(res.current_page)
      setTotal(res.total)
    } catch (err: any) {
      if (current !== reqId.current) return
      if (!append) setError(err.message)
    } finally {
      if (current === reqId.current) {
        setLoading(false)
        setLoadingMore(false)
        setSearching(false)
      }
    }
  }, [siteCode])

  useEffect(() => {
    api.getStoreFront(siteCode)
      .then(r => {
        setStoreName(r.store?.name ?? '')
        setHomepage(r.store?.homepage ?? null)
      })
      .catch(() => {})
    setLoading(true)
    fetchProducts(1, '', false)
  }, [siteCode, fetchProducts])

  useEffect(() => {
    if (!products.length) return
    const totalPages = Math.ceil(total / pageSize)
    if (page >= totalPages) return
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 400) {
        if (!loadingMore && !searching) {
          setLoadingMore(true)
          const next = page + 1
          setPage(next)
          fetchProducts(next, searchRef.current, true)
        }
      }
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [products.length, total, page, loadingMore, searching, fetchProducts])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = searchQuery.trim()
    searchRef.current = q
    reqId.current++
    setSearching(true)
    setLoading(true)
    setPage(1)
    fetchProducts(1, q, false)
  }

  function clearSearch() {
    setSearchQuery('')
    searchRef.current = ''
    reqId.current++
    setLoading(true)
    setPage(1)
    fetchProducts(1, '', false)
  }

  if (loading && products.length === 0) {
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
        <Link href="/" className="mt-4 inline-block text-sm text-zinc-500 hover:text-zinc-900">Ana Sayfaya Dön</Link>
      </div>
    )
  }

  return (
    <div>
      <StoreHero homepage={homepage} siteCode={siteCode} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">{storeName}</h1>
        </div>

      <form onSubmit={handleSearch} className="relative mb-4">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
        <input
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Ürün ara: 'kafa lambası', 'elektronik aksesuar'..."
          className="w-full rounded-xl border border-zinc-300 py-3 pl-12 pr-4 text-sm focus:border-zinc-900 focus:outline-none"
        />
        {searchQuery && (
          <button type="button" onClick={clearSearch} className="absolute right-20 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            <X className="h-4 w-4" />
          </button>
        )}
        <button type="submit" disabled={searching || !searchQuery.trim()}
          className="sf-btn-primary absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
          {searching ? 'Aranıyor...' : 'Ara'}
        </button>
      </form>

      <p className="mb-6 text-xs text-zinc-400">{total} ürün</p>

      {products.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-zinc-500">{searchQuery ? 'Aramanızla eşleşen ürün bulunamadı.' : 'Henüz ürün bulunmuyor.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <Link
              key={product['product.id']}
              href={`${storeBase(siteCode)}/products/${product['product.id']}`}
              className="group rounded-xl border border-zinc-200 p-4 transition hover:border-zinc-300 hover:shadow-sm"
            >
              <div className="aspect-square overflow-hidden rounded-lg bg-zinc-100">
                {product.image ? (
                  <img src={product.image} alt={product['product.label']} className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-300">
                    <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
              <h3 className="mt-3 font-medium text-zinc-900 group-hover:text-zinc-600">
                {product['product.label']}
              </h3>
              {product.price !== null && (
                <p className="mt-1 text-sm text-zinc-500">
                  {product.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {product.currency ?? 'TRY'}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {(loadingMore || searching) && (
        <div className="py-8 text-center text-sm text-zinc-400">Yükleniyor...</div>
      )}
      {!loadingMore && !searching && products.length > 0 && Math.ceil(total / pageSize) > page && (
        <div className="py-8 text-center text-sm text-zinc-400">Aşağı kaydırın daha fazla ürün yüklensin...</div>
      )}
      </div>
    </div>
  )
}