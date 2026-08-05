'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import { Wand2, Loader2, Check, Coins, ArrowUpRight, ImageUp, RotateCcw, ShieldCheck, Send } from 'lucide-react'

const ALL_CHANNELS = [
  { key: 'storefront', n: 'Mağaza' },
  { key: 'trendyol', n: 'Trendyol' },
  { key: 'n11', n: 'N11' },
  { key: 'hepsiburada', n: 'Hepsiburada' },
  { key: 'pazarama', n: 'Pazarama' },
  { key: 'amazon', n: 'Amazon' },
  { key: 'etsy', n: 'Etsy' },
]

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  published: { text: 'Yayınlandı', cls: 'bg-green-900/50 text-green-400' },
  queued: { text: 'Kuyrukta', cls: 'bg-blue-900/50 text-blue-400' },
  skipped: { text: 'Atlandı', cls: 'bg-amber-900/50 text-amber-400' },
  failed: { text: 'Başarısız', cls: 'bg-red-900/50 text-red-400' },
}

const CHANNEL_STATUS: Record<string, { text: string; cls: string }> = {
  ready: { text: 'Yayına hazır', cls: 'bg-green-900/50 text-green-400' },
  'integration-not-connected': { text: 'Entegrasyon bağlı değil', cls: 'bg-amber-900/50 text-amber-400' },
  'category-mapping-needed': { text: 'Kategori eşlemesi eksik', cls: 'bg-violet-900/50 text-violet-400' },
  'missing-fields': { text: 'Eksik alanlar', cls: 'bg-red-900/50 text-red-400' },
}

const LISTING_STATUS: Record<string, { text: string; cls: string }> = {
  active: { text: 'Aktif', cls: 'bg-green-900/50 text-green-400' },
  publishing: { text: 'Yayınlanıyor', cls: 'bg-blue-900/50 text-blue-400' },
  pending: { text: 'Beklemede', cls: 'bg-amber-900/50 text-amber-400' },
  failed: { text: 'Başarısız', cls: 'bg-red-900/50 text-red-400' },
  inactive: { text: 'Pasif', cls: 'bg-zinc-800 text-zinc-400' },
  deleted: { text: 'Silindi', cls: 'bg-zinc-800 text-zinc-400' },
}

