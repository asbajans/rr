'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { BlogPost } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Newspaper, Plus, Pencil, Trash2, Search, Sparkles, X } from 'lucide-react'
import { CardSkeleton, EmptyState } from '@/components/ui/skeleton'

type FormState = {
  id: number | null
  title: string
  slug: string
  excerpt: string
  content: string
  cover_image: string
  author: string
  tags: string
  is_active: boolean
  published_at: string
  seo_title: string
  seo_description: string
}

const defaultForm: FormState = {
  id: null, title: '', slug: '', excerpt: '', content: '', cover_image: '',
  author: '', tags: '', is_active: true, published_at: '', seo_title: '', seo_description: '',
}

function slugify(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function BlogPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(defaultForm)

  // AI generation
  const [genMode, setGenMode] = useState<'topic' | 'product'>('topic')
  const [genTopic, setGenTopic] = useState('')
  const [genProductId, setGenProductId] = useState('')
  const [genNotes, setGenNotes] = useState('')
  const [genKeywords, setGenKeywords] = useState('')
  const [generating, setGenerating] = useState(false)
  const [products, setProducts] = useState<any[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true)
    try {
      const r = await api.getBlogs({ page: p, limit: 20, search: q || undefined })
      setPosts(r.data)
      setTotalPages(r.last_page || 1)
    } catch {
      setMessage('Blog yazıları yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(1, '') }, [load])
  useEffect(() => { if (user) api.getProducts({ limit: 100 }).then(r => setProducts(r.data)).catch(() => {}) }, [user])

  if (!user) return null

  function openNew() {
    setForm({ ...defaultForm, published_at: new Date().toISOString().slice(0, 10) })
    setGenTopic(''); setGenProductId(''); setGenNotes(''); setGenKeywords(''); setGenMode('topic')
    setShowForm(true)
  }

  function openEdit(post: BlogPost) {
    setForm({
      id: post.id,
      title: post.title ?? '',
      slug: post.slug ?? '',
      excerpt: post.excerpt ?? '',
      content: post.content ?? '',
      cover_image: post.cover_image ?? '',
      author: post.author ?? '',
      tags: Array.isArray(post.tags) ? post.tags.join(', ') : '',
      is_active: post.is_active ?? true,
      published_at: post.published_at ? post.published_at.slice(0, 10) : '',
      seo_title: (post.meta?.seo_title as string) ?? '',
      seo_description: (post.meta?.seo_description as string) ?? '',
    })
    setShowForm(true)
  }

  async function save() {
    if (!form.title.trim()) { setMessage('Başlık gereklidir'); return }
    setSaving(true)
    setMessage('')
    try {
      const payload = {
        title: form.title,
        slug: form.slug || slugify(form.title),
        excerpt: form.excerpt,
        content: form.content,
        cover_image: form.cover_image,
        author: form.author,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        is_active: form.is_active,
        published_at: form.published_at || new Date().toISOString(),
        meta: {
          seo_title: form.seo_title || form.title.slice(0, 60),
          seo_description: form.seo_description || form.excerpt || form.title.slice(0, 160),
        },
      }
      if (form.id) {
        await api.updateBlog(form.id, payload)
      } else {
        await api.createBlog(payload)
      }
      setMessage('Blog yazısı kaydedildi')
      setShowForm(false)
      load(page, search)
    } catch (e: any) {
      setMessage(e.message || 'Kaydetme hatası')
    } finally {
      setSaving(false)
    }
  }

  async function remove(post: BlogPost) {
    if (!window.confirm(`"${post.title}" yazısını silmek istediğinize emin misiniz?`)) return
    try {
      await api.deleteBlog(post.id)
      load(page, search)
    } catch (e: any) {
      setMessage(e.message || 'Silme hatası')
    }
  }

  async function generate() {
    if (genMode === 'topic' && !genTopic.trim()) { setMessage('Üretim için bir konu girin'); return }
    if (genMode === 'product' && !genProductId) { setMessage('Üretim için bir ürün seçin'); return }
    setGenerating(true)
    setMessage('')
    try {
      const draft = await api.generateBlog({
        topic: genMode === 'topic' ? genTopic.trim() : undefined,
        productId: genMode === 'product' ? Number(genProductId) : null,
        notes: genNotes || undefined,
        keywords: genKeywords.split(',').map(k => k.trim()).filter(Boolean),
      })
      setForm(prev => ({
        ...prev,
        title: draft.title || prev.title,
        slug: draft.slug || prev.slug,
        excerpt: draft.excerpt || prev.excerpt,
        content: draft.content || prev.content,
        seo_title: draft.seo_title || prev.seo_title,
        seo_description: draft.seo_description || prev.seo_description,
        tags: draft.tags?.length ? draft.tags.join(', ') : prev.tags,
      }))
      setMessage('AI taslağı oluşturuldu — inceleyip kaydedin')
    } catch (e: any) {
      setMessage(e.message || 'AI üretimi başarısız')
    } finally {
      setGenerating(false)
    }
  }

  async function uploadCover(file: File) {
    try {
      const uploaded = await api.uploadImage(file)
      setForm(prev => ({ ...prev, cover_image: uploaded.url }))
    } catch (e: any) {
      setMessage(e.message || 'Görsel yükleme hatası')
    }
  }

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Blog</h1>
          <p className="text-sm text-zinc-400">Mağaza blog yazılarını yönetin, AI ile SEO uyumlu yazı üretin.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Yeni Yazı</Button>
      </div>

      {message && <p className="mt-3 text-sm text-amber-400">{message}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            onKeyDown={e => { if (e.key === 'Enter') load(1, search) }}
            placeholder="Yazı ara..."
            className="rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => load(1, search)}>Ara</Button>
      </div>

      {loading ? (
        <CardSkeleton />
      ) : posts.length === 0 ? (
        <EmptyState icon={<Newspaper className="h-8 w-8" />} title="Henüz blog yazısı yok" description="İlk yazınızı oluşturun veya AI ile üretin." />
      ) : (
        <div className="table-scroll mt-5">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                <th className="px-3 py-2">Başlık</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Yayın Tarihi</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/40">
                  <td className="px-3 py-3 font-medium text-zinc-200">{post.title}</td>
                  <td className="px-3 py-3 text-zinc-400">/{post.slug}</td>
                  <td className="px-3 py-3 text-zinc-400">{post.published_at ? new Date(post.published_at).toLocaleDateString('tr-TR') : '—'}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${post.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-700 text-zinc-300'}`}>
                      {post.is_active ? 'Aktif' : 'Taslak'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(post)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(post)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && posts.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-zinc-500">Sayfa {page}/{totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1, search) }}>Önceki</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => { setPage(page + 1); load(page + 1, search) }}>Sonraki</Button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
          <div className="card mt-8 w-full max-w-3xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{form.id ? 'Yazıyı Düzenle' : 'Yeni Blog Yazısı'}</h2>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            {/* AI generation */}
            <div className="mt-5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
                <Sparkles className="h-4 w-4" /> AI ile Yazı Üret
              </div>
              <div className="mt-3 flex gap-4">
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input type="radio" checked={genMode === 'topic'} onChange={() => setGenMode('topic')} className="accent-indigo-500" /> Konu ile
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input type="radio" checked={genMode === 'product'} onChange={() => setGenMode('product')} className="accent-indigo-500" /> Ürün ile
                </label>
              </div>
              {genMode === 'topic' ? (
                <input
                  value={genTopic} onChange={e => setGenTopic(e.target.value)}
                  placeholder="Örn: Altın takı bakım rehberi, kış cilt bakımı ipuçları..."
                  className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              ) : (
                <select
                  value={genProductId} onChange={e => setGenProductId(e.target.value)}
                  className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Ürün seçin...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.label || p.title || p.code}</option>)}
                </select>
              )}
              <textarea
                value={genNotes} onChange={e => setGenNotes(e.target.value)}
                placeholder="Satıcı notu (opsiyonel): yazıda vurgulanması istenenler"
                rows={2}
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
              <input
                value={genKeywords} onChange={e => setGenKeywords(e.target.value)}
                placeholder="Anahtar kelimeler (opsiyonel, virgülle): altın, takı, bakım"
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
              <Button onClick={generate} disabled={generating} className="mt-3">
                <Sparkles className="mr-2 h-4 w-4" /> {generating ? 'Üretiliyor...' : 'Taslak Üret'}
              </Button>
              <p className="mt-2 text-xs text-zinc-500">Üretim AI kredisi kullanır (planınızdaki AI Blog Üretimi modülüne göre).</p>
            </div>

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-400">Başlık *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-400">Slug</label>
                  <input value={form.slug} onChange={e => setForm({ ...form, slug: slugify(e.target.value) })}
                    placeholder={slugify(form.title) || 'url-dostu-adres'}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-400">Yayın Tarihi</label>
                  <input type="date" value={form.published_at} onChange={e => setForm({ ...form, published_at: e.target.value })}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white [color-scheme:dark] focus:border-zinc-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-400">Kapak Görseli</label>
                <div className="flex items-center gap-2">
                  <input value={form.cover_image} onChange={e => setForm({ ...form, cover_image: e.target.value })}
                    placeholder="https://... veya yükle"
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none" />
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover(f) }} />
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Yükle</Button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-400">Yazar</label>
                  <input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-400">Etiketler (virgülle)</label>
                  <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-400">Özet (excerpt)</label>
                <textarea value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} rows={2}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-400">İçerik (HTML)</label>
                <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={10}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-xs text-white focus:border-zinc-500 focus:outline-none" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-400">SEO Başlığı</label>
                  <input value={form.seo_title} onChange={e => setForm({ ...form, seo_title: e.target.value })}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-400">SEO Açıklaması</label>
                  <input value={form.seo_description} onChange={e => setForm({ ...form, seo_description: e.target.value })}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="accent-indigo-500" />
                Yayında (aktif)
              </label>
            </div>

            <div className="mt-6 flex gap-2">
              <Button onClick={save} disabled={saving} className="flex-1">{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Vazgeç</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}