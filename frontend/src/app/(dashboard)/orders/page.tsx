'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import { TableSkeleton, EmptyState } from '@/components/ui/skeleton'
import { ShoppingCart } from 'lucide-react'

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

interface ImportStatus {
  state: 'importing' | 'success' | 'error'
  marketplace: string
  message: string
  detail?: string
}

export default function OrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<DropshippingOrder[]>([])
  const [tab, setTab] = useState<string>('')
  const [activeFilter, setActiveFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    api.getOrders({ marketplace: tab || undefined, status: activeFilter || undefined, search: search || undefined })
      .then(r => setOrders(r.orders))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, tab, activeFilter, search, reloadKey])

  if (!user) return null

  const filteredOrders = tab ? orders.filter(o => o.marketplace === tab) : orders

  const doImport = async (marketplace: string) => {
    const maxPages = prompt('Maksimum sayfa sayısı (1-20):', '5')
    if (!maxPages) return
    setImporting(marketplace)
    setImportStatus({
      state: 'importing',
      marketplace,
      message: `${TAB_LABELS[marketplace] || marketplace} siparişleri içe aktarılıyor...`,
    })
    try {
      const r = await api.importOrders(marketplace, { maxPages: parseInt(maxPages) || 5 })
      const label = TAB_LABELS[marketplace] || marketplace
      setImportStatus({
        state: 'success',
        marketplace,
        message: `${r.imported} sipariş içe aktarıldı`,
        detail: r.orders.filter((o: any) => o.updated).length > 0
          ? `${r.orders.filter((o: any) => o.updated).length} tanesi güncellendi`
          : undefined,
      })
      setReloadKey(k => k + 1)
    } catch (e: any) {
      setImportStatus({
        state: 'error',
        marketplace,
        message: 'İçe aktarma hatası',
        detail: e?.response?.data?.message || e.message || 'Bilinmeyen hata',
      })
    } finally {
      setImporting(null)
    }
  }

  const doImportAll = async () => {
    const maxPages = prompt('Maksimum sayfa sayısı (1-20):', '3')
    if (!maxPages) return
    setImporting('all')
    setImportStatus({
      state: 'importing',
      marketplace: 'all',
      message: 'Tüm pazaryerlerinden siparişler içe aktarılıyor...',
    })
    try {
      const r = await api.importAllOrders({ maxPages: parseInt(maxPages) || 3 })
      const details = r.results.filter((r: any) => r.imported > 0).map((r: any) => `${TAB_LABELS[r.marketplace] || r.marketplace}: ${r.imported}`).join(', ')
      const failed = r.results.filter((r: any) => r.error)
      let detail = details ? `(${details})` : undefined
      if (failed.length > 0) {
        detail = (detail ? detail + ' ' : '') + `Başarısız: ${failed.map((r: any) => TAB_LABELS[r.marketplace] || r.marketplace).join(', ')}`
      }
      setImportStatus({
        state: 'success',
        marketplace: 'all',
        message: `Toplam ${r.imported} sipariş içe aktarıldı`,
        detail,
      })
      setReloadKey(k => k + 1)
    } catch (e: any) {
      setImportStatus({
        state: 'error',
        marketplace: 'all',
        message: 'Toplu içe aktarma hatası',
        detail: e?.response?.data?.message || e.message || 'Bilinmeyen hata',
      })
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Siparişler</h1>
          <p className="mt-1 text-sm text-zinc-600">Tüm siparişlerini görüntüle ve yönet.</p>
        </div>
      </div>

      {/* Marketplace Tabs */}
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-zinc-200">
        {Object.entries(TAB_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); setActiveFilter('') }}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Import Status Banner */}
      {importStatus && (
        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
          importStatus.state === 'importing'
            ? 'border-blue-200 bg-blue-50 text-blue-800'
            : importStatus.state === 'success'
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {importStatus.state === 'importing' && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {importStatus.state === 'success' && (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              )}
              {importStatus.state === 'error' && (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              )}
              <span className="font-medium">{importStatus.message}</span>
            </div>
            <button onClick={() => setImportStatus(null)} className="text-current opacity-60 hover:opacity-100">&times;</button>
          </div>
          {importStatus.detail && (
            <p className="mt-1 text-xs opacity-80">{importStatus.detail}</p>
          )}
        </div>
      )}

      {/* Import Bar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          placeholder="Sipariş no, müşteri adı, takip no ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[240px] rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
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
        <TableSkeleton rows={6} cols={6} />
      ) : (
        <div className="table-scroll mt-4 overflow-hidden rounded-xl border border-zinc-200">
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
            <EmptyState
              icon={<ShoppingCart className="h-10 w-10" />}
              title="Henüz sipariş bulunmuyor"
              description="Pazaryeri siparişlerini içe aktardığınızda burada görünecek."
            />
          )}
        </div>
      )}
    </div>
  )
}
