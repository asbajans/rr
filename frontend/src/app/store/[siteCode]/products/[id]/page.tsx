'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { StoreProduct } from '@/lib/types'

export default function StoreProductDetailPage() {
  const { siteCode, id } = useParams<{ siteCode: string; id: string }>()
  const [product, setProduct] = useState<StoreProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!siteCode || !id) return
    api.getStoreProduct(siteCode, id)
      .then(setProduct)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [siteCode, id])

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
        </div>
      </div>
    </div>
  )
}
