'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import type { Page } from '@/lib/types'
import { FileText, Plus, Pencil, Trash2, Globe, Newspaper } from 'lucide-react'

const defaultForm: { type: 'page' | 'blog'; title: string; slug: string; content: string; meta_title: string; meta_description: string; is_published: boolean } = { type: 'page', title: '', slug: '', content: '', meta_title: '', meta_description: '', is_published: false }

export default function PagesPage() {
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState(defaultForm)

  useEffect(() => {
    api.getAdminPages().then(setPages).catch(() => {}).finally(() => setLoading(false))
  }, [])

  function openNew() {
    setForm(defaultForm)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(p: Page) {
    setForm({ type: p.type, title: p.title, slug: p.slug, content: p.content, meta_title: p.meta_title || '', meta_description: p.meta_description || '', is_published: p.is_published })
    setEditingId(p.id)
    setShowForm(true)
  }

  async function save() {
    setSaving(true)
    setMessage('')
    try {
      const data = { ...form }
      if (editingId) {
        await api.updateAdminPage(editingId, data)
      } else {
        await api.createAdminPage(data)
      }
      setMessage(editingId ? 'Sayfa güncellendi' : 'Sayfa oluşturuldu')
      setShowForm(false)
      api.getAdminPages().then(p => { setPages(p); setMessage('') })
    } catch (err: any) {
      setMessage(err.message || 'Hata')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    if (!confirm('Silmek istediğine emin misin?')) return
    try {
      await api.deleteAdminPage(id)
      setPages(prev => prev.filter(p => p.id !== id))
    } catch (err: any) {
      setMessage(err.message || 'Hata')
    }
  }

  if (loading) return <div className="text-sm text-zinc-500">Yükleniyor...</div>

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sayfalar & Blog</h1>
          <p className="mt-1 text-sm text-zinc-400">Statik sayfaları ve blog yazılarını yönet.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1 rounded-lg bg-white px-4 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-100">
          <Plus className="h-4 w-4" /> Yeni Sayfa
        </button>
      </div>

      {message && <div className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm text-green-400">{message}</div>}

      <div className="mt-6 space-y-3">
        {pages.map(p => (
          <div key={p.id} className={`rounded-xl border p-4 ${p.is_published ? 'border-zinc-700 bg-zinc-900' : 'border-zinc-800 bg-zinc-900/50'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {p.type === 'blog' ? <Newspaper className="h-5 w-5 text-emerald-400" /> : <Globe className="h-5 w-5 text-indigo-400" />}
                <div>
                  <h3 className="text-sm font-semibold text-white">{p.title}</h3>
                  <p className="text-xs text-zinc-500">/{p.slug} · {p.type === 'blog' ? 'Blog' : 'Sayfa'} · {new Date(p.created_at).toLocaleDateString('tr-TR')}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(p)} className="p-1 text-zinc-500 hover:text-white"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(p.id)} className="p-1 text-zinc-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            {!p.is_published && <p className="mt-2 text-xs text-amber-400">Taslak</p>}
          </div>
        ))}
        {pages.length === 0 && <div className="p-12 text-center text-sm text-zinc-500">Henüz sayfa bulunmuyor.</div>}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowForm(false)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-zinc-900 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white">{editingId ? 'Sayfa Düzenle' : 'Yeni Sayfa'}</h2>

            <div className="mt-4 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-zinc-400">Tür</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'page' | 'blog' })}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white">
                    <option value="page">Sayfa</option>
                    <option value="blog">Blog</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-zinc-400">Başlık</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400">Slug (boş bırakılırsa başlıktan otomatik)</label>
                <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400">İçerik (HTML)</label>
                <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={12}
                  className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Meta Başlık</label>
                  <input value={form.meta_title} onChange={e => setForm({ ...form, meta_title: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Meta Açıklama</label>
                  <input value={form.meta_description} onChange={e => setForm({ ...form, meta_description: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={form.is_published} onChange={e => setForm({ ...form, is_published: e.target.checked })}
                  className="rounded border-zinc-600 bg-zinc-800" />
                Yayında
              </label>
            </div>

            <div className="mt-6 flex gap-2">
              <button onClick={save} disabled={saving || !form.title}
                className="flex-1 rounded-lg bg-white py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-400">İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}