'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { DashboardData } from '@/lib/types'

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (!user) return null

  const stats = data?.stats ?? { total_products: 0, total_orders: 0, ai_credits: user.ai_credits }

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
      <p className="mt-1 text-sm text-zinc-600">Hoş geldin, {user.name}!</p>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 p-6">
          <p className="text-sm font-medium text-zinc-500">AI Kredisi</p>
          <p className="mt-2 text-3xl font-bold text-zinc-900">{stats.ai_credits}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-6">
          <p className="text-sm font-medium text-zinc-500">Ürünler</p>
          <p className="mt-2 text-3xl font-bold text-zinc-900">{stats.total_products}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-6">
          <p className="text-sm font-medium text-zinc-500">Siparişler</p>
          <p className="mt-2 text-3xl font-bold text-zinc-900">{stats.total_orders}</p>
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
