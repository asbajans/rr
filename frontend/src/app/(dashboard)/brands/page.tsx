'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api-client'
import type { Brand } from '@/lib/types'
import { Building2, Plus, Pencil, Trash2, Search, RefreshCw, Tag } from 'lucide-react'

type TabKey = 'all' | 'trendyol' | 'n11'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'trendyol', label: 'Trendyol' },
  { key: 'n11', label: 'N11' },
]

function mapBrand(raw: any): Brand {
  return {
    id: raw.id,
    name: raw.name || '',
    marketplace: raw.marketplace || null,
    marketplaceBrandId: raw.marketplaceBrandId ?? raw.marketplace_brand_id ?? null,
    isActive: raw.isActive ?? raw.is_active ?? true,
    createdAt: raw.createdAt ?? raw.created_at ?? '',
    updatedAt: raw.updatedAt ?? raw.updated_at ?? '',
  }
}

export default function BrandsPage() {
  const [tab, setTab] = useState<TabKey>('all')
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Brand | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', marketplace: '', marketplaceBrandId: '' })
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const filters: any = {}
    if (tab !== 'all') filters.marketplace = tab
    if (search.trim()) filters.search = search.trim()
    api.getBrands(filters)
      .then((raw: any) => setBrands((raw || []).map(mapBrand)))
      .catch(() => setBrands([]))
      .finally(() => setLoading(false))
  }, [tab, search])

  useEffect(() => { load() }, [load])

  const filtered = brands

  function openCreate() {
    setEditing(null)
    setForm({ name: '', marketplace: tab !== 'all' ? tab : '', marketplaceBrandId: '' })
    setShowForm(true)
    setError('')
  }

  function openEdit(b: Brand) {
    setEditing(b)
    setForm({ name: b.name, marketplace: b.marketplace || '', marketplaceBrandId: b.marketplaceBrandId || '' })
    setShowForm(true)
    setError('')
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Marka adı gerekli'); return }
    try {
      if (editing) {
        const data: any = { name: form.name.trim() }
        if (form.marketplace) data.marketplace = form.marketplace
        if (form.marketplaceBrandId) data.marketplaceBrandId = form.marketplaceBrandId
        await api.updateBrand(editing.id, data)
      } else {
        await api.createBrand({ name: form.name.trim(), marketplace: form.marketplace || undefined, marketplaceBrandId: form.marketplaceBrandId || undefined })
      }
      setShowForm(false)
      load()
    } catch (err: any) {
      setError(err.message || 'Hata')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Bu markayı silmek istediğinize emin misiniz?')) return
    try {
      await api.deleteBrand(id)
      load()
    } catch (err: any) {
      alert(err.message || 'Silme hatası')
    }
  }

  async function handleSync(mp: string) {
    setSyncing(mp)
    try {
      const res = await api.syncBrands(mp)
      alert(`${mp} üzerinden ${res.imported} yeni marka içe aktarıldı (toplam ${res.total})`)
      load()
    } catch (err: any) {
      alert(err.message || 'Senkronizasyon hatası')
    } finally {
      setSyncing(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Markalar</h1>
          <p className="mt-1 text-sm text-zinc-600">Pazaryeri markalarını yönetin veya senkronize edin.</p>
        </div>
        <div className="flex items-center gap-2">
          {tab !== 'all' && (
            <button onClick={() => handleSync(tab)} disabled={syncing === tab}
              className="flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${syncing === tab ? 'animate-spin' : ''}`} />
              {syncing === tab ? 'Senkronize Ediliyor...' : `${TABS.find(t => t.key === tab)?.label}'dan Al`}
            </button>
          )}
          <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            <Plus className="h-4 w-4" /> Marka Ekle
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-1 border-b border-zinc-200">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Marka ara..." className="w-full rounded-lg border border-zinc-300 py-2 pl-10 pr-4 text-sm focus:border-zinc-900 focus:outline-none" />
      </div>

      {loading && <div className="mt-8 text-sm text-zinc-500">Yükleniyor...</div>}

      {!loading && filtered.length === 0 && (
        <div className="mt-16 text-center text-sm text-zinc-500">
          <Building2 className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-2">Henüz marka bulunmuyor.</p>
          {tab !== 'all' && (
            <button onClick={() => handleSync(tab)} disabled={syncing === tab}
              className="mt-2 inline-flex items-center gap-1.5 text-indigo-600 hover:underline disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${syncing === tab ? 'animate-spin' : ''}`} />
              Pazaryerinden markaları içe aktar
            </button>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                <th className="px-4 py-3">Marka Adı</th>
                <th className="px-4 py-3">Kaynak</th>
                <th className="px-4 py-3">Pazaryeri ID</th>
                <th className="px-4 py-3 text-center">Durum</th>
                <th className="px-4 py-3 text-right w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-zinc-900">{b.name || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {b.marketplace ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        <Tag className="h-3 w-3" /> {b.marketplace}
                      </span>
                    ) : (
                      <span className="text-zinc-400">Manuel</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs font-mono">{b.marketplaceBrandId || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {b.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(b)} title="Düzenle" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(b.id)} title="Sil" className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-zinc-900">{editing ? 'Marka Düzenle' : 'Yeni Marka'}</h2>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500">Marka Adı</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Kaynak (Pazaryeri)</label>
                <select value={form.marketplace} onChange={e => setForm({ ...form, marketplace: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none">
                  <option value="">— Manuel —</option>
                  <option value="trendyol">Trendyol</option>
                  <option value="n11">N11</option>
                  <option value="hepsiburada">Hepsiburada</option>
                  <option value="pazarama">Pazarama</option>
                  <option value="amazon">Amazon</option>
                  <option value="etsy">Etsy</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Pazaryeri ID</label>
                <input value={form.marketplaceBrandId} onChange={e => setForm({ ...form, marketplaceBrandId: e.target.value })}
                  placeholder="Pazaryerindeki marka ID'si" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">İptal</button>
              <button onClick={handleSave} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
