'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import type { Store } from '@/lib/types'

export default function SuperStoresPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getAdminStores()
      .then((res) => setStores(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Mağazalar</h1>
      <p className="mt-1 text-sm text-zinc-600">Tüm mağazaları görüntüle ve yönet.</p>
      {loading && <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>}
      {error && <p className="mt-8 text-sm text-red-600">{error}</p>}
      {!loading && !error && (
        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Mağaza</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Site Kodu</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Domain</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {stores.map((store) => (
                <tr key={store.id} className="hover:bg-zinc-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">{store.id}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-zinc-900">{store.name}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">{store.site_code}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">{store.domain ?? '-'}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${store.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {store.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {stores.length === 0 && (
            <div className="p-12 text-center text-sm text-zinc-500">Henüz mağaza bulunmuyor.</div>
          )}
        </div>
      )}
    </div>
  )
}
