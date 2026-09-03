'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { RefreshCw, Database, Globe, Tag, Layers, Trash2, Clock } from 'lucide-react'

const MPS = ['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy'] as const

export default function MarketplaceCatalogPage() {
  const [stats, setStats] = useState<Record<string, { categories: number; brands: number }>>({})
  const [catCounts, setCatCounts] = useState<Record<string, number>>({})
  const [brandCounts, setBrandCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState<string | null>(null)
  const [refreshAllLoading, setRefreshAllLoading] = useState(false)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function loadStats() {
    setLoading(true)
    const c: Record<string, number> = {}
    const b: Record<string, number> = {}
    for (const mp of MPS) {
      try {
        const res = await api.get<any>(`/api/admin/marketplace-catalog/${mp}/categories`)
        c[mp] = res.total ?? res.categories?.length ?? 0
      } catch { c[mp] = 0 }
      try {
        const res = await api.get<any>(`/api/admin/marketplace-catalog/${mp}/brands?limit=1`)
        b[mp] = res.total ?? 0
      } catch { b[mp] = 0 }
    }
    setCatCounts(c)
    setBrandCounts(b)
    setLoading(false)
  }

  useEffect(() => { loadStats() }, [])

  async function handleRefresh(mp: string) {
    setRefreshing(mp)
    setMessage('')
    try {
      const res = await api.post<any>(`/api/admin/marketplace-catalog/${mp}/refresh`)
      setMessage(`${mp}: ${res.categories ?? 0} kategori, ${res.brands ?? 0} marka senkronize edildi`)
      await loadStats()
    } catch (e: any) {
      setMessage(e.message || 'Yenileme hatası')
    } finally { setRefreshing(null) }
  }

  async function handleRefreshAll() {
    setRefreshAllLoading(true)
    setMessage('')
    try {
      const res = await api.post<any>('/api/admin/marketplace-catalog/refresh-all')
      setMessage('Tüm pazaryerleri senkronize edildi')
      await loadStats()
    } catch (e: any) {
      setMessage(e.message || 'Toplu yenileme hatası')
    } finally { setRefreshAllLoading(false) }
  }

  async function handleCleanup() {
    if (!confirm('Eski per-store kategori/marka verileri silinecek. Global katalog dolu olmalı. Emin misiniz?')) return
    setCleanupLoading(true)
    setMessage('')
    try {
      const res = await api.post<any>('/api/admin/marketplace-catalog/cleanup-per-store')
      setMessage(`Temizlendi: ${res.deletedCats ?? 0} kategori, ${res.deletedBrands ?? 0} marka silindi`)
    } catch (e: any) {
      setMessage(e.message || 'Temizleme hatası')
    } finally { setCleanupLoading(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pazaryeri Kataloğu (Global)</h1>
          <p className="mt-1 text-sm text-zinc-400">Kategori ve markalar global tabloda tutulur; entegrasyonu aktif olan satıcılar otomatik erişir. Günlük 03:00’te otomatik senkron + entegrasyon sonrası fallback zinciri ile doldurulur.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefreshAll} disabled={refreshAllLoading}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshAllLoading ? 'animate-spin' : ''}`} /> Tümünü Yenile
          </button>
          <button onClick={handleCleanup} disabled={cleanupLoading}
            className="flex items-center gap-2 rounded-lg border border-red-800 bg-red-950 px-4 py-2 text-xs font-medium text-red-200 hover:bg-red-900 disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> Per-Store Veriyi Temizle
          </button>
        </div>
      </div>

      {message && <div className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm text-amber-300">{message}</div>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MPS.map(mp => (
          <div key={mp} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-white" />
                <h3 className="text-sm font-semibold text-white capitalize">{mp}</h3>
              </div>
              <button onClick={() => handleRefresh(mp)} disabled={refreshing === mp}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">
                {refreshing === mp ? 'Yenileniyor...' : 'Yenile'}
              </button>
            </div>
            {loading ? <p className="mt-4 text-xs text-zinc-500">Yükleniyor...</p> : (
              <div className="mt-4 space-y-1 text-xs text-zinc-400">
                <p className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Kategori: <span className="font-mono text-white">{catCounts[mp] ?? 0}</span></p>
                <p className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Marka: <span className="font-mono text-white">{brandCounts[mp] ?? 0}</span></p>
                <p className="flex items-center gap-1.5"><Database className="h-3.5 w-3.5" /> Kaynak: global</p>
                <p className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Senkron: günlük + entegrasyon sonrası fallback</p>
              </div>
            )}
            <p className="mt-3 text-xs text-zinc-500">Satıcı “Markalar” sayfasını görmez; global markalar ürün formunda + entegrasyon ayarlarında (custom marka eklenebilir) otomatik gelir. Kategoriler ürün formunda globalden seçilir.</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-sm font-semibold text-white">Notlar</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-400">
          <li>Satıcı panelindeki “Markalar” linki kaldırıldı; satıcılar global markaları görür, kendi özel markasını ürün düzenle → marka seçiciden “custom” olarak ekleyebilir (per-store custom korunur).</li>
          <li>Pazaryeri entegrasyonu olmayan satıcı o pazaryerinin global kategorisini/markasını okuyamaz (403).</li>
          <li>Herhangi bir pazaryerinden veri çekilecekse aktif entegrasyonu olan ilk satıcının kimliğiyle çekilir, hata verirse bir sonrakine fallback edilir.</li>
          <li>Per-store temizlik sonrası geri dönüş için 7 gün yedek tutulması önerilir.</li>
        </ul>
      </div>
    </div>
  )
}
