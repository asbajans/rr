'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import type { Store } from '@/lib/types'
import { Store as StoreIcon, ExternalLink } from 'lucide-react'

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Mağazalar</h1>
        <p className="mt-1 text-sm text-zinc-400">Tüm mağazaları görüntüle ve yönet.</p>
      </div>
      {loading && <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>}
      {error && <p className="mt-8 text-sm text-red-400">{error}</p>}
      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-800">
            <thead className="bg-zinc-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Mağaza</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Site Kodu</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Domain</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {stores.map((store) => (
                <tr key={store.id} className="hover:bg-zinc-800/50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-400">{store.id}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-white">{store.name}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-400">{store.site_code}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-400">{store.domain ?? '-'}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${store.is_active ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                      {store.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {stores.length === 0 && <div className="p-12 text-center text-sm text-zinc-500">Henüz mağaza bulunmuyor.</div>}
        </div>
      )}
    </div>
  )
}
