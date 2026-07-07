'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { Product } from '@/lib/types'

export default function ProductsPage() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getAdminProducts()
      .then((res) => setProducts(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (!user) return null

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Ürünler</h1>
      <p className="mt-1 text-sm text-zinc-600">Ürünlerini yönet, AI ile görsel düzenle ve pazaryerlerine gönder.</p>
      <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200">
        <table className="min-w-full divide-y divide-zinc-200">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Kod</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Ürün</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-50">
                <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">{p.code}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-zinc-900">{p.label}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${p.status === 1 ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                    {p.status === 1 ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && !loading && (
          <div className="p-12 text-center text-sm text-zinc-500">
            Henüz ürün eklenmemiş. API üzerinden ürün ekleyebilirsin.
          </div>
        )}
      </div>
    </div>
  )
}
