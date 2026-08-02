'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Search, Sparkles, X } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { StoreFrontData, StoreProduct } from '@/lib/types'

export default function StoreFrontPage() {
  const { siteCode } = useParams<{ siteCode: string }>()
  const [data, setData] = useState<StoreFrontData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<StoreProduct[] | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!siteCode) return
    api.getStoreFront(siteCode)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [siteCode])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim() || !data?.products) return
    setSearching(true)
    try {
      const res = await api.aiSearch(searchQuery, data.products)
      setSearchResults(res.results)
    } catch {
      // Fallback to basic filter
      const q = searchQuery.toLowerCase()
      setSearchResults(data.products.filter(p =>
        p['product.label'].toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      ))
    } finally {
      setSearching(false)
    }
  }

  function clearSearch() {
    setSearchQuery('')
    setSearchResults(null)
  }

  const products = searchResults ?? data?.products ?? []
  const storeName = data?.store?.name ?? ''
  const isSearching = searchResults !== null

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
        <Link href="/" className="mt-4 inline-block text-sm text-zinc-500 hover:text-zinc-900">Ana Sayfaya Dön</Link>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900">{storeName}</h1>
      </div>

      {/* AI Search */}
      <form onSubmit={handleSearch} className="relative mb-8">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
        <input
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="AI ile ara: 'siyah elbise', 'elektronik aksesuar'..."
          className="w-full rounded-xl border border-zinc-300 py-3 pl-12 pr-4 text-sm focus:border-zinc-900 focus:outline-none"
        />
        {searchQuery && (
          <button type="button" onClick={clearSearch} className="absolute right-20 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            <X className="h-4 w-4" />
          </button>
        )}
        <button type="submit" disabled={searching || !searchQuery.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
          {searching ? 'Aranıyor...' : 'Ara'}
        </button>
      </form>

      {isSearching && (
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-zinc-400" />
          <p className="text-sm text-zinc-500">
            AI ile arama sonuçları ({products.length} ürün)
          </p>
          <button onClick={clearSearch} className="text-xs text-indigo-600 hover:text-indigo-500">Temizle</button>
        </div>
      )}

      {products.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-zinc-500">{isSearching ? 'Aramanızla eşleşen ürün bulunamadı.' : 'Henüz ürün bulunmuyor.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <Link
              key={product['product.id']}
              href={`/store/${siteCode}/products/${product['product.id']}`}
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
    </div>
  )
}
