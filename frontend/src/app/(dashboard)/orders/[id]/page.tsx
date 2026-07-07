'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import { ArrowLeft } from 'lucide-react'

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    api.getAdminOrder(id)
      .then(setOrder)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <div>
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" /> Siparişlere Dön
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-zinc-900">Sipariş #{id}</h1>
      {loading && <p className="mt-4 text-sm text-zinc-500">Yükleniyor...</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {order && (
        <div className="mt-6 rounded-xl border border-zinc-200">
          <div className="divide-y divide-zinc-200">
            {Object.entries(order).map(([key, value]) => (
              <div key={key} className="flex px-6 py-3 text-sm">
                <span className="w-1/3 font-medium text-zinc-500">{key}</span>
                <span className="w-2/3 text-zinc-900">{String(value ?? '-')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
