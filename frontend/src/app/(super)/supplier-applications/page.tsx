'use client'

import { useState, useEffect, useCallback } from 'react'
import { api, API_BASE } from '@/lib/api-client'
import { CheckCircle2, XCircle, FileText, ExternalLink } from 'lucide-react'

const statusStyles: Record<string, string> = {
  draft: 'bg-zinc-800 text-zinc-400',
  submitted: 'bg-amber-900/40 text-amber-400',
  approved: 'bg-emerald-900/40 text-emerald-400',
  rejected: 'bg-red-900/40 text-red-400',
}

function absUrl(url: string) {
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

const docLabels: Record<string, string> = {
  taxDocument: 'Vergi Levhası',
  signatureDocument: 'İmza Sirküleri',
  tradeRegistryDocument: 'Ticaret Sicil Gazetesi',
}

export default function SuperSupplierApplicationsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'submitted' | 'approved' | 'rejected'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      const data = await api.getSupplierApplications(filter === 'all' ? undefined : filter)
      setItems(Array.isArray(data) ? data : [])
    } catch (err: any) {
      setMessage(err.message || 'Başvurular yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  async function approve(id: number) {
    setBusy(id); setMessage('')
    try {
      await api.approveSupplierApplication(id)
      setMessage('Başvuru onaylandı')
      load()
    } catch (err: any) {
      setMessage(err.message || 'Onaylanamadı')
    } finally {
      setBusy(null)
    }
  }

  async function reject(id: number) {
    const note = window.prompt('Red gerekçesi (opsiyonel):') ?? ''
    if (note === null) return
    setBusy(id); setMessage('')
    try {
      await api.rejectSupplierApplication(id, note)
      setMessage('Başvuru reddedildi')
      load()
    } catch (err: any) {
      setMessage(err.message || 'Reddedilemedi')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Tedarikçi Başvuruları</h1>
        <p className="mt-1 text-sm text-zinc-400">Tedarikçi onay başvurularını incele, vergi levhası/imza sirküleri/ticaret sicil gazetesi belgelerini görüntüle ve onayla veya reddet.</p>
      </div>

      {message && <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">{message}</div>}

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
        {(['all', 'submitted', 'approved', 'rejected'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${filter === f ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>
            {f === 'all' ? 'Tümü' : f}
          </button>
        ))}
      </div>

      {loading ? <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p> : (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-800">
            <thead className="bg-zinc-900">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Mağaza</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">İletişim</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Belgeler</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Durum</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Not</th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {items.map((s) => {
                const store = s.store || {}
                const docs = s.applicationDocuments || {}
                const submitted = s.applicationStatus === 'submitted' || s.applicationStatus === 'rejected'
                return (
                  <tr key={s.id} className="hover:bg-zinc-800/50">
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-white">{store.name || s.name || `#${s.id}`}</div>
                      <div className="text-xs text-zinc-500">{store.siteCode ? `/${store.siteCode}` : ''} · Vergi: {s.taxId || '—'}</div>
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-400">
                      <div>{store.email || s.email || '—'}</div>
                      <div className="text-xs text-zinc-500">{store.phone || s.phone || ''}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        {Object.entries(docLabels).map(([key, label]) => {
                          const url = docs[key]
                          if (!url) return null
                          return (
                            <a key={key} href={absUrl(url)} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300">
                              <FileText className="h-3 w-3" /> {label} <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )
                        })}
                        {Object.values(docs).every((v) => !v) && <span className="text-xs text-zinc-600">Belge yok</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[s.applicationStatus] || statusStyles.draft}`}>
                        {s.applicationStatus}
                      </span>
                    </td>
                    <td className="max-w-[180px] px-5 py-4 text-xs text-zinc-400">{s.rejectionNote || '—'}</td>
                    <td className="px-5 py-4 text-right">
                      {submitted && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => approve(s.id)} disabled={busy === s.id}
                            className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Onayla
                          </button>
                          <button onClick={() => reject(s.id)} disabled={busy === s.id}
                            className="flex items-center gap-1 rounded-md bg-red-600/80 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50">
                            <XCircle className="h-3.5 w-3.5" /> Reddet
                          </button>
                        </div>
                      )}
                      {s.applicationStatus === 'approved' && <span className="text-xs text-emerald-500">Onaylandı</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {items.length === 0 && <div className="p-12 text-center text-sm text-zinc-500">Başvuru bulunmuyor.</div>}
        </div>
      )}
    </div>
  )
}
