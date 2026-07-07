'use client'

import { useAuth } from '@/lib/auth'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AiPage() {
  const { user } = useAuth()
  if (!user) return null

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
            <input type="file" accept="image/*" className="mt-1 block w-full text-sm text-zinc-500 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100" />
          </div>
          <Button className="mt-4" size="sm">İşle</Button>
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