export default function AiStudioPage() {
  const { user, can, refreshMe } = useAuth()
  const router = useRouter()
  const [gate, setGate] = useState<'product' | 'credits' | null>(null)

  // Create session
  const [rawFile, setRawFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [category, setCategory] = useState('diger')
  const [notes, setNotes] = useState({ short_description: '', keywords: '' })
  const [suggestPrice, setSuggestPrice] = useState(true)
  const [targetMps, setTargetMps] = useState<string[]>(['trendyol', 'n11'])
  const [creating, setCreating] = useState(false)

  // Draft
  const [draft, setDraft] = useState<any | null>(null)
  const [form, setForm] = useState({ title: '', category: '', short_description: '', description: '', keywords: '', price: '', stock: '10', sku: '' })
  const [saving, setSaving] = useState(false)
  const [drafts, setDrafts] = useState<any[]>([])

  // Channels / publish
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [validation, setValidation] = useState<any[]>([])
  const [validating, setValidating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishResults, setPublishResults] = useState<any[]>([])
  const [listings, setListings] = useState<any[]>([])
  const [retrying, setRetrying] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadDrafts = useCallback(async () => {
    try {
      setDrafts(await api.listAiProductDrafts())
    } catch {
      setDrafts([])
    }
  }, [])

  useEffect(() => {
    if (can('ai_product_create')) loadDrafts()
  }, [can, loadDrafts])

  const loadPublishState = useCallback(async (draftId: number) => {
    try {
      const st = await api.getAiProductPublishState(draftId)
      setListings(st.listings || [])
      return st
    } catch {
      return null
    }
  }, [])

  if (!user) return null

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setRawFile(f)
    setPreview(URL.createObjectURL(f))
    setDraft(null)
    setValidation([])
    setPublishResults([])
    setListings([])
    setError('')
    setSuccess('')
  }

  function toggleChannel(c: string) {
    setSelectedChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
    setValidation([])
  }

  function setFormFromDraft(d: any) {
    setForm({
      title: d.title || '',
      category: (d.categoryPath || []).join(' > '),
      short_description: d.shortDescription || '',
      description: d.description || '',
      keywords: (d.keywords || []).join(', '),
      price: d.suggestedPrice != null ? String(d.suggestedPrice) : '',
      stock: d.quantity != null ? String(d.quantity) : '10',
      sku: d.sku || '',
    })
  }

  async function openDraft(id: number) {
    setError('')
    setSuccess('')
    try {
      const d = await api.getAiProductDraft(id)
      setDraft(d)
      setFormFromDraft(d)
      setValidation([])
      setPublishResults([])
      setListings([])
      loadPublishState(id)
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Taslak yüklenemedi')
    }
  }

  async function handleRun() {
    if (!rawFile) return
    setCreating(true)
    setError('')
    setSuccess('')
    try {
      const uploaded = await api.uploadImage(rawFile)
      const { session, draft: d } = await api.createAiProductSession({
        sourceImageUrl: uploaded.url,
        category: category !== 'diger' ? category : undefined,
        short_description: notes.short_description || undefined,
        keywords: notes.keywords ? notes.keywords.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        suggest_price: suggestPrice,
        target_marketplaces: targetMps,
      })

      let draftData = d
      if (!draftData) {
        for (let i = 0; i < 12; i++) {
          await new Promise(r => setTimeout(r, 2500))
          const st = await api.getAiProductSessionStatus(session.id)
          if (st.status === 'review' || st.status === 'approved' || st.status === 'completed') {
            const g = await api.getAiProductSession(session.id)
            draftData = g.draft
            break
          }
          if (st.status === 'failed') throw new Error(st.errorMessage || 'AI analizi başarısız')
        }
      }
      if (!draftData) throw new Error('Taslak hazırlanamadı')

      setDraft(draftData)
      setFormFromDraft(draftData)
      loadPublishState(draftData.id)
      loadDrafts()
      refreshMe()
    } catch (err: any) {
      if (err?.code === 'INSUFFICIENT_CREDITS') { setGate('credits'); refreshMe() }
      else setError(err instanceof Error ? err.message : 'İlan hazırlama başarısız')
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveDraft() {
    if (!draft) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const updated = await api.updateAiProductDraft(draft.id, {
        title: form.title,
        description: form.description,
        shortDescription: form.short_description,
        categoryPath: form.category.split(' > ').map(s => s.trim()).filter(Boolean),
        sku: form.sku,
        suggestedPrice: form.price ? parseFloat(form.price) : undefined,
        quantity: form.stock ? parseInt(form.stock) : undefined,
        keywords: form.keywords.split(',').map(s => s.trim()).filter(Boolean),
      })
      setDraft(updated)
      setSuccess('Taslak kaydedildi')
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Taslak kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  async function handleValidate() {
    if (!draft || selectedChannels.length === 0) return
    setValidating(true)
    setError('')
    try {
      setValidation(await api.validateAiProductChannels(draft.id, selectedChannels))
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Doğrulama başarısız')
    } finally {
      setValidating(false)
    }
  }

  async function handleApprove() {
    if (!draft) return
    setSaving(true)
    setError('')
    try {
      const updated = await api.approveAiProductDraft(draft.id)
      setDraft(updated)
      setSuccess('Taslak onaylandı')
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Onaylama başarısız')
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    if (!draft || selectedChannels.length === 0) return
    setPublishing(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.publishAiProductDraft(draft.id, selectedChannels)
      setPublishResults(res.results || [])
      loadPublishState(draft.id)
      loadDrafts()
      refreshMe()
      setSuccess('Yayın kuyruğa alındı')
    } catch (err: any) {
      if (err?.code === 'PLAN_PRODUCT_LIMIT') setGate('product')
      else setError(err instanceof Error ? err.message : 'Yayınlama başarısız')
    } finally {
      setPublishing(false)
    }
  }

  async function handleRetry() {
    if (!draft) return
    const failed = listings.filter(l => l.status === 'failed').map(l => l.channel || l.platform)
    if (failed.length === 0) return
    setRetrying(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.retryAiProductPublish(draft.id, failed)
      setPublishResults(res.results || [])
      loadPublishState(draft.id)
      setSuccess(`Tekrar deneniyor (${res.retried})`)
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Tekrar deneme başarısız')
    } finally {
      setRetrying(false)
    }
  }

  const failedCount = listings.filter(l => l.status === 'failed').length

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Stüdyosu</h1>
          <p className="mt-1 text-sm text-zinc-400">Fotoğraf → AI taslağı → kanallara yayınla.</p>
        </div>
        {user.ai_credits != null && <p className="text-xs text-zinc-500">Kalan kredi: {user.ai_credits}</p>}
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-900/50 p-3 text-sm text-red-400">{error}</div>}
      {success && <div className="mt-4 rounded-lg bg-green-900/50 p-3 text-sm text-green-400">{success}</div>}

      {!can('ai_product_create') ? (
        <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-center">
          <p className="text-sm text-zinc-400">Bu modül planınızda kapalı.</p>
          <button onClick={() => router.push('/billing')} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-zinc-700 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-600">
            Üst Pakete Geç <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          {/* Saved drafts */}
          {drafts.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-zinc-400">Taslaklarım</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {drafts.map(d => (
                  <button key={d.id} onClick={() => openDraft(d.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${draft?.id === d.id ? 'border-violet-500 bg-violet-600 text-white' : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'}`}>
                    #{d.id} — {d.title?.slice(0, 40) || 'Taslak'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 1. Upload + options */}
            <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
              <div className="flex items-center gap-3">
                <Wand2 className="h-5 w-5 text-violet-400" />
                <h2 className="text-lg font-semibold text-white">1. Görsel & Seçenekler</h2>
              </div>
              <p className="mt-1 text-sm text-zinc-400">Fotoğrafı yükle, AI ilanı uçtan uca hazırlasın.</p>

              <div className="mt-4">
                <label className="text-xs font-medium text-zinc-400">Kategori</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white">
                  <option value="giyim">Giyim</option>
                  <option value="taki">Takı</option>
                  <option value="kozmetik">Kozmetik</option>
                  <option value="ayakkabi">Ayakkabı</option>
                  <option value="canta">Çanta</option>
                  <option value="elektronik">Elektronik</option>
                  <option value="ev_dekorasyon">Ev Dekorasyon</option>
                  <option value="spor">Spor</option>
                  <option value="diger">Diğer</option>
                </select>
              </div>

              <div className="mt-4">
                <input type="file" accept="image/*" onChange={handleFile}
                  className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-violet-500" />
              </div>
              {preview && <img src={preview} alt="Preview" className="mt-4 max-h-48 rounded-lg border border-zinc-700 object-cover" />}

              <div className="mt-4 grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-400">Kısa Açıklama (opsiyonel)</label>
                  <input value={notes.short_description} onChange={e => setNotes({ ...notes, short_description: e.target.value })}
                    placeholder="Satıcı notu / kısa bilgi"
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400">Anahtar Kelimeler (opsiyonel)</label>
                  <input value={notes.keywords} onChange={e => setNotes({ ...notes, keywords: e.target.value })}
                    placeholder="virgülle ayır"
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                </div>
              </div>

              <div className="mt-4">
                <label className="text-xs font-medium text-zinc-400">Hedef Kanallar</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ALL_CHANNELS.map(o => (
                    <button key={o.key} type="button" onClick={() => setTargetMps(prev => prev.includes(o.key) ? prev.filter(x => x !== o.key) : [...prev, o.key])}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium border ${targetMps.includes(o.key) ? 'bg-violet-600 border-violet-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                      {o.n}
                    </button>
                  ))}
                </div>
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={suggestPrice} onChange={e => setSuggestPrice(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-800" />
                Fiyat aralığı öner
              </label>

              <button onClick={handleRun} disabled={!rawFile || creating}
                className="mt-4 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {creating ? 'İlan Hazırlanıyor...' : 'İlanı Hazırla'}
              </button>
            </div>

            {/* 2. Draft + Publish */}
            <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
              <h2 className="text-lg font-semibold text-white">2. Taslak & Yayın</h2>
              <p className="mt-1 text-sm text-zinc-400">AI taslağını düzenle, kanalları doğrula ve yayınla.</p>

              {!draft && !creating && (
                <div className="mt-8 flex flex-col items-center gap-2 text-zinc-500">
                  <ImageUp className="h-10 w-10" />
                  <p className="text-sm">Görsel yükle ve &quot;İlanı Hazırla&quot;ya bas.</p>
                </div>
              )}
              {creating && (
                <div className="mt-8 flex flex-col items-center gap-2 text-zinc-400">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                  <p className="text-sm">Görsel analiz edilip ilan oluşturuluyor...</p>
                </div>
              )}

              {draft && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Başlık</label>
                    <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-zinc-400">Kategori Yolu</label>
                      <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                        placeholder="Kategori > Alt Kategori"
                        className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-400">SKU / Kod</label>
                      <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })}
                        className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-zinc-400">Fiyat (₺)</label>
                      <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                        className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-400">Stok</label>
                      <input type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })}
                        className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Kısa Açıklama</label>
                    <textarea value={form.short_description} onChange={e => setForm({ ...form, short_description: e.target.value })} rows={2}
                      className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Açıklama</label>
                    <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={5}
                      className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Anahtar Kelimeler</label>
                    <input value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })}
                      placeholder="virgülle ayır"
                      className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                  </div>

                  {draft.confidence && Object.keys(draft.confidence).length > 0 && (
                    <details className="rounded-lg border border-zinc-700 bg-zinc-800">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-400">AI Güven Skorları</summary>
                      <div className="border-t border-zinc-700 px-3 py-2 text-xs text-zinc-500">
                        {Object.entries(draft.confidence).map(([k, v]) => <p key={k}>{k}: {Math.round((v as number) * 100)}%</p>)}
                      </div>
                    </details>
                  )}

                  <button onClick={handleSaveDraft} disabled={saving}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600 disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Taslağı Kaydet
                  </button>

                  {/* Channels */}
                  <div className="mt-2 border-t border-zinc-700 pt-4">
                    <p className="text-xs font-medium text-zinc-400">Yayınlanacak Kanallar</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ALL_CHANNELS.map(o => (
                        <button key={o.key} type="button" onClick={() => toggleChannel(o.key)}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium border ${selectedChannels.includes(o.key) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                          {o.n}
                        </button>
                      ))}
                    </div>
                    <button onClick={handleValidate} disabled={validating || selectedChannels.length === 0}
                      className="mt-3 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50">
                      {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      Kanalları Doğrula
                    </button>
                  </div>

                  {validation.length > 0 && (
                    <div className="space-y-1.5">
                      {validation.map(v => {
                        const s = CHANNEL_STATUS[v.status] || CHANNEL_STATUS['missing-fields']
                        return (
                          <div key={v.channel} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-800 px-3 py-2">
                            <span className="text-xs text-zinc-300">{v.channel}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
                              {s.text}{v.status === 'missing-fields' && v.missingFields?.length ? ` (${v.missingFields.join(', ')})` : ''}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Publish + approve */}
                  <div className="mt-2 flex gap-2">
                    <button onClick={handleApprove} disabled={saving}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
                      <Check className="h-4 w-4" /> Onayla
                    </button>
                    <button onClick={handlePublish} disabled={publishing || selectedChannels.length === 0}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50">
                      {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {publishing ? 'Yayınlanıyor...' : 'Yayınla'}
                    </button>
                  </div>

                  {publishResults.length > 0 && (
                    <div className="space-y-1.5">
                      {publishResults.map(r => {
                        const s = STATUS_LABEL[r.status] || STATUS_LABEL['failed']
                        return (
                          <div key={r.channel} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-800 px-3 py-2">
                            <span className="text-xs text-zinc-300">{r.channel}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
                              {s.text}{r.error ? ` — ${r.error}` : r.externalId ? ` (${r.externalId})` : ''}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Listing state */}
                  {listings.length > 0 && (
                    <div className="mt-2 border-t border-zinc-700 pt-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-zinc-400">Yayın Durumu</p>
                        {failedCount > 0 && (
                          <button onClick={handleRetry} disabled={retrying}
                            className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-amber-500 disabled:opacity-50">
                            {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                            Tekrar Dene ({failedCount})
                          </button>
                        )}
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {listings.map(l => {
                          const s = LISTING_STATUS[l.status] || LISTING_STATUS['pending']
                          return (
                            <div key={l.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-800 px-3 py-2">
                              <span className="text-xs text-zinc-300">{l.channel || l.platform}{l.externalId ? ` · ${l.externalId}` : ''}</span>
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>{s.text}</span>
                                {l.retryCount > 0 && <span className="text-[10px] text-zinc-500">×{l.retryCount}</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {listings.some(l => l.lastError) && (
                        <details className="mt-2 rounded-lg border border-zinc-700 bg-zinc-800">
                          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-400">Son Hatalar</summary>
                          <div className="border-t border-zinc-700 px-3 py-2 text-xs text-red-400">
                            {listings.filter(l => l.lastError).map(l => (
                              <p key={l.id} className="mt-1">{l.channel || l.platform}: {l.lastError}</p>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {gate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-[420px] max-w-full rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <div className="mb-2 flex items-center gap-3">
              {gate === 'credits' ? <Coins className="h-6 w-6 text-indigo-400" /> : <Wand2 className="h-6 w-6 text-indigo-400" />}
              <h3 className="text-lg font-semibold text-white">{gate === 'credits' ? 'AI Kredisi Yetersiz' : 'Ürün Limiti Doldu'}</h3>
            </div>
            <p className="mb-4 text-sm text-zinc-400">
              {gate === 'credits'
                ? 'Devam etmek için yeterli AI krediniz yok. Kredi satın alın veya üst pakete geçin.'
                : 'Planınızdaki ürün limitine ulaştınız. Daha fazla ürün eklemek için üst pakete geçin.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setGate(null)} className="rounded border border-zinc-600 px-4 py-1.5 text-sm text-zinc-300">Vazgeç</button>
              {gate === 'credits' && (
                <button onClick={() => router.push('/credits')} className="flex items-center gap-1 rounded bg-indigo-600 px-4 py-1.5 text-sm text-white">
                  Kredi Satın Al <ArrowUpRight className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => router.push('/billing')} className="flex items-center gap-1 rounded bg-white px-4 py-1.5 text-sm text-black">
                Üst Pakete Geç <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
