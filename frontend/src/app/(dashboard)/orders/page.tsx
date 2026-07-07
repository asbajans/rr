'use client'

import { useAuth } from '@/lib/auth'

export default function OrdersPage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Siparişler</h1>
      <p className="mt-1 text-sm text-zinc-600">Tüm siparişlerini görüntüle ve yönet.</p>
      <div className="mt-8 rounded-xl border border-zinc-200 p-12 text-center">
        <p className="text-sm text-zinc-500">Henüz sipariş bulunmuyor.</p>
      </div>
    </div>
  )
}
