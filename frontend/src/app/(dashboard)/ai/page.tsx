'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AiPage() {
  const { user } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState('')

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
      setResult(res.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem başarısız')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">AI Görsel İşleme</h1>
      <p className="mt-1 text-sm text-zinc-600">AI ile ürün görsellerini düzenle, arka plan temizle ve ComfyUI ile işle.</p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-zinc-900">Arka Plan Temizleme</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-600">Ürün görsellerinin arka planını AI ile temizle.</p>
          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-900">Görsel Yükle</label>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm text-zinc-500 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100" />
          </div>
          <Button className="mt-4" size="sm" onClick={handleRemoveBg} disabled={!file || processing}>
            {processing ? 'İşleniyor...' : 'İşle'}
          </Button>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {result && (
            <div className="mt-4">
              <p className="text-sm font-medium text-green-600">İşlem tamamlandı!</p>
              <img src={result} alt="Result" className="mt-2 max-h-48 rounded-lg border" />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-zinc-900">AI Ürün Açıklaması</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-600">Görseli analiz et ve SEO uyumlu ürün açıklaması oluştur.</p>
          <p className="mt-4 text-xs text-zinc-400">Kalan kredi: {user.ai_credits}</p>
        </div>
      </div>
    </div>
  )
}
