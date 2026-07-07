'use client'

import { useAuth } from '@/lib/auth'

export default function DashboardPage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
      <p className="mt-1 text-sm text-zinc-600">Hoş geldin, {user.name}!</p>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 p-6">
          <p className="text-sm font-medium text-zinc-500">AI Kredisi</p>
          <p className="mt-2 text-3xl font-bold text-zinc-900">{user.ai_credits}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-6">
          <p className="text-sm font-medium text-zinc-500">Mağaza ID</p>
          <p className="mt-2 text-3xl font-bold text-zinc-900">{user.store_id ?? '-'}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-6">
          <p className="text-sm font-medium text-zinc-500">Ürünler</p>
          <p className="mt-2 text-3xl font-bold text-zinc-900">0</p>
        </div>
      </div>
      <div className="mt-8 rounded-xl border border-zinc-200 p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Hızlı İşlemler</h2>
        <ul className="mt-4 space-y-3 text-sm text-zinc-600">
          <li>• Ana API anahtarını kullanarak mağazana bağlan</li>
          <li>• AI görsel işleme ile ürünlerini düzenle</li>
          <li>• Ürünleri Trendyol ve Hepsiburada&apos;ya gönder</li>
          <li>• Mobil uygulamayı indir</li>
        </ul>
      </div>
    </div>
  )
}
