'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import type { StoreFrontData } from '@/lib/types'

export default function StoreFrontPage() {
  const { siteCode } = useParams<{ siteCode: string }>()
  const [data, setData] = useState<StoreFrontData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!siteCode) return
    api.getStoreFront(siteCode)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [siteCode])

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
        <h1 className="text-3xl font-bold text-zinc-900">{data.store.name}</h1>
        {data.store.email && (
          <p className="mt-1 text-sm text-zinc-500">{data.store.email}</p>
        )}
      </div>

      {data.products.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-zinc-500">Henüz ürün bulunmuyor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {data.products.map((product) => (
            <Link
              key={product['product.id']}
              href={`/store/${siteCode}/products/${product['product.id']}`}
              className="group rounded-xl border border-zinc-200 p-4 transition hover:border-zinc-300 hover:shadow-sm"
            >
              <div className="aspect-square overflow-hidden rounded-lg bg-zinc-100">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product['product.label']}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
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
