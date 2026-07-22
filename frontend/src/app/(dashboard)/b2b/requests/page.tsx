'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { B2bRequestItem } from '@/lib/types'
import { CheckCircle, Clock, XCircle, Package, Store, ArrowLeftRight, Check, X } from 'lucide-react'

type Tab = 'incoming' | 'outgoing'
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: 'text-amber-600 bg-amber-50 border-amber-200', icon: <Clock className="h-4 w-4" />, label: 'Beklemede' },
  approved: { color: 'text-green-600 bg-green-50 border-green-200', icon: <CheckCircle className="h-4 w-4" />, label: 'Onaylandı' },
  rejected: { color: 'text-red-600 bg-red-50 border-red-200', icon: <XCircle className="h-4 w-4" />, label: 'Reddedildi' },
}

export default function B2bRequestsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('incoming')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [requests, setRequests] = useState<B2bRequestItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<number | null>(null)

  const loadRequests = useCallback(() => {
    setLoading(true)
    api.getB2bRequests(tab, statusFilter === 'all' ? undefined : statusFilter)
      .then((res) => {
        setRequests(res)
        setTotal(res.length)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tab, statusFilter])

  useEffect(() => { loadRequests() }, [loadRequests])

  async function handleAction(id: number, status: 'approved' | 'rejected') {
    setProcessing(id)
    try {
      await api.updateB2bRequest(id, { status })
      loadRequests()
    } catch (err: any) {
      alert(err.message || 'İşlem başarısız')
    } finally {
      setProcessing(null)
    }
  }

  if (!user) return null

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">B2B Talepler</h1>
          <p className="mt-1 text-sm text-zinc-600">Gelen ve giden B2B taleplerini yönet.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">{total} talep</span>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4 border-b border-zinc-200">
        <button
          onClick={() => setTab('incoming')}
          className={`pb-3 text-sm font-medium ${tab === 'incoming' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          Gelen Talepler
        </button>
        <button
          onClick={() => setTab('outgoing')}
          className={`pb-3 text-sm font-medium ${tab === 'outgoing' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          Giden Talepler
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              statusFilter === s
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            {s === 'all' ? 'Tümü' : statusConfig[s]?.label || s}
          </button>
        ))}
      </div>

      {loading && <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>}

      {!loading && requests.length === 0 && (
        <div className="mt-16 text-center text-sm text-zinc-500">Henüz talep bulunmuyor.</div>
      )}

      {!loading && requests.length > 0 && (
        <div className="mt-6 space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100">
                    {req.product?.image ? (
                      <img src={req.product.image} alt="" className="h-full w-full rounded-lg object-cover" />
                    ) : (
                      <Package className="h-6 w-6 text-zinc-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">{req.product?.label || 'Bilinmeyen Ürün'}</h3>
                    <p className="text-xs text-zinc-500">Kod: {req.product?.code || '-'}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                      <Store className="h-3 w-3" />
                      <span>
                        {tab === 'incoming'
                          ? `Gönderen: ${req.from_store?.name || '-'}`
                          : `Hedef: ${req.to_store?.name || '-'}`}
                      </span>
                      <ArrowLeftRight className="h-3 w-3" />
                      <span>{new Date(req.created_at).toLocaleDateString('tr-TR')}</span>
                    </div>
                    {req.note && (
                      <p className="mt-2 text-xs text-zinc-400 italic">Not: {req.note}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${statusConfig[req.status]?.color}`}>
                    {statusConfig[req.status]?.icon}
                    {statusConfig[req.status]?.label}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                {tab === 'incoming' && req.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleAction(req.id, 'approved')}
                      disabled={processing === req.id}
                      className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" /> Onayla
                    </button>
                    <button
                      onClick={() => handleAction(req.id, 'rejected')}
                      disabled={processing === req.id}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <X className="h-3 w-3" /> Reddet
                    </button>
                  </>
                )}
                {tab === 'outgoing' && req.status === 'approved' && (
                  <button
                    onClick={async () => {
                      setProcessing(req.id)
                      try {
                        await api.cloneB2bProduct(req.id)
                        loadRequests()
                      } catch (err: any) {
                        alert(err.message || 'Klonlama başarısız')
                      } finally {
                        setProcessing(null)
                      }
                    }}
                    disabled={processing === req.id}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {processing === req.id ? 'Klonlanıyor...' : 'Mağazama Ekle'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
