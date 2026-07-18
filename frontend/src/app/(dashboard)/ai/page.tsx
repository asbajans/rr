'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { api, API_BASE } from '@/lib/api-client'
import { Sparkles, ImageUp, Loader2, Check } from 'lucide-react'

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
  const { user } = useAuth()
  const [tab, setTab] = useState<'remove-bg' | 'creator'>('remove-bg')
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState('')

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem başarısız')
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analiz başarısız')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleCreateProduct() {
    if (!analysis) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.createAdminProduct({
        code: productForm.code,
        label: productForm.label,
        price: parseFloat(productForm.price) || undefined,
        stock: parseInt(productForm.stock) || undefined,
        status: 1,
      })
      setSuccess(`Ürün oluşturuldu! ID: ${res.id}`)
      setProductForm({ code: '', label: '', price: '', stock: '10', description: '' })
      setAnalysis(null)
      setCreatorFile(null)
      setCreatorRawFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ürün oluşturma başarısız')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">AI Araçları</h1>
      <p className="mt-1 text-sm text-zinc-400">AI ile görsel işleme ve ürün oluşturma.</p>

      <div className="mt-4 flex gap-2 border-b border-zinc-700">
        <button onClick={() => setTab('remove-bg')} className={`px-4 py-2 text-sm font-medium ${tab === 'remove-bg' ? 'border-b-2 border-white text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
          Görsel İşleme
        </button>
        <button onClick={() => setTab('creator')} className={`px-4 py-2 text-sm font-medium ${tab === 'creator' ? 'border-b-2 border-white text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
          AI Ürün Oluşturucu
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-900/50 p-3 text-sm text-red-400">{error}</div>}
      {success && <div className="mt-4 rounded-lg bg-green-900/50 p-3 text-sm text-green-400">{success}</div>}

      {tab === 'remove-bg' && (
        <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-900 p-6">
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
        </div>
      )}

      {tab === 'creator' && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
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
        </div>
      )}
    </div>
  )
}
