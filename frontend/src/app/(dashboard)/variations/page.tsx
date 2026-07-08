'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { Variation } from '@/lib/types'
import { Plus, Pencil, Trash2, GripVertical, FolderKanban } from 'lucide-react'

export default function VariationsPage() {
  const { user } = useAuth()
  const [variations, setVariations] = useState<Variation[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Variation | null>(null)
  const [form, setForm] = useState({ name: '', type: 'select', options: [''] as string[] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    api.getVariations()
      .then((res) => setVariations(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', type: 'select', options: [''] })
    setShowModal(true)
  }

  function openEdit(v: Variation) {
    setEditing(v)
    setForm({
      name: v.name,
      type: v.type,
      options: v.options?.map((o) => o.value) || [''],
    })
    setShowModal(true)
  }

  function addOption() {
    setForm((prev) => ({ ...prev, options: [...prev.options, ''] }))
  }

  function removeOption(i: number) {
    setForm((prev) => ({ ...prev, options: prev.options.filter((_, idx) => idx !== i) }))
  }

  function updateOption(i: number, val: string) {
    setForm((prev) => {
      const opts = [...prev.options]
      opts[i] = val
      return { ...prev, options: opts }
    })
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    try {
      const data = {
        name: form.name,
        type: form.type,
        options: form.options.filter((o) => o.trim()).map((o, i) => ({ value: o, sort_order: i })),
      }
      if (editing) {
        await api.updateVariation(editing.id, data)
      } else {
        await api.createVariation(data as any)
      }
      setShowModal(false)
      load()
    } catch (err: any) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Bu varyasyonu silmek istediğinize emin misiniz?')) return
    try {
      await api.deleteVariation(id)
      load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (!user) return null

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Varyasyonlar</h1>
          <p className="mt-1 text-sm text-zinc-600">Ürün varyasyonlarını (renk, beden, vb.) yönet.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          <Plus className="h-4 w-4" /> Varyasyon Ekle
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      {loading && <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>}

      {!loading && variations.length === 0 && (
        <div className="mt-16 text-center text-sm text-zinc-500">
          <FolderKanban className="mx-auto h-10 w-10 text-zinc-300" />
          <p className="mt-4">Henüz varyasyon eklenmemiş.</p>
        </div>
      )}

      {!loading && variations.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {variations.map((v) => (
            <div key={v.id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-zinc-300" />
                  <h3 className="text-sm font-semibold text-zinc-900">{v.name}</h3>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">{v.type}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(v)} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(v.id)} className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {v.options?.map((opt) => (
                  <span key={opt.id} className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600">{opt.value}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-900">{editing ? 'Varyasyon Düzenle' : 'Yeni Varyasyon'}</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700">Ad</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" placeholder="Renk, Beden, vb." />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Tip</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
                  <option value="select">Seçim</option>
                  <option value="color">Renk</option>
                  <option value="text">Metin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Seçenekler</label>
                <div className="mt-1 space-y-2">
                  {form.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={opt} onChange={(e) => updateOption(i, e.target.value)}
                        className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" placeholder={`Seçenek ${i + 1}`} />
                      <button onClick={() => removeOption(i)} disabled={form.options.length <= 1}
                        className="rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
                <button onClick={addOption} className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700">+ Seçenek Ekle</button>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">İptal</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                {saving ? 'Kaydediliyor...' : editing ? 'Güncelle' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
