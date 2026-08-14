'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Users, Search, Eye, ShoppingCart, DollarSign, Globe, Store } from 'lucide-react'

type Customer = {
  id: number; name: string; email: string; phone: string | null
  source: string; isActive: boolean; lastLoginAt: string | null; createdAt: string
  orderCount: number; totalSpent: number
}

const SOURCE_FILTERS = [
  { value: '', label: 'Tümü' },
  { value: 'storefront', label: 'Mağaza' },
  { value: 'marketplace', label: 'Pazaryeri' },
]

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getCustomers({ page, limit, search: search || undefined, source: sourceFilter || undefined })
      setCustomers(res.customers)
      setTotal(res.total)
    } catch {
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }, [page, search, sourceFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => { setPage(1) }, [search, sourceFilter])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Users className="h-6 w-6" /> Müşteriler</h1>
          <p className="mt-1 text-sm text-zinc-400">{total} müşteri</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-zinc-700 bg-zinc-900">
            {SOURCE_FILTERS.map(f => (
              <button key={f.value} onClick={() => setSourceFilter(f.value)}
                className={`px-3 py-1.5 text-xs font-medium transition ${sourceFilter === f.value ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="İsim, email veya telefon ara..."
              className="w-64 rounded-lg border border-zinc-700 bg-zinc-900 pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500" />
          </div>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : customers.length === 0 ? (
        <div className="mt-12 text-center text-zinc-500">
          <Users className="mx-auto h-12 w-12 text-zinc-700" />
          <p className="mt-3 text-sm">{search || sourceFilter ? 'Arama sonucu bulunamadı' : 'Henüz müşteri yok'}</p>
        </div>
      ) : (
        <>
          <div className="mt-6 table-scroll">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="pb-3 font-medium">Müşteri</th>
                  <th className="pb-3 font-medium">Kaynak</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Telefon</th>
                  <th className="pb-3 font-medium text-right">Sipariş</th>
                  <th className="pb-3 font-medium text-right">Toplam Harcama</th>
                  <th className="pb-3 font-medium">Kayıt Tarihi</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                    <td className="py-3">
                      <div className="font-medium text-white">{c.name}</div>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.source === 'storefront' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-blue-900/50 text-blue-400'}`}>
                        {c.source === 'storefront' ? <Store className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                        {c.source === 'storefront' ? 'Mağaza' : 'Pazaryeri'}
                      </span>
                    </td>
                    <td className="py-3 text-zinc-300">{c.email}</td>
                    <td className="py-3 text-zinc-300">{c.phone || '—'}</td>
                    <td className="py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-zinc-300">
                        <ShoppingCart className="h-3.5 w-3.5" /> {c.orderCount}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                        <DollarSign className="h-3.5 w-3.5" /> {c.totalSpent.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                      </span>
                    </td>
                    <td className="py-3 text-zinc-400">{new Date(c.createdAt).toLocaleDateString('tr-TR')}</td>
                    <td className="py-3 text-right">
                      <Link href={`/customers/${c.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700">
                        <Eye className="h-3.5 w-3.5" /> Detay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-zinc-400">
              <span>Sayfa {page} / {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800 disabled:opacity-40">Önceki</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800 disabled:opacity-40">Sonraki</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
