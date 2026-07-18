'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { Sparkles, Camera, X, CheckCircle, Loader2, ImageUp } from 'lucide-react'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'

interface AiAnalysis {
  specs: { material: string; color: string; type: string; style: string; category: string }
  title: string
  description: string
  short_description: string
  meta_title: string
  meta_description: string
  keywords: string[]
  slug: string
}

interface ProductForm {
  code: string
  label: string
  price: string
  stock: string
  description: string
}

export default function AiCreatorPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<'upload' | 'analyze' | 'form'>('upload')
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [productForm, setProductForm] = useState<ProductForm>({
    code: '',
    label: '',
    price: '',
    stock: '10',
    description: '',
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      setImagePreview(URL.createObjectURL(file))
      setError('')
      setSuccess('')
      setAnalysis(null)
      setProductForm({ code: '', label: '', price: '', stock: '10', description: '' })
      setStep('analyze')
    }
  }

  const handleCameraCapture = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (file) {
        setImage(file)
        setImagePreview(URL.createObjectURL(file))
        setError('')
        setSuccess('')
        setAnalysis(null)
        setProductForm({ code: '', label: '', price: '', stock: '10', description: '' })
        setStep('analyze')
      }
    }
    input.click()
  }

  const triggerFileInput = () => document.getElementById('ai-creator-file-input')?.click()

  const removeImage = () => {
    setImage(null)
    setImagePreview(null)
    setStep('upload')
  }

  const handleAnalyze = async () => {
    if (!image) return
    setAnalyzing(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('image', image)
      const res = await api.analyzeProduct(formData)
      setAnalysis(res)
      setProductForm({
        code: res.slug || res.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 32),
        label: res.title,
        price: '',
        stock: '10',
        description: res.description,
      })
      setStep('form')
    } catch (err: any) {
      setError(err.message || 'Analiz başarısız')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleCreateProduct = async () => {
    if (!analysis || !productForm.label || !productForm.code) return
    setSaving(true)
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
      setSuccess('Ürün başarıyla oluşturuldu!')
      setTimeout(() => {
        router.push('/products')
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Ürün oluşturma başarısız')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100 mb-6">
        <div className="p-3 bg-indigo-100 rounded-lg">
          <Sparkles className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-indigo-900">AI ile Ürün Oluşturucu</h1>
          <p className="text-indigo-600">Ürün fotoğrafını çekin, AI analiz edip başlık, açıklama, kategori oluşturacak</p>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2"><CheckCircle className="h-4 w-4" />{success}</div>}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={triggerFileInput}
              className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-zinc-300 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            >
              <ImageUp className="h-10 w-10 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-600">Galeriden Seç</span>
            </button>
            <button
              onClick={handleCameraCapture}
              className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-zinc-300 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            >
              <Camera className="h-10 w-10 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-600">Kameradan Çek</span>
            </button>
          </div>

          <input
            id="ai-creator-file-input"
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <p className="text-xs text-zinc-400 text-center">Kalan AI kredisi: {user.ai_credits}</p>
        </div>
      )}

      {/* Step 2: Analyze */}
      {step === 'analyze' && (
        <div className="space-y-4">
          <div className="relative">
            {imagePreview && <img src={imagePreview} alt="Preview" className="w-full h-64 object-cover rounded-xl" />}
            <button
              onClick={removeImage}
              className="absolute top-3 right-3 p-2 bg-black/50 rounded-full hover:bg-black/70"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Analiz Ediliyor...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                AI ile Analiz Et
              </>
            )}
          </button>

          <p className="text-xs text-zinc-400 text-center">1 AI kredisi kullanılacak (Kalan: {user.ai_credits})</p>
        </div>
      )}

      {/* Step 3: Form */}
      {step === 'form' && analysis && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ürün Bilgilerini Düzenle</h2>
            <button onClick={() => setStep('analyze')} className="text-sm text-indigo-600 hover:underline">← Görsele Geri Dön</button>
          </div>

          {imagePreview && <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-xl" />}

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          {success && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2"><CheckCircle className="h-4 w-4" />{success}</div>}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Ürün Kodu</label>
              <input
                type="text"
                value={productForm.code}
                onChange={e => setProductForm({ ...productForm, code: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Otomatik (slug'dan)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Başlık *</label>
              <input
                type="text"
                value={productForm.label}
                onChange={e => setProductForm({ ...productForm, label: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="AI önerisi"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Fiyat (₺)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={productForm.price}
                  onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Stok</label>
                <input
                  type="number"
                  min="0"
                  value={productForm.stock}
                  onChange={e => setProductForm({ ...productForm, stock: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Açıklama</label>
              <textarea
                value={productForm.description}
                onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="AI önerisi"
              />
            </div>

            {/* AI detected specs */}
            <details className="border border-zinc-200 rounded-lg">
              <summary className="p-3 cursor-pointer font-medium text-zinc-600">AI Tespit Etti (Genişlet)</summary>
              <div className="px-3 pb-3 text-sm text-zinc-500 space-y-1">
                <p>Kategori: {analysis.specs.category}</p>
                <p>Renk: {analysis.specs.color}</p>
                <p>Malzeme: {analysis.specs.material}</p>
                <p>Tür: {analysis.specs.type}</p>
                <p>Stil: {analysis.specs.style}</p>
                <p className="mt-2">SEO: {analysis.meta_title}</p>
                <p>Slug: {analysis.slug}</p>
                <p>Anahtar kelimeler: {analysis.keywords.join(', ')}</p>
              </div>
            </details>

            <button
              onClick={handleCreateProduct}
              disabled={saving || !productForm.label || !productForm.code}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Oluşturuluyor...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Ürünü Oluştur
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}