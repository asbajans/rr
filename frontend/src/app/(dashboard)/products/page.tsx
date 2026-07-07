'use client'

import { useAuth } from '@/lib/auth'

export default function ProductsPage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Ürünler</h1>
      <p className="mt-1 text-sm text-zinc-600">Ürünlerini yönet, AI ile görsel düzenle ve pazaryerlerine gönder.</p>
      <div className="mt-8 rounded-xl border border-zinc-200 p-12 text-center">
        <p className="text-sm text-zinc-500">Henüz ürün eklenmemiş. API üzerinden ürün ekleyebilirsin.</p>
      </div>
    </div>
  )
}
