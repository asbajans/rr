'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Star, Trash2, Pencil, ShieldCheck } from 'lucide-react'

function Stars({ value, size = 'h-4 w-4' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'}`} />
      ))}
    </span>
  )
}

export default function SuperSupplierRatingsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const [enabled, setEnabled] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      const [ratings, settings] = await Promise.all([api.getSupplierRatingsAdmin(), api.getRatingSettingsAdmin()])
      setItems(Array.isArray(ratings) ? ratings : [])
      setEnabled(settings.enabled !== false)
    } catch (err: any) {
      setMessage(err.message || 'Puanlar yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleEnabled() {
    setMessage('')
    try {
      const settings = await api.updateRatingSettingsAdmin(!enabled)
      setEnabled(settings.enabled !== false)
      setMessage(settings.enabled ? 'Puanlama sistemi açıldı' : 'Puanlama sistemi kapatıldı')
    } catch (err: any) {
      setMessage(err.message || 'Güncellenemedi')
    }
  }

  async function editRating(item: any) {
    const input = window.prompt('Yeni puan (1-5):', String(item.rating))
    if (input === null) return
    const rating = parseInt(input)
    if (isNaN(rating) || rating < 1 || rating > 5) {
      setMessage('Geçersiz puan (1-5 arası olmalı)')
      return
    }
    setBusy(item.id); setMessage('')
    try {
      await api.updateSupplierRatingAdmin(item.id, { rating })
      setMessage('Puan güncellendi')
      load()
    } catch (err: any) {
      setMessage(err.message || 'Güncellenemedi')
    } finally {
      setBusy(null)
    }
  }

  async function deleteRating(id: number) {
    if (!window.confirm('Bu puan silinsin mi?')) return
    setBusy(id); setMessage('')
    try {
      await api.deleteSupplierRatingAdmin(id)
      setMessage('Puan silindi')
      load()
    } catch (err: any) {
      setMessage(err.message || 'Silinemedi')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Tedarikçi Puanlama</h1>
          <p className="mt-1 text-sm text-zinc-400">B2B satışlar sonrası alıcıların tedarikçilere verdiği puanları görüntüle, düzelt ve yönet.</p>
        </div>
        <button
          onClick={toggleEnabled}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium ${
            enabled ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
          }`}
        >
          <ShieldCheck className="h-4 w-4" /> Puanlama Sistemi: {enabled ? 'Açık' : 'Kapalı'}
        </button>
      </div>

      {message && <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">{message}</div>}

      {loading ? <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p> : (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-800">
            <thead className="bg-zinc-900">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Tedarikçi</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Puan</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Yorum</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Alan Mağaza</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Tarih</th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-zinc-500">Henüz puanlama yok</td>
                </tr>
              )}
              {items.map((r) => {
                const sup = r.supplier || {}
                const supStore = sup.store || {}
                const rater = r.store || {}
                return (
                  <tr key={r.id} className="hover:bg-zinc-800/50">
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-white">{supStore.name || sup.name || `Tedarikçi #${r.supplierId}`}</div>
                      <div className="text-xs text-zinc-500">{supStore.siteCode ? `/${supStore.siteCode}` : ''}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Stars value={r.rating} />
                        <span className="text-xs text-zinc-400">{r.rating}/5</span>
                      </div>
                    </td>
                    <td className="max-w-xs px-5 py-4 text-sm text-zinc-400">{r.comment || '—'}</td>
                    <td className="px-5 py-4 text-sm text-zinc-400">
                      <div>{rater.name || `#${r.storeId}`}</div>
                      <div className="text-xs text-zinc-500">Sipariş #{r.orderId}</div>
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-500">
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString('tr-TR') : '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => editRating(r)} disabled={busy === r.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">
                          <Pencil className="h-3 w-3" /> Düzelt
                        </button>
                        <button onClick={() => deleteRating(r.id)} disabled={busy === r.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-950 disabled:opacity-50">
                          <Trash2 className="h-3 w-3" /> Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
