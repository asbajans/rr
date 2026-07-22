'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { Page, PageBlock } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { FileText, Plus, Pencil, Trash2, ChevronDown, ChevronRight, GripVertical, X } from 'lucide-react'

let blockIdCounter = 1
function newBlockId() { return `block_${blockIdCounter++}` }

const BLOCK_TYPES = ['hero', 'text', 'image', 'gallery', 'products', 'features', 'cta', 'contact', 'html'] as const

function emptyBlock(type: PageBlock['type'] = 'text'): PageBlock {
  const base: PageBlock = { id: newBlockId(), type, content: {} }
  switch (type) {
    case 'hero':
      base.content = { heading: '', subtitle: '', buttonText: '', buttonUrl: '', backgroundImage: '', overlayOpacity: 0.5 }
      break
    case 'text':
      base.content = { body: '' }
      break
    case 'image':
      base.content = { src: '', alt: '', caption: '' }
      break
    case 'gallery':
      base.content = { images: ['', '', ''] }
      break
    case 'products':
      base.content = { title: '', categoryIds: [], limit: 8, layout: 'grid' }
      break
    case 'features':
      base.content = { title: '', items: [{ icon: 'Check', title: '', description: '' }] }
      break
    case 'cta':
      base.content = { heading: '', subtitle: '', buttonText: '', buttonUrl: '', backgroundImage: '' }
      break
    case 'contact':
      base.content = { title: '', email: '', phone: '', address: '' }
      break
    case 'html':
      base.content = { html: '' }
      break
  }
  return base
}

type FormState = {
  id: number | null
  title: string
  slug: string
  blocks: PageBlock[]
  meta_title: string
  meta_description: string
  is_active: boolean
}

const defaultForm: FormState = { id: null, title: '', slug: '', blocks: [], meta_title: '', meta_description: '', is_active: true }

