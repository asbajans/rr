'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { Order } from '@/lib/types'

export default function OrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getAdminOrders()
      .then((res) => setOrders(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (!user) return null

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Siparişler</h1>
      <p className="mt-1 text-sm text-zinc-600">Tüm siparişlerini görüntüle ve yönet.</p>
      {loading && <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>}
      {error && <p className="mt-8 text-sm text-red-600">{error}</p>}
      {!loading && !error && (
        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <Link href={`/orders/${o.id}`} className="font-medium text-indigo-600 hover:text-indigo-500">{o.id}</Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">{String(o.status ?? '-')}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">{String(o.ctime ?? '-')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <div className="p-12 text-center text-sm text-zinc-500">Henüz sipariş bulunmuyor.</div>
          )}
        </div>
      )}
    </div>
  )
}
