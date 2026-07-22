'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { Category, MarketplaceMapping } from '@/lib/types'
import { ArrowLeft, Globe, Plus, Trash2, Tag } from 'lucide-react'

const MARKETPLACES = ['trendyol', 'hepsiburada', 'n11', 'pazarama', 'etsy', 'amazon']

export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()

  const [category, setCategory] = useState<Category | null>(null)
  const [mappings, setMappings] = useState<MarketplaceMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [showMappingForm, setShowMappingForm] = useState(false)
  const [mappingForm, setMappingForm] = useState({ marketplace: '', marketplace_category_id: '', marketplace_category_name: '', marketplace_parent_id: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      api.getCategory(parseInt(id)),
      api.getCategoryMappings(parseInt(id)),
    ])
      .then(([cat, mapRes]) => {
        setCategory((cat as any).category ?? cat)
        setMappings(mapRes as any)
      })
      .catch(() => router.push('/super/categories'))
      .finally(() => setLoading(false))
  }, [id, router])

  async function handleAddMapping() {
    if (!mappingForm.marketplace || !mappingForm.marketplace_category_id) return
    setSaving(true)
    try {
      const res = await api.createCategoryMapping(parseInt(id), {
        marketplace: mappingForm.marketplace,
        marketplaceCategoryId: mappingForm.marketplace_category_id,
        name: mappingForm.marketplace_category_name,
        parentId: mappingForm.marketplace_parent_id || undefined,
      })
      setMappings((prev) => {
        const idx = prev.findIndex((m) => m.marketplace === res.marketplace)
        if (idx >= 0) { const next = [...prev]; next[idx] = res; return next }
        return [...prev, res]
      })
      setShowMappingForm(false)
      setMappingForm({ marketplace: '', marketplace_category_id: '', marketplace_category_name: '', marketplace_parent_id: '' })
    } catch (err: any) {
      alert(err.message || 'Failed to save mapping')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteMapping(marketplace: string) {
    try {
      await api.deleteCategoryMapping(parseInt(id), marketplace)
      setMappings((prev) => prev.filter((m) => m.marketplace !== marketplace))
    } catch (err: any) {
      alert(err.message || 'Failed to delete mapping')
    }
  }

  if (!user) return null
  if (loading) return <p className="text-sm text-zinc-500">Yükleniyor...</p>
  if (!category) return <p className="text-sm text-zinc-500">Kategori bulunamadı.</p>

  return (
    <div>
      <button onClick={() => router.push('/super/categories')} className="mb-4 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" /> Kategoriler
      </button>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">{category.name}</h1>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">{category.slug}</span>
      </div>

      <div className="mt-8 space-y-8">
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-indigo-500" />
              <h2 className="text-lg font-semibold text-zinc-900">Pazar Yeri Eşleme</h2>
            </div>
            <button onClick={() => setShowMappingForm(true)} className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800">
              <Plus className="h-3 w-3" /> Eşleme Ekle
            </button>
          </div>

          {mappings.length === 0 && (
            <p className="mt-4 text-sm text-zinc-400">Henüz pazar yeri eşlemesi yapılmamış.</p>
          )}

          {mappings.length > 0 && (
            <div className="mt-4 space-y-2">
              {mappings.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Tag className="h-4 w-4 text-zinc-400" />
                    <div>
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">{m.marketplace}</span>
                      <span className="ml-2 text-sm text-zinc-900">{m.marketplace_category_name}</span>
                      <span className="ml-2 text-xs text-zinc-400">ID: {m.marketplace_category_id}</span>
                      {m.marketplace_parent_id && (
                        <span className="ml-2 text-xs text-zinc-400">Parent: {m.marketplace_parent_id}</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteMapping(m.marketplace)} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showMappingForm && (
            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <h3 className="text-sm font-semibold text-zinc-900">Yeni Eşleme</h3>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Pazar Yeri</label>
                  <select value={mappingForm.marketplace} onChange={(e) => setMappingForm({ ...mappingForm, marketplace: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
                    <option value="">Seçin</option>
                    {MARKETPLACES.filter((m) => !mappings.find((ex) => ex.marketplace === m)).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Kategori ID</label>
                  <input value={mappingForm.marketplace_category_id} onChange={(e) => setMappingForm({ ...mappingForm, marketplace_category_id: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Kategori Adı</label>
                  <input value={mappingForm.marketplace_category_name} onChange={(e) => setMappingForm({ ...mappingForm, marketplace_category_name: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Üst Kategori ID</label>
                  <input value={mappingForm.marketplace_parent_id} onChange={(e) => setMappingForm({ ...mappingForm, marketplace_parent_id: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setShowMappingForm(false)} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">İptal</button>
                <button onClick={handleAddMapping} disabled={saving || !mappingForm.marketplace || !mappingForm.marketplace_category_id}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                  {saving ? 'Kaydediliyor...' : 'Ekle'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