export default function PagesPage() {
  const { user } = useAuth()
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(defaultForm)

  useEffect(() => {
    api.getPages()
      .then(setPages)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (!user) return null

  function generateSlug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  function openNew() {
    setForm(defaultForm)
    setShowForm(true)
  }

  function openEdit(page: Page) {
    const title = typeof page.title === 'object' ? (page.title as Record<string, string>).tr ?? '' : String(page.title)
    const meta = (page.meta as Record<string, string>) ?? {}
    setForm({
      id: page.id,
      title,
      slug: page.slug,
      blocks: page.content ?? [],
      meta_title: meta.title ?? '',
      meta_description: meta.description ?? '',
      is_active: page.is_active,
    })
    setShowForm(true)
  }

  function addBlock() {
    setForm((prev) => ({ ...prev, blocks: [...prev.blocks, emptyBlock('text')] }))
  }

  function removeBlock(blockId: string) {
    setForm((prev) => ({ ...prev, blocks: prev.blocks.filter((b) => b.id !== blockId) }))
  }

  function updateBlock(blockId: string, updater: (block: PageBlock) => PageBlock) {
    setForm((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === blockId ? updater(b) : b)),
    }))
  }

  function moveBlock(blockId: string, direction: -1 | 1) {
    setForm((prev) => {
      const idx = prev.blocks.findIndex((b) => b.id === blockId)
      if (idx === -1) return prev
      const target = idx + direction
      if (target < 0 || target >= prev.blocks.length) return prev
      const copy = [...prev.blocks];
      [copy[idx], copy[target]] = [copy[target], copy[idx]]
      return { ...prev, blocks: copy }
    })
  }

  function renderBlockEditor(block: PageBlock, index: number) {
    return (
      <div key={block.id} className="rounded-lg border border-zinc-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 cursor-grab text-zinc-400" />
            <span className="text-xs font-medium uppercase text-zinc-500">{block.type}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => moveBlock(block.id, -1)} disabled={index === 0}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30">
              <ChevronRight className="h-3.5 w-3.5 -rotate-90" />
            </button>
            <button onClick={() => moveBlock(block.id, 1)} disabled={index === form.blocks.length - 1}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30">
              <ChevronRight className="h-3.5 w-3.5 rotate-90" />
            </button>
            <button onClick={() => removeBlock(block.id)} className="rounded p-1 text-red-500 hover:bg-red-50">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-2">
          <label className="block text-xs font-medium text-zinc-500">Blok Türü</label>
          <select value={block.type}
            onChange={(e) => updateBlock(block.id, () => emptyBlock(e.target.value as PageBlock['type']))}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
            {BLOCK_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Type-specific content fields */}
        {block.type === 'hero' && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-500">Başlık</label>
              <input type="text" value={block.content.heading ?? ''}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, heading: e.target.value } }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-500">Alt Başlık</label>
              <input type="text" value={block.content.subtitle ?? ''}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, subtitle: e.target.value } }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Buton Metni</label>
              <input type="text" value={block.content.buttonText ?? ''}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, buttonText: e.target.value } }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Buton URL</label>
              <input type="text" value={block.content.buttonUrl ?? ''}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, buttonUrl: e.target.value } }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-500">Arkaplan Görseli URL</label>
              <input type="text" value={block.content.backgroundImage ?? ''}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, backgroundImage: e.target.value } }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
        )}

        {block.type === 'text' && (
          <div className="mt-3">
            <label className="block text-xs font-medium text-zinc-500">İçerik (HTML)</label>
            <textarea rows={5} value={block.content.body ?? ''}
              onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, body: e.target.value } }))}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        )}

        {block.type === 'image' && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500">Görsel URL</label>
              <input type="text" value={block.content.src ?? ''}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, src: e.target.value } }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Alt Metni</label>
              <input type="text" value={block.content.alt ?? ''}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, alt: e.target.value } }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
        )}

        {block.type === 'gallery' && (
          <div className="mt-3">
            <label className="block text-xs font-medium text-zinc-500">Görseller (URL, her satıra bir)</label>
            <textarea rows={3} value={(block.content.images as string[] ?? []).join('\n')}
              onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, images: e.target.value.split('\n').filter(Boolean) } }))}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        )}

        {block.type === 'products' && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-500">Başlık</label>
              <input type="text" value={block.content.title ?? ''}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, title: e.target.value } }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Gösterim Adedi</label>
              <input type="number" value={block.content.limit ?? 8}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, limit: Number(e.target.value) } }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Düzen</label>
              <select value={block.content.layout ?? 'grid'}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, layout: e.target.value } }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="grid">Grid</option>
                <option value="list">Liste</option>
                <option value="carousel">Carousel</option>
              </select>
            </div>
          </div>
        )}

        {block.type === 'features' && (
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-zinc-500">Özellikler</label>
              <button onClick={() => {
                const items = [...(block.content.items as any[] ?? []), { icon: 'Check', title: '', description: '' }]
                updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, items } }))
              }} className="text-xs text-indigo-600 hover:underline">+ Ekle</button>
            </div>
            <div className="mt-2 space-y-2">
              {(block.content.items as any[] ?? []).map((item, i) => (
                <div key={i} className="rounded border border-zinc-200 p-2">
                  <div className="flex gap-2">
                    <input type="text" value={item.title} placeholder="Başlık"
                      onChange={(e) => {
                        const items = [...(block.content.items as any[])]
                        items[i] = { ...items[i], title: e.target.value }
                        updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, items } }))
                      }}
                      className="flex-1 rounded border border-zinc-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    <input type="text" value={item.description} placeholder="Açıklama"
                      onChange={(e) => {
                        const items = [...(block.content.items as any[])]
                        items[i] = { ...items[i], description: e.target.value }
                        updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, items } }))
                      }}
                      className="flex-1 rounded border border-zinc-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    <button onClick={() => {
                      const items = (block.content.items as any[]).filter((_, idx) => idx !== i)
                      updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, items } }))
                    }} className="text-red-500"><X className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {block.type === 'cta' && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-500">Başlık</label>
              <input type="text" value={block.content.heading ?? ''}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, heading: e.target.value } }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-500">Alt Başlık</label>
              <input type="text" value={block.content.subtitle ?? ''}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, subtitle: e.target.value } }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Buton Metni</label>
              <input type="text" value={block.content.buttonText ?? ''}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, buttonText: e.target.value } }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Buton URL</label>
              <input type="text" value={block.content.buttonUrl ?? ''}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, buttonUrl: e.target.value } }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
        )}

        {block.type === 'contact' && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-500">Başlık</label>
              <input type="text" value={block.content.title ?? ''}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, title: e.target.value } }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">E-posta</label>
              <input type="email" value={block.content.email ?? ''}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, email: e.target.value } }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Telefon</label>
              <input type="text" value={block.content.phone ?? ''}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, phone: e.target.value } }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-500">Adres</label>
              <input type="text" value={block.content.address ?? ''}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, address: e.target.value } }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
        )}

        {block.type === 'html' && (
          <div className="mt-3">
            <label className="block text-xs font-medium text-zinc-500">HTML Kodu</label>
            <textarea rows={6} value={block.content.html ?? ''}
              onChange={(e) => updateBlock(block.id, (b) => ({ ...b, content: { ...b.content, html: e.target.value } }))}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        )}
      </div>
    )
  }

  async function handleSave() {
    if (!form.title.trim()) { setMessage('Sayfa başlığı gerekli'); return }
    setSaving(true)
    setMessage('')
    try {
      const payload = {
        title: { tr: form.title },
        slug: form.slug || generateSlug(form.title),
        content: form.blocks,
        meta: { title: form.meta_title, description: form.meta_description },
        is_active: form.is_active,
      }
      if (form.id) {
        const updated = await api.updatePage(form.id, payload)
        setPages((prev) => prev.map((p) => (p.id === form.id ? updated : p)))
        setMessage('Sayfa güncellendi.')
      } else {
        const created = await api.createPage(payload)
        setPages((prev) => [...prev, created])
        setMessage('Sayfa oluşturuldu.')
      }
      setShowForm(false)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Bu sayfayı silmek istediğine emin misin?')) return
    try {
      await api.deletePage(id)
      setPages((prev) => prev.filter((p) => p.id !== id))
      setMessage('Sayfa silindi.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Hata oluştu')
    }
  }

  if (loading) return <div className="text-sm text-zinc-500">Yükleniyor...</div>

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Sayfalar</h1>
          <p className="mt-1 text-sm text-zinc-600">Site sayfalarını blok düzenleyici ile yönet.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1 h-3 w-3" />Yeni Sayfa
        </Button>
      </div>

      {message && (
        <div className={`mt-4 rounded-lg p-3 text-sm ${
          message.includes('Hata') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>{message}</div>
      )}

      <div className="mt-6 space-y-3">
        {pages.length === 0 && (
          <div className="rounded-xl border border-zinc-200 p-12 text-center text-sm text-zinc-500">
            Henüz sayfa bulunmuyor.
          </div>
        )}
        {pages.map((page) => {
          const title = typeof page.title === 'object' ? (page.title as Record<string, string>).tr ?? '' : String(page.title)
          const blockCount = page.content?.length ?? 0
          return (
            <div key={page.id} className={`rounded-xl border p-4 ${page.is_active ? 'border-zinc-200' : 'border-zinc-200 bg-zinc-50'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-indigo-500" />
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
                    <p className="text-xs text-zinc-500">
                      /{page.slug} · {blockCount} blok · {new Date(page.created_at).toLocaleDateString('tr-TR')}
                      {!page.is_active && <span className="ml-2 text-amber-600">· Taslak</span>}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(page)} className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(page.id)} className="rounded p-1.5 text-zinc-500 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowForm(false)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-zinc-900">
              {form.id ? 'Sayfa Düzenle' : 'Yeni Sayfa'}
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-900">Başlık</label>
                <input type="text" value={form.title}
                  onChange={(e) => {
                    const title = e.target.value
                    setForm((prev) => ({ ...prev, title, slug: prev.id ? prev.slug : generateSlug(title) }))
                  }}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-900">Slug</label>
                <input type="text" value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>

            {/* Blocks */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900">Bloklar</h3>
                <Button size="sm" variant="outline" onClick={addBlock}>
                  <Plus className="mr-1 h-3 w-3" />Blok Ekle
                </Button>
              </div>
              <div className="mt-3 space-y-3">
                {form.blocks.length === 0 && (
                  <p className="text-sm text-zinc-400">Henüz blok eklenmemiş.</p>
                )}
                {form.blocks.map((block, i) => renderBlockEditor(block, i))}
              </div>
            </div>

            {/* Meta Fields */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-zinc-900">SEO (Meta)</h3>
              <div className="mt-2 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-900">Meta Başlık</label>
                  <input type="text" value={form.meta_title}
                    onChange={(e) => setForm((prev) => ({ ...prev, meta_title: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-900">Meta Açıklama</label>
                  <input type="text" value={form.meta_description}
                    onChange={(e) => setForm((prev) => ({ ...prev, meta_description: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                <input type="checkbox" checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500" />
                Aktif
              </label>
            </div>

            <div className="mt-6 flex gap-2">
              <Button onClick={handleSave} disabled={saving || !form.title.trim()}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>İptal</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
