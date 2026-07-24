'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { FolderTree, Plus, ChevronRight, ChevronDown, Pencil, Trash2, Search, Store } from 'lucide-react'

type TabKey = 'own' | 'n11' | 'trendyol' | 'hepsiburada' | 'pazarama' | 'amazon' | 'etsy'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'own', label: 'Kendi Kategorilerim' },
  { key: 'trendyol', label: 'Trendyol' },
  { key: 'hepsiburada', label: 'Hepsiburada' },
  { key: 'pazarama', label: 'Pazarama' },
  { key: 'n11', label: 'N11' },
  { key: 'amazon', label: 'Amazon' },
  { key: 'etsy', label: 'Etsy' },
]

interface CategoryItem {
  id: number
  parentId: number | null
  name: string
  slug: string
  sortOrder: number
  isActive: boolean
  icon: string | null
  children?: CategoryItem[]
  createdAt: string
}

function flattenTree(nodes: CategoryItem[], depth = 0): (CategoryItem & { depth: number })[] {
  const result: (CategoryItem & { depth: number })[] = []
  for (const n of nodes) {
    result.push({ ...n, depth })
    if (n.children?.length) result.push(...flattenTree(n.children, depth + 1))
  }
  return result
}

function mapCategory(raw: any): CategoryItem {
  return {
    id: raw.id,
    parentId: raw.parentId ?? raw.parent_id ?? null,
    name: typeof raw.name === 'object' && raw.name !== null ? (raw.name.tr || raw.name.en || '') : raw.name || '',
    slug: raw.slug || '',
    sortOrder: raw.sortOrder ?? raw.sort_order ?? 0,
    isActive: raw.isActive ?? raw.is_active ?? true,
    icon: raw.icon || null,
    children: raw.children ? raw.children.map(mapCategory) : [],
    createdAt: raw.createdAt ?? raw.created_at ?? '',
  }
}

export default function CategoriesPage() {
  const [tab, setTab] = useState<TabKey>('own')
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CategoryItem | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', slug: '', parentId: '', sortOrder: 0, isActive: true })

  const isOwn = tab === 'own'

  const load = useCallback(() => {
    setLoading(true)
    const source = isOwn ? undefined : tab
    api.getCategoryTree(source)
      .then((raw: any) => setCategories((raw || []).map(mapCategory)))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false))
  }, [tab, isOwn])

  useEffect(() => { load() }, [load])

  useEffect(() => { setExpanded(new Set()); setSearch('') }, [tab])

  function openCreate(parentId?: number) {
    if (!isOwn) return
    setEditing(null)
    setForm({ name: '', slug: '', parentId: parentId != null ? String(parentId) : '', sortOrder: 0, isActive: true })
    setShowForm(true)
  }

  function openEdit(cat: CategoryItem) {
    if (!isOwn) return
    setEditing(cat)
    setForm({
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId != null ? String(cat.parentId) : '',
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
    })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    const slug = form.slug.trim() || form.name.toLowerCase().replace(/[^a-z0-9ğüşıöç]+/g, '-').replace(/^-+|-+$/g, '')
    const data: any = {
      name: { tr: form.name },
      slug,
      sortOrder: form.sortOrder,
      isActive: form.isActive,
    }
    if (form.parentId) data.parentId = parseInt(form.parentId)

    try {
      if (editing) {
        await api.updateCategory(editing.id, data)
      } else {
        await api.createCategory(data)
      }
      setShowForm(false)
      load()
    } catch (err: any) {
      alert(err.message || 'Hata')
    }
  }

  async function handleDelete(id: number) {
    if (!isOwn) return
    if (!confirm('Bu kategoriyi silmek istediğinize emin misiniz?')) return
    try {
      await api.deleteCategory(id)
      load()
    } catch (err: any) {
      alert(err.message || 'Silme hatası')
    }
  }

  function toggleExpand(id: number) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const flatList = flattenTree(categories)
  const filtered = search
    ? flatList.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.slug.includes(search))
    : flatList

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Kategoriler</h1>
          <p className="mt-1 text-sm text-zinc-600">Ürün kategorilerini yönet veya pazaryeri kategorilerini görüntüle.</p>
        </div>
        {isOwn && (
          <button onClick={() => openCreate()} className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            <Plus className="h-4 w-4" /> Kategori Ekle
          </button>
        )}
      </div>

      <div className="mt-4 flex gap-1 border-b border-zinc-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {t.key === 'own' ? (
              <span className="flex items-center gap-1.5"><FolderTree className="h-3.5 w-3.5" />{t.label}</span>
            ) : (
              <span className="flex items-center gap-1.5"><Store className="h-3.5 w-3.5" />{t.label}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Kategori ara..." className="w-full rounded-lg border border-zinc-300 py-2 pl-10 pr-4 text-sm focus:border-zinc-900 focus:outline-none" />
      </div>

      {loading && <div className="mt-8 text-sm text-zinc-500">Yükleniyor...</div>}

      {!loading && filtered.length === 0 && (
        <div className="mt-16 text-center text-sm text-zinc-500">
          <FolderTree className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-2">
            {isOwn ? 'Henüz kategori bulunmuyor.' : 'Bu pazaryeri için senkronize edilmiş kategori bulunmuyor. Pazaryeri entegrasyonundan kategorileri içe aktarın.'}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3">Kategori Adı</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3 text-center">Durum</th>
                <th className="px-4 py-3 text-right w-24">Sıra</th>
                {isOwn && <th className="px-4 py-3 text-right w-24"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((cat) => (
                <tr key={cat.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    {cat.children?.length ? (
                      <button onClick={() => toggleExpand(cat.id)} className="text-zinc-400 hover:text-zinc-600">
                        {expanded.has(cat.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    ) : <span className="ml-4" />}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {cat.icon && <span className="text-base">{cat.icon}</span>}
                      <span className="font-medium text-zinc-900" style={{ paddingLeft: `${cat.depth * 16}px` }}>
                        {cat.name || '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{cat.slug}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cat.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {cat.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-500">{cat.sortOrder}</td>
                  {isOwn && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openCreate(cat.id)} title="Alt Kategori Ekle" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                          <Plus className="h-4 w-4" />
                        </button>
                        <button onClick={() => openEdit(cat)} title="Düzenle" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(cat.id)} title="Sil" className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && isOwn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-zinc-900">{editing ? 'Kategori Düzenle' : 'Yeni Kategori'}</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500">Kategori Adı</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Slug</label>
                <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}
                  placeholder="Otomatik oluşturulur" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Üst Kategori</label>
                <select value={form.parentId} onChange={e => setForm({ ...form, parentId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none">
                  <option value="">— Yok (Ana Kategori) —</option>
                  {flatList.map(c => (
                    <option key={c.id} value={c.id} disabled={c.id === editing?.id}>{'—'.repeat(c.depth)}{c.name || c.slug}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-zinc-500">Aktif</label>
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500">Sıralama</label>
                  <input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                    className="ml-2 w-20 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none" />
                </div>
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
