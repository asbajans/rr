'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { Category } from '@/lib/types'
import { Plus, ChevronRight, ChevronDown, Folder, Tag, Pencil, Trash2 } from 'lucide-react'

export default function SuperCategoriesPage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState({ slug: '', name: '', parent_id: '' as string | number, sort_order: '0', icon: '', is_active: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    api.getCategories()
      .then((res) => setCategories(res.data))
      .catch(() => setError('Failed to load categories'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate(parentId?: number) {
    setEditing(null)
    setForm({ slug: '', name: '', parent_id: parentId ?? '', sort_order: '0', icon: '', is_active: true })
    setShowModal(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setForm({ slug: cat.slug, name: cat.name, parent_id: cat.parent_id ?? '', sort_order: String(cat.sort_order), icon: cat.icon ?? '', is_active: cat.is_active })
    setShowModal(true)
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  async function handleSave() {
    if (!form.slug.trim() || !form.name.trim()) return
    setSaving(true)
    setError('')
    try {
      const data = {
        slug: form.slug,
        name: form.name,
        parent_id: form.parent_id !== '' ? Number(form.parent_id) : null,
        sort_order: parseInt(form.sort_order) || 0,
        icon: form.icon || null,
        is_active: form.is_active,
      }
      if (editing) {
        await api.updateCategory(editing.id, data)
      } else {
        await api.createCategory(data as any)
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
    if (!confirm('Bu kategoriyi silmek istediğinize emin misiniz?')) return
    try {
      await api.deleteCategory(id)
      load()
    } catch (err: any) {
      alert(err.message || 'Failed to delete')
    }
  }

  function renderTree(items: Category[], depth = 0) {
    return items.map((cat) => {
      const hasChildren = cat.children && cat.children.length > 0
      const isExpanded = expanded.has(cat.id)
      return (
        <div key={cat.id}>
          <div className={`flex items-center gap-2 px-4 py-2 hover:bg-zinc-50 ${depth > 0 ? 'ml-6' : ''}`} style={{ paddingLeft: 16 + depth * 24 }}>
            <button onClick={() => hasChildren && toggleExpand(cat.id)} className="p-0.5 text-zinc-400 hover:text-zinc-600">
              {hasChildren ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="inline-block w-4" />}
            </button>
            <Folder className={`h-4 w-4 ${cat.is_active ? 'text-amber-500' : 'text-zinc-300'}`} />
            <span className={`flex-1 text-sm ${cat.is_active ? 'text-zinc-900' : 'text-zinc-400'}`}>{cat.name}</span>
            <span className="text-xs text-zinc-400">{cat.slug}</span>
            <button onClick={() => openEdit(cat)} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"><Pencil className="h-3.5 w-3.5" /></button>
            <button onClick={() => openCreate(cat.id)} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"><Plus className="h-3.5 w-3.5" /></button>
            <button onClick={() => handleDelete(cat.id)} className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
          {hasChildren && isExpanded && renderTree(cat.children!, depth + 1)}
        </div>
      )
    })
  }

  if (!user) return null

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Kategoriler</h1>
          <p className="mt-1 text-sm text-zinc-600">Evrensel kategori ağacı ve pazar yeri eşleme.</p>
        </div>
        <button onClick={() => openCreate()} className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          <Plus className="h-4 w-4" /> Kategori Ekle
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      {loading && <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>}

      {!loading && (
        <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {categories.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">Henüz kategori eklenmemiş.</div>
          ) : renderTree(categories)}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-900">{editing ? 'Kategori Düzenle' : 'Yeni Kategori'}</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700">Slug</label>
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" placeholder="ornek-kategori" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Ad</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" placeholder="Örnek Kategori" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Üst Kategori</label>
                <select value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
                  <option value="">Kök Kategori</option>
                  {categories.flatMap(cat => {
                    const flatten = (c: Category, depth = 0): { id: number; name: string; depth: number }[] => {
                      const items = [{ id: c.id, name: c.name, depth }]
                      if (c.children) c.children.forEach((ch) => items.push(...flatten(ch, depth + 1)))
                      return items
                    }
                    return flatten(cat)
                  }).map((c) => (
                    <option key={c.id} value={c.id}>{'─'.repeat(c.depth)} {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Sıra</label>
                  <input type="number" min="0" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Icon</label>
                  <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" placeholder="emoji or icon URL" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300" />
                <label className="text-sm font-medium text-zinc-700">Aktif</label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">İptal</button>
              <button onClick={handleSave} disabled={saving || !form.slug.trim() || !form.name.trim()}
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
