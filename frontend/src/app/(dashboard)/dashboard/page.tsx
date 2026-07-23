'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { DashboardData } from '@/lib/types'
import { CardSkeleton } from '@/components/ui/skeleton'

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (!user) return null

  const stats = data?.stats ?? { total_products: 0, total_orders: 0, ai_credits: user.ai_credits || 0 }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Hoş geldin, {user.name}!</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <CardSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-sm">
            <p className="text-sm font-medium text-zinc-500">AI Kredisi</p>
            <p className="mt-2 text-3xl font-bold text-zinc-900">{stats.ai_credits}</p>
            <p className="mt-1 text-xs text-zinc-400">Kullanılabilir kredi</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-sm">
            <p className="text-sm font-medium text-zinc-500">Ürünler</p>
            <p className="mt-2 text-3xl font-bold text-zinc-900">{stats.total_products}</p>
            <p className="mt-1 text-xs text-zinc-400">Toplam ürün sayısı</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-sm">
            <p className="text-sm font-medium text-zinc-500">Siparişler</p>
            <p className="mt-2 text-3xl font-bold text-zinc-900">{stats.total_orders}</p>
            <p className="mt-1 text-xs text-zinc-400">Toplam sipariş</p>
          </div>
        </div>
      )}

      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Hızlı İşlemler</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { title: 'Ürün Ekle', desc: 'Yeni ürün ekle veya AI ile oluştur', href: '/products' },
            { title: 'Pazaryeri Entegrasyonu', desc: 'Trendyol, Hepsiburada ve daha fazlası', href: '/integrations' },
            { title: 'XML Feed', desc: 'Dış kaynaklardan ürün içe aktar', href: '/feeds' },
            { title: 'Site Tasarımı', desc: 'Mağaza görünümünü özelleştir', href: '/site-builder' },
          ].map((item) => (
            <a key={item.title} href={item.href}
              className="flex items-center gap-4 rounded-lg border border-zinc-200 p-4 text-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50">
              <div>
                <p className="font-medium text-zinc-900">{item.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{item.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
