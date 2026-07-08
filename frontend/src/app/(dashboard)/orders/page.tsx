'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  returned: 'bg-orange-100 text-orange-700',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Beklemede',
  processing: 'Hazırlanıyor',
  shipped: 'Kargoda',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal Edildi',
  returned: 'İade Edildi',
}

interface DropshippingOrder {
  id: number
  external_id: string
  marketplace: string
  status: string
  customer_name: string
  customer_email: string
  grand_total: string
  currency: string
  created_at: string
}

export default function OrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<DropshippingOrder[]>([])
  const [stats, setStats] = useState<{ status: string; label: string; color: string; count: number }[]>([])
  const [activeFilter, setActiveFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      api.getDropshippingOrders({ status: activeFilter || undefined }).then(r => setOrders(r.data)).catch(() => {}),
      api.getOrderStats().then(r => setStats(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [user, activeFilter])

  if (!user) return null

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Siparişler</h1>
      <p className="mt-1 text-sm text-zinc-600">Tüm siparişlerini görüntüle ve yönet.</p>

      {/* Stats */}
      {stats.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-6">
          {stats.map(s => (
            <button key={s.status} onClick={() => setActiveFilter(activeFilter === s.status ? '' : s.status)}
              className={`rounded-xl border p-3 text-left transition-colors ${activeFilter === s.status ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'}`}>
              <p className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${s.color}`}>{s.label}</p>
              <p className="mt-1 text-lg font-bold text-zinc-900">{s.count}</p>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Sipariş No</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Müşteri</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Pazaryeri</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Tutar</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <Link href={`/orders/${o.id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                      {o.external_id || `#${o.id}`}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-700">{o.customer_name}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">{o.marketplace}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[o.status] || 'bg-zinc-100 text-zinc-700'}`}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-zinc-900">
                    {parseFloat(o.grand_total).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {o.currency}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">
                    {new Date(o.created_at).toLocaleDateString('tr-TR')}
                  </td>
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
