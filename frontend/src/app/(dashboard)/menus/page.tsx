'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import type { StoreMenu } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Save, Edit, ChevronUp, ChevronDown, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function MenusPage() {
  const [menus, setMenus] = useState<(StoreMenu & { isActive?: boolean })[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<Record<string, any>>({
    name: '', slug: '', location: 'header', isActive: true, items: []
  })
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadMenus()
  }, [])

  async function loadMenus() {
    try {
      const data = await api.getMenus()
      setMenus(data.map(m => ({ ...m, isActive: m.is_active })))
    } catch (err: any) {
      setMessage(err.message || 'Menüler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    setSaving(true)
    setMessage('')
    try {
      const newMenu = await api.createMenu({ name: form.name, slug: form.slug, location: form.location, items: form.items, isActive: form.isActive })
      setMenus([...menus, { ...newMenu, isActive: newMenu.is_active }])
      resetForm()
      setMessage('Menü oluşturuldu')
    } catch (err: any) {
      setMessage(err.message || 'Oluşturma başarısız')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(id: number) {
    setSaving(true)
    setMessage('')
    try {
      const updated = await api.updateMenu(id, { name: form.name, slug: form.slug, location: form.location, items: form.items, isActive: form.isActive })
      setMenus(menus.map(m => m.id === id ? { ...updated, isActive: updated.is_active } : m))
      setEditingId(null)
      resetForm()
      setMessage('Menü güncellendi')
    } catch (err: any) {
      setMessage(err.message || 'Güncelleme başarısız')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Bu menüyü silmek istediğinizden emin misiniz?')) return
    try {
      await api.deleteMenu(id)
      setMenus(menus.filter(m => m.id !== id))
      setMessage('Menü silindi')
    } catch (err: any) {
      setMessage(err.message || 'Silme başarısız')
    }
  }

  function startEdit(menu: StoreMenu & { isActive?: boolean }) {
    setEditingId(menu.id)
    setForm({
      name: menu.name,
      slug: menu.slug,
      location: menu.location,
      isActive: menu.is_active,
      items: menu.items
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm({ name: '', slug: '', location: 'header', isActive: true, items: [] })
  }

  if (loading) return <div className="p-8 text-center text-zinc-500">Yükleniyor...</div>

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Menüler</h1>

      {message && (
        <div className="rounded-lg bg-green-50 p-4 text-green-800 text-sm">{message}</div>
      )}

      <div className="rounded-xl border border-zinc-200 p-6">
        <h2 className="mb-4 text-lg font-semibold">{editingId ? 'Menüyü Düzenle' : 'Yeni Menü'}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Adı</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Örn: Ana Menü"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Slug</label>
            <input value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} placeholder="ana-menu"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Konum</label>
            <select value={form.location} onChange={e => setForm({...form, location: e.target.value})}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none">
              <option value="header">Header</option>
              <option value="footer">Footer</option>
              <option value="sidebar">Sidebar</option>
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 pt-6">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm({...form, isActive: e.target.checked})}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500" />
              Aktif
            </label>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-zinc-700 mb-1">Öğeler (JSON)</label>
          <textarea
            value={JSON.stringify(form.items || [], null, 2)}
            onChange={e => { try { setForm({...form, items: JSON.parse(e.target.value)}) } catch {} }}
            rows={6}
            placeholder={'[{"id":"1","label":"Ana Sayfa","url":"/"},{"id":"2","label":"Urunler","url":"/products"}]'}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
          />
          <p className="mt-1 text-xs text-zinc-500">Format: {'[{id,label,url,page_id?,target?,children[]}]'}</p>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={editingId ? () => handleUpdate(editingId!) : handleCreate} disabled={saving}>
            <Save className="mr-2 h-4 w-4" /> {editingId ? 'Güncelle' : 'Oluştur'}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={resetForm}>İptal</Button>
          )}
        </div>
      </div>

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