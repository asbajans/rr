'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'

const ALL_MARKETPLACES = ['trendyol', 'n11', 'hepsiburada', 'pazarama', 'amazon', 'etsy'] as const
type Marketplace = typeof ALL_MARKETPLACES[number]

const TAB_LABELS: Record<string, string> = {
  '': 'Tüm Siparişler',
  trendyol: 'Trendyol',
  n11: 'N11',
  hepsiburada: 'Hepsiburada',
  pazarama: 'Pazarama',
  amazon: 'Amazon',
  etsy: 'Etsy',
}

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
  const [tab, setTab] = useState<string>('')
  const [activeFilter, setActiveFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    api.getOrders({ marketplace: tab || undefined, status: activeFilter || undefined })
      .then(r => setOrders(r.orders))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, tab, activeFilter, reloadKey])

  if (!user) return null

  const filteredOrders = tab ? orders.filter(o => o.marketplace === tab) : orders

  const doImport = async (marketplace: string) => {
    const maxPages = prompt('Maksimum sayfa sayısı (1-20):', '5')
    if (!maxPages) return
    setImporting(marketplace)
    try {
      const r = await api.importOrders(marketplace, { maxPages: parseInt(maxPages) || 5 })
      alert(`${r.imported} sipariş içe aktarıldı`)
      setReloadKey(k => k + 1)
    } catch (e: any) {
      alert(e.message || 'Hata')
    } finally {
      setImporting(null)
    }
  }

  const doImportAll = async () => {
    const maxPages = prompt('Maksimum sayfa sayısı (1-20):', '3')
    if (!maxPages) return
    setImporting('all')
    try {
      const r = await api.importAllOrders({ maxPages: parseInt(maxPages) || 3 })
      const details = r.results.filter(r => r.imported > 0).map(r => `${r.marketplace}: ${r.imported}`).join(', ')
      alert(`Toplam ${r.imported} sipariş içe aktarıldı${details ? ` (${details})` : ''}`)
      setReloadKey(k => k + 1)
    } catch (e: any) {
      alert(e.message || 'Hata')
    } finally {
      setImporting(null)
    }
  }

  const statsMap = new Map<string, number>()
  filteredOrders.forEach(o => {
    statsMap.set(o.status, (statsMap.get(o.status) || 0) + 1)
  })
  const stats = Array.from(statsMap.entries()).map(([status, count]) => ({
    status,
    label: STATUS_LABELS[status] || status,
    color: STATUS_COLORS[status] || 'bg-zinc-100 text-zinc-700',
    count,
  }))

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Siparişler</h1>
          <p className="mt-1 text-sm text-zinc-600">Tüm siparişlerini görüntüle ve yönet.</p>
        </div>
      </div>

      {/* Marketplace Tabs */}
      <div className="mt-6 flex gap-1 border-b border-zinc-200">
        {Object.entries(TAB_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); setActiveFilter('') }}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Import Bar */}
      <div className="mt-4 flex items-center gap-2">
        {tab ? (
          <button onClick={() => doImport(tab)} disabled={importing === tab}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
            {importing === tab ? 'İçe aktarılıyor...' : `${TAB_LABELS[tab]} Siparişleri İçe Aktar`}
          </button>
        ) : (
          <button onClick={doImportAll} disabled={importing === 'all'}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
            {importing === 'all' ? 'Tüm pazaryerleri içe aktarılıyor...' : 'Tüm Pazaryerlerinden İçe Aktar'}
          </button>
        )}
        {tab && (
          <span className="text-xs text-zinc-400">
            {filteredOrders.length} sipariş
          </span>
        )}
      </div>

      {/* Status Filters */}
      {stats.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
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
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
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
              {filteredOrders.map(o => (
                <tr key={o.id} className="hover:bg-zinc-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <Link href={`/orders/${o.id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                      {o.external_id || `#${o.id}`}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-700">{o.customer_name || '—'}</td>
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
          {filteredOrders.length === 0 && (
            <div className="p-12 text-center text-sm text-zinc-500">Henüz sipariş bulunmuyor.</div>
          )}
        </div>
      )}
    </div>
  )
}
