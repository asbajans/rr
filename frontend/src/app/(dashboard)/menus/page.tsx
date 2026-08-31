'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import type { StoreMenu, Page } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Save, Edit, ChevronUp, ChevronDown, FileText, Link as LinkIcon, X, GripVertical, FolderTree, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CardSkeleton } from '@/components/ui/skeleton'

type MenuItem = {
  id: string
  label: string
  url?: string
  page_id?: number
  categoryId?: number
  target?: '_self' | '_blank'
  children?: MenuItem[]
}

type CategoryNode = { id: number; parentId: number | null; name: string; slug: string; children?: CategoryNode[] }

let itemCounter = 1
const newItemId = () => `item_${itemCounter++}`

function emptyItem(): MenuItem {
  return { id: newItemId(), label: '', url: '', page_id: undefined, children: [] }
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function pageTitle(page: Page): string {
  return typeof page.title === 'object' ? ((page.title as Record<string, string>).tr ?? (page.title as Record<string, string>).en ?? '') : String(page.title)
}

export default function MenusPage() {
  const [menus, setMenus] = useState<(StoreMenu & { isActive?: boolean })[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [catTree, setCatTree] = useState<CategoryNode[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<{ name: string; slug: string; location: string; isActive: boolean; items: MenuItem[] }>({
    name: '', slug: '', location: 'header', isActive: true, items: [],
  })
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)
  const [catPick, setCatPick] = useState<{ id: string; includeChildren: boolean }>({ id: '', includeChildren: true })

  useEffect(() => {
    loadMenus()
    api.getPages().then(setPages).catch(() => {})
    loadCategories()
  }, [])

  function mapCat(raw: any): CategoryNode {
    const name = typeof raw.name === 'object' && raw.name !== null ? (raw.name.tr || raw.name.en || '') : raw.name || ''
    return { id: raw.id, parentId: raw.parentId ?? raw.parent_id ?? null, name, slug: raw.slug || '', children: raw.children ? raw.children.map(mapCat) : [] }
  }
  function loadCategories() {
    api.getCategoryTree(undefined as any).then((raw: any) => setCatTree((raw || []).map(mapCat))).catch(() => setCatTree([]))
  }
  function flattenCat(nodes: CategoryNode[], depth = 0): (CategoryNode & { depth: number })[] {
    const out: (CategoryNode & { depth: number })[] = []
    for (const n of nodes) { out.push({ ...n, depth } as any); if (n.children?.length) out.push(...flattenCat(n.children, depth + 1)) }
    return out
  }
  function findCat(id: number, nodes: CategoryNode[]): CategoryNode | null {
    const flat = flattenCat(nodes)
    return flat.find(c => c.id === id) as unknown as CategoryNode | null
  }
  function catToMenuItem(cat: CategoryNode, withChildren: boolean): MenuItem {
    // find full node with children from tree to preserve hierarchy
    const full = findCat(cat.id, catTree) ?? cat
    const item: MenuItem = { id: newItemId(), label: full.name, categoryId: full.id, children: [] }
    if (withChildren && (full as any).children?.length) item.children = (full as any).children.map((ch: any) => catToMenuItem(ch, true))
    return item
  }

  async function loadMenus() {
    try {
      const data = await api.getMenus()
      setMenus(data.map(m => ({ ...m, isActive: m.is_active })))
    } catch (err: any) {
      setMessage({ text: err.message || 'Menüler yüklenemedi', ok: false })
    } finally {
      setLoading(false)
    }
  }

  function showMessage(text: string, ok = true) {
    setMessage({ text, ok })
  }

  function handleNameChange(value: string) {
    setForm(prev => ({
      ...prev,
      name: value,
      slug: editingId ? prev.slug : (slugify(value) || prev.slug),
    }))
  }

  async function handleSave() {
    if (!form.name.trim()) { showMessage('Menü adı zorunludur', false); return }
    const items = form.items.filter(i => i.label.trim())
    setSaving(true)
    setMessage(null)
    const payload = { name: form.name, slug: form.slug || slugify(form.name), location: form.location, items, isActive: form.isActive }
    try {
      if (editingId) {
        const updated = await api.updateMenu(editingId, payload)
        setMenus(menus.map(m => m.id === editingId ? { ...updated, isActive: updated.is_active } : m))
        showMessage('Menü güncellendi')
      } else {
        const created = await api.createMenu(payload)
        setMenus([...menus, { ...created, isActive: created.is_active }])
        showMessage('Menü oluşturuldu')
      }
      resetForm()
    } catch (err: any) {
      showMessage(err.message || 'Kaydetme başarısız', false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Bu menüyü silmek istediğinizden emin misiniz?')) return
    try {
      await api.deleteMenu(id)
      setMenus(menus.filter(m => m.id !== id))
      showMessage('Menü silindi')
    } catch (err: any) {
      showMessage(err.message || 'Silme başarısız', false)
    }
  }

  function startEdit(menu: StoreMenu & { isActive?: boolean }) {
    setEditingId(menu.id)
    setForm({
      name: menu.name,
      slug: menu.slug,
      location: menu.location,
      isActive: menu.is_active,
      items: Array.isArray(menu.items) ? (menu.items as MenuItem[]) : [],
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm({ name: '', slug: '', location: 'header', isActive: true, items: [] })
  }

  // --- Item tree helpers (supports one level of children / submenu) ---
  function updateItem(items: MenuItem[], id: string, patch: Partial<MenuItem>): MenuItem[] {
    return items.map(i => {
      if (i.id === id) return { ...i, ...patch }
      if (i.children?.length) return { ...i, children: updateItem(i.children, id, patch) }
      return i
    })
  }

  function addItem() {
    setForm(prev => ({ ...prev, items: [...prev.items, emptyItem()] }))
  }

  function addChildItem(parentId: string) {
    setForm(prev => ({
      ...prev,
      items: prev.items.map(i => {
        if (i.id !== parentId) return i
        return { ...i, children: [...(i.children ?? []), emptyItem()] }
      }),
    }))
  }

  function removeItem(id: string) {
    setForm(prev => {
      const strip = (items: MenuItem[]): MenuItem[] => items.filter(i => i.id !== id).map(i => ({ ...i, children: i.children?.length ? strip(i.children) : i.children }))
      return { ...prev, items: strip(prev.items) }
    })
  }

  function moveItem(id: string, dir: -1 | 1) {
    setForm(prev => {
      const moveIn = (items: MenuItem[]): MenuItem[] => {
        const idx = items.findIndex(i => i.id === id)
        if (idx !== -1) {
          const target = idx + dir
          if (target < 0 || target >= items.length) return items
          const copy = [...items]
          ;[copy[idx], copy[target]] = [copy[target], copy[idx]]
          return copy
        }
        return items.map(i => (i.children?.length ? { ...i, children: moveIn(i.children) } : i))
      }
      return { ...prev, items: moveIn(prev.items) }
    })
  }

  function renderItemEditor(item: MenuItem, depth: number) {
    const isChild = depth > 0
    const catName = item.categoryId ? (flattenCat(catTree).find(c => String(c.id) === String(item.categoryId))?.name || `#${item.categoryId}`) : null
    const labelInput = (
      <input
        value={item.label}
        onChange={e => setForm(prev => ({ ...prev, items: updateItem(prev.items, item.id, { label: e.target.value }) }))}
        placeholder={isChild ? 'Alt menü başlığı' : 'Menü başlığı (ör: Hakkımızda)'}
        className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
      />
    )

    return (
      <div key={item.id} className={cn('rounded-lg border p-3', isChild ? 'ml-6 border-zinc-200 bg-zinc-50/60' : 'border-zinc-200 bg-white')}>
        <div className="flex items-start gap-2">
          <div className="mt-2 text-zinc-400"><GripVertical className="h-4 w-4" /></div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              {labelInput}
              <div className="flex items-center gap-1">
                <button onClick={() => moveItem(item.id, -1)} title="Yukarı taşı"
                  className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button onClick={() => moveItem(item.id, 1)} title="Aşağı taşı"
                  className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30">
                  <ChevronDown className="h-4 w-4" />
                </button>
                {!isChild && (
                  <button onClick={() => addChildItem(item.id)} title="Alt menü öğesi ekle"
                    className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50">
                    <Plus className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => removeItem(item.id)} title="Sil"
                  className="rounded p-1.5 text-red-500 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={item.categoryId ? 'category' : item.page_id ? 'page' : item.url ? 'url' : 'none'}
                onChange={e => {
                  const kind = e.target.value
                  setForm(prev => ({
                    ...prev,
                    items: updateItem(prev.items, item.id, kind === 'page'
                      ? { page_id: pages[0]?.id, url: undefined, categoryId: undefined }
                      : kind === 'url'
                        ? { url: item.url || '/', page_id: undefined, categoryId: undefined }
                        : kind === 'category'
                          ? { categoryId: flattenCat(catTree)[0]?.id, page_id: undefined, url: undefined, label: prev.items.find(x => x.id === item.id)?.label || flattenCat(catTree)[0]?.name || '' }
                          : { url: undefined, page_id: undefined, categoryId: undefined }),
                  }))
                }}
                className="rounded-lg border border-zinc-300 px-2 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none">
                <option value="none">Link yok</option>
                <option value="url">Harici bağlantı / URL</option>
                <option value="page">Sayfa</option>
                <option value="category">Kategori</option>
              </select>

              {item.categoryId ? (
                <div className="flex flex-1 items-center gap-1">
                  <Tag className="h-4 w-4 text-zinc-400" />
                  <select
                    value={item.categoryId ?? ''}
                    onChange={e => {
                      const newId = Number(e.target.value) || undefined
                      const cat = newId ? flattenCat(catTree).find(c => c.id === newId) : null
                      setForm(prev => ({
                        ...prev,
                        items: updateItem(prev.items, item.id, { categoryId: newId, label: !prev.items.find(x => x.id === item.id)?.label || prev.items.find(x => x.id === item.id)?.label === catName ? (cat?.name ?? '') : prev.items.find(x => x.id === item.id)!.label }),
                      }))
                    }}
                    className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none">
                    <option value="">Kategori seç...</option>
                    {flattenCat(catTree).map(c => <option key={c.id} value={c.id}>{'—'.repeat(c.depth)}{c.name || c.slug}</option>)}
                  </select>
                  {catName && <span className="hidden sm:inline text-xs text-zinc-500">→ ?categoryId={item.categoryId}</span>}
                </div>
              ) : item.page_id ? (
                <div className="flex flex-1 items-center gap-1">
                  <FileText className="h-4 w-4 text-zinc-400" />
                  <select
                    value={item.page_id ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, items: updateItem(prev.items, item.id, { page_id: Number(e.target.value) || undefined }) }))}
                    className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none">
                    <option value="">Sayfa seç...</option>
                    {pages.map(p => <option key={p.id} value={p.id}>/{p.slug} — {pageTitle(p)}</option>)}
                  </select>
                </div>
              ) : item.url !== undefined ? (
                <div className="flex flex-1 items-center gap-1">
                  <LinkIcon className="h-4 w-4 text-zinc-400" />
                  <input
                    value={item.url ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, items: updateItem(prev.items, item.id, { url: e.target.value }) }))}
                    placeholder="/iletisim veya https://ornek.com"
                    className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>
              ) : (
                <span className="flex-1 text-xs text-zinc-400">Bu menü öğesi link içermiyor (alt menü anahtarı olarak kullanılabilir).</span>
              )}
            </div>
          </div>
        </div>

        {(item.children ?? []).map(child => renderItemEditor(child, depth + 1))}
      </div>
    )
  }

  if (loading) return <div className="p-8"><CardSkeleton count={3} /></div>

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Menüler</h1>

      {message && (
        <div className={cn('rounded-lg p-4 text-sm', message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700')}>{message.text}</div>
      )}

      <div className="rounded-xl border border-zinc-200 p-6">
        <h2 className="mb-4 text-lg font-semibold">{editingId ? 'Menüyü Düzenle' : 'Yeni Menü'}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Adı <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="Örn: Ana Menü"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Slug <span className="text-zinc-400 font-normal">(boş bırakılırsa ad üretir)</span></label>
            <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="ana-menu"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Konum</label>
            <select value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none">
              <option value="header">Üst menü (Header)</option>
              <option value="footer">Alt menü (Footer)</option>
              <option value="sidebar">Yan menü (Sidebar)</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-zinc-700 mb-1">Menü Öğeleri</label>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
            {form.items.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-400">
                Henüz menü öğesi yok. Aşağıdaki butonla öğe ekleyin — kod yazmanıza gerek yok.
              </p>
            ) : (
              <div className="space-y-2">{form.items.map(item => renderItemEditor(item, 0))}</div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => addItem()}>
                <Plus className="mr-1 h-3 w-3" />Menü Öğesi Ekle
              </Button>
              <Button size="sm" variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => { loadCategories(); setShowCatModal(true) }}>
                <FolderTree className="mr-1 h-3 w-3" />Kategori Dalı Ekle
              </Button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Her öğeye başlık ve bir hedef seçin (URL, sayfa veya <span className="font-medium">kategori</span> — kategori menüsü mağazada o kategori ve alt kategorilerindeki ürünleri filtreler). Bir öğenin yanındaki + ile alt menü ekleyebilirsiniz. “Kategori Dalı Ekle” seçilen dalı altlarıyla beraber tek tıkta ekler.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500" />
            Aktif
          </label>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" /> {editingId ? 'Güncelle' : 'Oluştur'}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm}><X className="mr-1 h-4 w-4" />İptal</Button>
            )}
          </div>
        </div>
      </div>

      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowCatModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2"><FolderTree className="h-5 w-5 text-indigo-600" />Kategori Dalı Ekle</h2>
            <p className="mt-1 text-sm text-zinc-600">Seçilen kategori dalı menüye eklenecek; alt kategorileri otomatik alt menü olur. Mağazada tıklandığında ilgili kategori (ve altları) filtrelenir.</p>
            <div className="mt-4">
              <label className="text-xs font-medium text-zinc-500">Kategori {catTree.length === 0 && <span className="text-amber-600">(yükleniyor...)</span>}</label>
              <select value={catPick.id} onChange={e => setCatPick(prev => ({ ...prev, id: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
                <option value="">Seçin...</option>
                {flattenCat(catTree).map(c => <option key={c.id} value={c.id}>{'—'.repeat(c.depth)}{c.name || c.slug}</option>)}
              </select>
              {catTree.length === 0 && <p className="mt-1 text-xs text-amber-600">Kategoriler yükleniyor, lütfen bekleyin ve tekrar deneyin. “Kendi Kategorilerim”de hiç kategori yoksa önce kategori oluşturun veya pazaryerinden kopyalayın.</p>}
              {flattenCat(catTree).length === 0 && catTree.length === 0 && <button onClick={loadCategories} className="mt-1 text-xs text-indigo-600 underline">Tekrar yükle</button>}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={catPick.includeChildren} onChange={e => setCatPick(prev => ({ ...prev, includeChildren: e.target.checked }))} className="h-4 w-4 rounded border-zinc-300 text-indigo-600" />
              Alt kategorileri de ekle (dal)
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowCatModal(false)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">İptal</button>
              <button
                onClick={() => {
                  if (!catPick.id) return
                  const cat = findCat(Number(catPick.id), catTree)
                  if (!cat) { alert('Kategori bulunamadı, lütfen listeyi yenileyin'); loadCategories(); return }
                  const item = catToMenuItem(cat, catPick.includeChildren)
                  setForm(prev => ({ ...prev, items: [...prev.items, item] }))
                  setShowCatModal(false)
                  setCatPick({ id: '', includeChildren: true })
                }}
                disabled={!catPick.id}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Ekle</button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-50">
            <tr>
              <th className="p-3 text-left text-sm font-medium text-zinc-600">Ad</th>
              <th className="p-3 text-left text-sm font-medium text-zinc-600">Slug</th>
              <th className="p-3 text-left text-sm font-medium text-zinc-600">Konum</th>
              <th className="p-3 text-left text-sm font-medium text-zinc-600">Öğe</th>
              <th className="p-3 text-left text-sm font-medium text-zinc-600">Durum</th>
              <th className="p-3 text-right text-sm font-medium text-zinc-600">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {menus.map(menu => (
              <tr key={menu.id}>
                <td className="p-3 text-sm">{menu.name}</td>
                <td className="p-3 font-mono text-sm">{menu.slug}</td>
                <td className="p-3">
                  <span className={cn('px-2 py-0.5 rounded text-xs', menu.location === 'header' ? 'bg-blue-100 text-blue-700' : menu.location === 'footer' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                    {menu.location}
                  </span>
                </td>
                <td className="p-3 text-sm">{(menu.items as any[])?.length || 0}</td>
                <td className="p-3">
                  <span className={cn('px-2 py-0.5 rounded text-xs', menu.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-600')}>
                    {menu.is_active ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(menu)} title="Düzenle" className="px-1.5">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(menu.id)} className="text-red-600 hover:bg-red-50 px-1.5" title="Sil">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {menus.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-500">Henüz menü yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
