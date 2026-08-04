'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { api, API_BASE } from '@/lib/api-client'
import { Sparkles, ImageUp, Loader2, Check, Coins, ArrowUpRight, Wand2 } from 'lucide-react'

interface AiAnalysis {
  title: string
  description: string
  short_description: string
  slug: string
  meta_title: string
  meta_description: string
  keywords: string[]
  specs: { material: string; color: string; type: string; style: string; category: string }
}

export default function AiPage() {
  const { user, can, refreshMe } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<'remove-bg' | 'creator' | 'agentic'>('remove-bg')
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [gate, setGate] = useState<'product' | 'credits' | null>(null)

  // Product creator
  const [creatorFile, setCreatorFile] = useState<string | null>(null)
  const [creatorRawFile, setCreatorRawFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [productForm, setProductForm] = useState({
    code: '',
    label: '',
    price: '',
    stock: '',
    description: '',
  })

  // Agentic listing
  const [agenticRawFile, setAgenticRawFile] = useState<File | null>(null)
  const [agenticPreview, setAgenticPreview] = useState<string | null>(null)
  const [agenticNotes, setAgenticNotes] = useState({ short_description: '', keywords: '' })
  const [agenticMps, setAgenticMps] = useState<string[]>(['trendyol', 'n11'])
  const [agenticSuggestPrice, setAgenticSuggestPrice] = useState(true)
  const [agenticLoading, setAgenticLoading] = useState(false)
  const [agenticDraft, setAgenticDraft] = useState<AiAnalysis & {
    category: string
    attributes: Record<string, string>
    bullet_points: string[]
    price_suggestion: { min: number; max: number; currency: string; rationale: string } | null
  } | null>(null)
  const [agenticForm, setAgenticForm] = useState({ title: '', category: 'diger', short_description: '', description: '', keywords: '', price: '', stock: '10' })

  if (!user) return null

  async function handleRemoveBg() {
    if (!file) return
    setProcessing(true)
    setError('')
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('images', file)
      fd.append('action', 'remove-background')
      const res = await api.processImage(fd)
      
      // Poll for result
      let attempts = 0
      let imageUrl: string | null = null
      while (attempts < 30) {
        await new Promise(r => setTimeout(r, 2000))
        const status = await api.getAiStatus(res.sessionId)
        if (status.ready && status.ready.length > 0) {
          imageUrl = `${API_BASE}/api/ai/output/${encodeURIComponent(res.sessionId)}/${encodeURIComponent(status.ready[0])}`
          break
        }
        attempts++
      }
      setResult(imageUrl)
      refreshMe()
    } catch (err: any) {
      if (err?.code === 'INSUFFICIENT_CREDITS') { setGate('credits'); refreshMe() }
      else setError(err instanceof Error ? err.message : 'İşlem başarısız')
    } finally {
      setProcessing(false)
    }
  }

  function handleCreatorFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setCreatorRawFile(f)
    setCreatorFile(URL.createObjectURL(f))
    setAnalysis(null)
    setSuccess('')
  }

  async function handleAnalyze() {
    if (!creatorRawFile) return
    setAnalyzing(true)
    setError('')
    setSuccess('')
    try {
      const fd = new FormData()
      fd.append('image', creatorRawFile)
      const res = await api.analyzeProduct(fd)
      setAnalysis(res)
      setProductForm({
        code: res.slug || res.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 32),
        label: res.title,
        price: '',
        stock: '10',
        description: res.description,
      })
      refreshMe()
    } catch (err: any) {
      if (err?.code === 'INSUFFICIENT_CREDITS') { setGate('credits'); refreshMe() }
      else setError(err instanceof Error ? err.message : 'Analiz başarısız')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleCreateProduct() {
    if (!analysis) return    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.createProduct({
        sku: productForm.code,
        title: productForm.label,
        priceTRY: parseFloat(productForm.price) || undefined,
        quantity: parseInt(productForm.stock) || undefined,
        description: productForm.description,
      })
      setSuccess(`Ürün oluşturuldu! ID: ${res.id}`)
      setProductForm({ code: '', label: '', price: '', stock: '10', description: '' })
      setAnalysis(null)
      setCreatorFile(null)
      setCreatorRawFile(null)
    } catch (err: any) {
      if (err?.code === 'PLAN_PRODUCT_LIMIT') { setGate('product') }
      else setError(err instanceof Error ? err.message : 'Ürün oluşturma başarısız')
    } finally {
      setSaving(false)
    }
  }

  function handleAgenticFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setAgenticRawFile(f)
    setAgenticPreview(URL.createObjectURL(f))
    setAgenticDraft(null)
    setSuccess('')
  }

  function toggleMp(mp: string) {
    setAgenticMps(prev => prev.includes(mp) ? prev.filter(m => m !== mp) : [...prev, mp])
  }

  async function handleAgenticRun() {
    if (!agenticRawFile) return
    setAgenticLoading(true)
    setError('')
    setSuccess('')
    try {
      const uploaded = await api.uploadImage(agenticRawFile)
      const res = await api.agenticListing({
        imageUrl: uploaded.url,
        category: agenticForm.category,
        short_description: agenticNotes.short_description || undefined,
        keywords: agenticNotes.keywords || undefined,
        suggest_price: agenticSuggestPrice,
        target_marketplaces: agenticMps,
      })
      setAgenticDraft(res)
      const mid = res.price_suggestion ? Math.round((res.price_suggestion.min + res.price_suggestion.max) / 2) : ''
      setAgenticForm({
        title: res.title,
        category: res.category || 'diger',
        short_description: res.short_description,
        description: res.description,
        keywords: res.keywords.join(', '),
        price: mid ? String(mid) : '',
        stock: '10',
      })
      refreshMe()
    } catch (err: any) {
      if (err?.code === 'INSUFFICIENT_CREDITS') { setGate('credits'); refreshMe() }
      else setError(err instanceof Error ? err.message : 'İlan hazırlama başarısız')
    } finally {
      setAgenticLoading(false)
    }
  }

  async function handleAgenticCreate() {
    if (!agenticDraft) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.createProduct({
        sku: agenticForm.title.toLowerCase().replace(/[^a-z0-9çğıöşü]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || `urun-${Date.now()}`,
        title: agenticForm.title,
        categoryId: undefined,
        priceTRY: parseFloat(agenticForm.price) || undefined,
        quantity: parseInt(agenticForm.stock) || 0,
        description: agenticForm.description,
        marketplaces: agenticMps,
      })
      setSuccess(`Ürün oluşturuldu! ID: ${res.id}`)
      setAgenticDraft(null)
      setAgenticForm({ title: '', category: 'diger', short_description: '', description: '', keywords: '', price: '', stock: '10' })
      setAgenticPreview(null)
      setAgenticRawFile(null)
    } catch (err: any) {
      if (err?.code === 'PLAN_PRODUCT_LIMIT') { setGate('product') }
      else setError(err instanceof Error ? err.message : 'Ürün oluşturma başarısız')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <h1 className="text-2xl font-bold text-white">AI Araçları</h1>
      <p className="mt-1 text-sm text-zinc-400">AI ile görsel işleme ve ürün oluşturma.</p>

      <div className="mt-4 flex gap-2 overflow-x-auto border-b border-zinc-700">
        <button onClick={() => setTab('remove-bg')} className={`whitespace-nowrap px-4 py-2 text-sm font-medium ${tab === 'remove-bg' ? 'border-b-2 border-white text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
          Görsel İşleme
        </button>
        <button onClick={() => setTab('creator')} className={`whitespace-nowrap px-4 py-2 text-sm font-medium ${tab === 'creator' ? 'border-b-2 border-white text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
          AI Ürün Oluşturucu
        </button>
        <button onClick={() => setTab('agentic')} className={`whitespace-nowrap px-4 py-2 text-sm font-medium ${tab === 'agentic' ? 'border-b-2 border-white text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
          Agentik İlan
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-900/50 p-3 text-sm text-red-400">{error}</div>}
      {success && <div className="mt-4 rounded-lg bg-green-900/50 p-3 text-sm text-green-400">{success}</div>}

      {tab === 'remove-bg' && (
        <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-900 p-6">
          {!can('ai_image_generate') ? (
            <div className="text-center py-6">
              <p className="text-sm text-zinc-400">Bu modül planınızda kapalı.</p>
              <button onClick={() => router.push('/billing')} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-zinc-700 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-600">
                Üst Pakete Geç <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
          <>
          <div className="flex items-center gap-3">
            <ImageUp className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Arka Plan Temizleme</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-400">Ürün görsellerinin arka planını AI ile temizle.</p>
          <div className="mt-4">
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-500" />
          </div>
          <button onClick={handleRemoveBg} disabled={!file || processing}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            {processing ? 'İşleniyor...' : 'İşle'}
          </button>
          {result && (
            <div className="mt-4">
              <p className="text-sm font-medium text-green-400">İşlem tamamlandı!</p>
              <img src={result} alt="Result" className="mt-2 max-h-48 rounded-lg border border-zinc-700" />
            </div>
          )}
          <p className="mt-4 text-xs text-zinc-500">Kalan kredi: {user.ai_credits}</p>
          </>
          )}
        </div>
      )}

      {tab === 'creator' && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {!can('ai_product_create') ? (
            <div className="col-span-full rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-center">
              <p className="text-sm text-zinc-400">Bu modül planınızda kapalı.</p>
              <button onClick={() => router.push('/billing')} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-zinc-700 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-600">
                Üst Pakete Geç <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
          <>
          {/* Upload + Analyze */}
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Görsel Yükle</h2>
            </div>
            <p className="mt-1 text-sm text-zinc-400">Ürün görselini yükle, AI analiz etsin.</p>
            <div className="mt-4">
              <input type="file" accept="image/*" onChange={handleCreatorFile}
                className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-500" />
            </div>
            {creatorFile && (
              <img src={creatorFile} alt="Preview" className="mt-4 max-h-48 rounded-lg border border-zinc-700 object-cover" />
            )}
            <button onClick={handleAnalyze} disabled={!creatorRawFile || analyzing}
              className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {analyzing ? 'Analiz Ediliyor...' : 'AI ile Analiz Et'}
            </button>
            <p className="mt-4 text-xs text-zinc-500">Kalan kredi: {user.ai_credits} (1 kredi kullanılır)</p>
          </div>

          {/* Analysis Result + Create */}
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold text-white">Ürün Bilgileri</h2>
            <p className="mt-1 text-sm text-zinc-400">AI önerilerini düzenle ve ürünü oluştur.</p>

            {!analysis && !analyzing && (
              <div className="mt-8 flex flex-col items-center gap-2 text-zinc-500">
                <ImageUp className="h-10 w-10" />
                <p className="text-sm">Görsel yükleyip analiz etmek için bekliyor...</p>
              </div>
            )}
            {analyzing && (
              <div className="mt-8 flex flex-col items-center gap-2 text-zinc-400">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                <p className="text-sm">AI görseli analiz ediyor ve metinler oluşturuyor...</p>
              </div>
            )}

            {analysis && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-zinc-400">Ürün Kodu</label>
                  <input value={productForm.code} onChange={e => setProductForm({ ...productForm, code: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono text-white" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400">Başlık</label>
                  <input value={productForm.label} onChange={e => setProductForm({ ...productForm, label: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Fiyat (₺)</label>
                    <input type="number" min="0" step="0.01" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Stok</label>
                    <input type="number" min="0" value={productForm.stock} onChange={e => setProductForm({ ...productForm, stock: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400">Açıklama</label>
                  <textarea value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })} rows={4}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                </div>

                {/* Detected specs */}
                <details className="rounded-lg border border-zinc-700 bg-zinc-800">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-400">AI Tespit Etti</summary>
                  <div className="border-t border-zinc-700 px-3 py-2 text-xs text-zinc-500">
                    <p>Kategori: {analysis.specs.category}</p>
                    <p>Renk: {analysis.specs.color}</p>
                    <p>Malzeme: {analysis.specs.material}</p>
                    <p>Tür: {analysis.specs.type}</p>
                    <p>Stil: {analysis.specs.style}</p>
                    <p className="mt-1">SEO: {analysis.meta_title}</p>
                    <p>Slug: {analysis.slug}</p>
                    <p>Anahtar kelimeler: {analysis.keywords.join(', ')}</p>
                  </div>
                </details>

                <button onClick={handleCreateProduct} disabled={saving || !productForm.label || !productForm.code}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {saving ? 'Oluşturuluyor...' : 'Ürünü Oluştur'}
                </button>
              </div>
            )}
          </div>
          </>
          )}
        </div>
      )}

      {tab === 'agentic' && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {!can('ai_product_create') ? (
            <div className="col-span-full rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-center">
              <p className="text-sm text-zinc-400">Bu modül planınızda kapalı.</p>
              <button onClick={() => router.push('/billing')} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-zinc-700 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-600">
                Üst Pakete Geç <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
          <>
          {/* Upload + Options */}
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
            <div className="flex items-center gap-3">
              <Wand2 className="h-5 w-5 text-violet-400" />
              <h2 className="text-lg font-semibold text-white">1. Görsel & Seçenekler</h2>
            </div>
            <p className="mt-1 text-sm text-zinc-400">Fotoğrafı yükle, AI ilanı uçtan uca hazırlasın.</p>

            <div className="mt-4">
              <label className="text-xs font-medium text-zinc-400">Kategori</label>
              <select value={agenticForm.category} onChange={e => setAgenticForm({ ...agenticForm, category: e.target.value })}
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
              <input type="file" accept="image/*" onChange={handleAgenticFile}
                className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-violet-500" />
            </div>
            {agenticPreview && (
              <img src={agenticPreview} alt="Preview" className="mt-4 max-h-48 rounded-lg border border-zinc-700 object-cover" />
            )}

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-400">Kısa Açıklama (opsiyonel)</label>
                <input value={agenticNotes.short_description} onChange={e => setAgenticNotes({ ...agenticNotes, short_description: e.target.value })}
                  placeholder="Satıcı notu / kısa bilgi"
                  className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400">Anahtar Kelimeler (opsiyonel)</label>
                <input value={agenticNotes.keywords} onChange={e => setAgenticNotes({ ...agenticNotes, keywords: e.target.value })}
                  placeholder="virgülle ayır"
                  className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-zinc-400">Hedef Pazaryerleri</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {[{ mp: 'trendyol', n: 'Trendyol' }, { mp: 'n11', n: 'N11' }, { mp: 'hepsiburada', n: 'Hepsiburada' }, { mp: 'pazarama', n: 'Pazarama' }, { mp: 'amazon', n: 'Amazon' }, { mp: 'etsy', n: 'Etsy' }].map(o => (
                  <button key={o.mp} type="button" onClick={() => toggleMp(o.mp)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium border ${agenticMps.includes(o.mp) ? 'bg-violet-600 border-violet-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                    {o.n}
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={agenticSuggestPrice} onChange={e => setAgenticSuggestPrice(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800" />
              Fiyat aralığı öner
            </label>

            <button onClick={handleAgenticRun} disabled={!agenticRawFile || agenticLoading}
              className="mt-4 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">
              {agenticLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {agenticLoading ? 'İlan Hazırlanıyor...' : 'İlanı Hazırla'}
            </button>
            <p className="mt-4 text-xs text-zinc-500">Kalan kredi: {user.ai_credits}</p>
          </div>

          {/* Draft Result */}
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold text-white">2. İlan Taslağı</h2>
            <p className="mt-1 text-sm text-zinc-400">AI taslağını düzenle ve ürünü oluştur.</p>

            {!agenticDraft && !agenticLoading && (
              <div className="mt-8 flex flex-col items-center gap-2 text-zinc-500">
                <Wand2 className="h-10 w-10" />
                <p className="text-sm">Görsel yükle ve &quot;İlanı Hazırla&quot;ya bas.</p>
              </div>
            )}
            {agenticLoading && (
              <div className="mt-8 flex flex-col items-center gap-2 text-zinc-400">
                <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                <p className="text-sm">Görsel analiz edilip ilan oluşturuluyor...</p>
              </div>
            )}

            {agenticDraft && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-zinc-400">Başlık</label>
                  <input value={agenticForm.title} onChange={e => setAgenticForm({ ...agenticForm, title: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Kategori</label>
                    <select value={agenticForm.category} onChange={e => setAgenticForm({ ...agenticForm, category: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white">
                      {['giyim', 'taki', 'kozmetik', 'ayakkabi', 'canta', 'elektronik', 'ev_dekorasyon', 'spor', 'diger'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Stok</label>
                    <input type="number" min="0" value={agenticForm.stock} onChange={e => setAgenticForm({ ...agenticForm, stock: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                  </div>
                </div>
                {agenticDraft.price_suggestion && (
                  <div className="rounded-lg bg-violet-900/40 border border-violet-700/40 p-3 text-xs text-violet-200">
                    <p className="font-medium">Önerilen fiyat aralığı: {agenticDraft.price_suggestion.min}-{agenticDraft.price_suggestion.max} {agenticDraft.price_suggestion.currency}</p>
                    <p className="mt-1 text-violet-300">{agenticDraft.price_suggestion.rationale}</p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-zinc-400">Fiyat (₺)</label>
                  <input type="number" min="0" step="0.01" value={agenticForm.price} onChange={e => setAgenticForm({ ...agenticForm, price: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400">Açıklama</label>
                  <textarea value={agenticForm.description} onChange={e => setAgenticForm({ ...agenticForm, description: e.target.value })} rows={6}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                </div>

                <details className="rounded-lg border border-zinc-700 bg-zinc-800">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-400">AI Tespit Etti (Özellikler)</summary>
                  <div className="border-t border-zinc-700 px-3 py-2 text-xs text-zinc-500">
                    {Object.entries(agenticDraft.attributes || {}).map(([k, v]) => (
                      <p key={k}>{k}: {v}</p>
                    ))}
                    <p className="mt-1">Malzeme: {agenticDraft.specs.material}</p>
                    <p>Renk: {agenticDraft.specs.color}</p>
                    <p>Tür: {agenticDraft.specs.type}</p>
                    <p>Slug: {agenticDraft.slug}</p>
                    {agenticDraft.bullet_points?.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium text-zinc-400">Amazon madde işaretleri:</p>
                        {agenticDraft.bullet_points.map((b, i) => <p key={i} className="mt-1">• {b}</p>)}
                      </div>
                    )}
                  </div>
                </details>

                <button onClick={handleAgenticCreate} disabled={saving || !agenticForm.title}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {saving ? 'Oluşturuluyor...' : 'Ürünü Oluştur'}
                </button>
              </div>
            )}
          </div>
          </>
          )}
        </div>
      )}

      {gate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-[420px] max-w-full shadow-xl">
            <div className="flex items-center gap-3 mb-2">
              {gate === 'credits' ? <Coins className="h-6 w-6 text-indigo-400" /> : <Sparkles className="h-6 w-6 text-indigo-400" />}
              <h3 className="font-semibold text-lg text-white">{gate === 'credits' ? 'AI Kredisi Yetersiz' : 'Ürün Limiti Doldu'}</h3>
            </div>
            <p className="text-sm text-zinc-400 mb-4">
              {gate === 'credits'
                ? 'Devam etmek için yeterli AI krediniz yok. Kredi satın alın veya üst pakete geçin.'
                : 'Planınızdaki ürün limitine ulaştınız. Daha fazla ürün eklemek için üst pakete geçin.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setGate(null)} className="px-4 py-1.5 border border-zinc-600 rounded text-sm text-zinc-300">Vazgeç</button>
              {gate === 'credits' && (
                <button onClick={() => router.push('/credits')} className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm flex items-center gap-1">
                  Kredi Satın Al <ArrowUpRight className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => router.push('/billing')} className="px-4 py-1.5 bg-white text-black rounded text-sm flex items-center gap-1">
                Üst Pakete Geç <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
