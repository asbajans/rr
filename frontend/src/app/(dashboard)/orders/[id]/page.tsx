'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { DropshippingOrderDetail } from '@/lib/types'
import { ArrowLeft, Package, Truck, CheckCircle, XCircle, RotateCcw, Clock } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: 'Beklemede', icon: <Clock className="h-5 w-5" />, color: 'bg-yellow-100 text-yellow-700' },
  processing: { label: 'Hazırlanıyor', icon: <Package className="h-5 w-5" />, color: 'bg-blue-100 text-blue-700' },
  shipped: { label: 'Kargoda', icon: <Truck className="h-5 w-5" />, color: 'bg-purple-100 text-purple-700' },
  delivered: { label: 'Teslim Edildi', icon: <CheckCircle className="h-5 w-5" />, color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'İptal Edildi', icon: <XCircle className="h-5 w-5" />, color: 'bg-red-100 text-red-700' },
  returned: { label: 'İade Edildi', icon: <RotateCcw className="h-5 w-5" />, color: 'bg-orange-100 text-orange-700' },
}

const STATUS_FLOW: Record<string, string[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const [order, setOrder] = useState<DropshippingOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(false)
  const [statusNote, setStatusNote] = useState('')
  const [trackingNum, setTrackingNum] = useState('')
  const [trackingCompany, setTrackingCompany] = useState('')
  const [showTracking, setShowTracking] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!id || !user) return
    api.getDropshippingOrder(parseInt(id))
      .then(setOrder)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, user])

  async function updateStatus(status: string) {
    setUpdating(true)
    setMessage('')
    try {
      const updated = await api.updateOrderStatus(parseInt(id), status, statusNote || undefined)
      setOrder(updated)
      setStatusNote('')
      setMessage(`Durum "${STATUS_CONFIG[status]?.label}" olarak güncellendi`)
    } catch (err: any) {
      setMessage(err.message || 'Güncellenemedi')
    } finally {
      setUpdating(false)
    }
  }

  async function saveTracking() {
    setUpdating(true)
    setMessage('')
    try {
      const updated = await api.updateOrderTracking(parseInt(id), trackingNum, trackingCompany || undefined)
      setOrder(updated)
      setShowTracking(false)
      setMessage('Kargo bilgisi kaydedildi')
    } catch (err: any) {
      setMessage(err.message || 'Kaydedilemedi')
    } finally {
      setUpdating(false)
    }
  }

  if (!user) return null
  if (loading) return <div className="p-8 text-sm text-zinc-500">Yükleniyor...</div>
  if (error) return <div className="p-8 text-sm text-red-600">{error}</div>
  if (!order) return null

  const config = STATUS_CONFIG[order.status]
  const nextStatuses = STATUS_FLOW[order.status] || []

  return (
    <div>
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" /> Siparişler
      </Link>

      {message && (
        <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left - Order Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${config.color}`}>
                {config.icon}
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-900">
                  {order.external_id || `#${order.id}`}
                </h2>
                <span className={`inline-block mt-1 rounded px-2 py-0.5 text-xs font-medium ${config.color}`}>
                  {config.label}
                </span>
              </div>
            </div>

            {nextStatuses.length > 0 && (
              <div className="mt-6 border-t border-zinc-100 pt-4">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Durum Güncelle</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {nextStatuses.map(s => (
                    <button key={s} onClick={() => updateStatus(s)} disabled={updating}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
                      {STATUS_CONFIG[s]?.label || s}
                    </button>
                  ))}
                </div>
                <input value={statusNote} onChange={e => setStatusNote(e.target.value)}
                  placeholder="Not (isteğe bağlı)..." className="mt-2 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-xs" />
              </div>
            )}
          </div>

          {/* Items */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-zinc-900">Ürünler</h3>
            <div className="mt-4 space-y-3">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-zinc-900">{item.name}</p>
                    <p className="text-xs text-zinc-400">SKU: {item.sku} × {item.quantity}</p>
                  </div>
                  <p className="font-medium text-zinc-900">
                    {(item.unitPrice * item.quantity).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {order.currency}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Tracking */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-zinc-900">Kargo Takibi</h3>
            {order.tracking_number ? (
              <div className="mt-2">
                <p className="text-sm text-zinc-700">{order.tracking_company && `${order.tracking_company}: `}{order.tracking_number}</p>
                <button onClick={() => { setTrackingNum(order.tracking_number!); setTrackingCompany(order.tracking_company || ''); setShowTracking(true) }}
                  className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-500">Düzenle</button>
              </div>
            ) : (
              <button onClick={() => setShowTracking(true)} className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-500">
                Kargo Bilgisi Ekle
              </button>
            )}
            {showTracking && (
              <div className="mt-3 space-y-2">
                <input value={trackingNum} onChange={e => setTrackingNum(e.target.value)}
                  placeholder="Takip No" className="block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm" />
                <input value={trackingCompany} onChange={e => setTrackingCompany(e.target.value)}
                  placeholder="Kargo Şirketi" className="block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm" />
                <div className="flex gap-2">
                  <button onClick={saveTracking} disabled={updating || !trackingNum}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                    Kaydet
                  </button>
                  <button onClick={() => setShowTracking(false)} className="text-xs text-zinc-500 hover:text-zinc-900">İptal</button>
                </div>
              </div>
            )}
          </div>

          {/* Status History */}
          {order.status_history && order.status_history.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-zinc-900">Durum Geçmişi</h3>
              <div className="mt-4 space-y-4">
                {order.status_history.map((h) => (
                  <div key={h.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100">
                        <div className="h-2 w-2 rounded-full bg-zinc-400" />
                      </div>
                      <div className="mt-1 w-px flex-1 bg-zinc-200" />
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-zinc-900">
                        {h.from_status ? `${STATUS_CONFIG[h.from_status]?.label || h.from_status} → ${STATUS_CONFIG[h.to_status]?.label || h.to_status}` : STATUS_CONFIG[h.to_status]?.label || h.to_status}
                      </p>
                      {h.note && <p className="text-xs text-zinc-500">{h.note}</p>}
                      <p className="text-xs text-zinc-400">
                        {new Date(h.created_at).toLocaleString('tr-TR')}
                        {h.user && ` - ${h.user.name}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right - Customer Info */}
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-zinc-900">Müşteri</h3>
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-zinc-700">{order.customer_name}</p>
              <p className="text-zinc-500">{order.customer_email}</p>
              <p className="text-zinc-500">{order.customer_phone}</p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-zinc-900">Teslimat</h3>
            <p className="mt-2 text-sm text-zinc-600">{order.shipping_address || '—'}</p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-zinc-900">Ödeme</h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Pazaryeri</span><span className="text-zinc-700">{order.marketplace}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Ara Toplam</span><span className="text-zinc-700">{parseFloat(order.subtotal).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {order.currency}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Kargo</span><span className="text-zinc-700">{parseFloat(order.shipping).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {order.currency}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Vergi</span><span className="text-zinc-700">{parseFloat(order.tax).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {order.currency}</span></div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold"><span className="text-zinc-900">Toplam</span><span className="text-zinc-900">{parseFloat(order.grand_total).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {order.currency}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Tarih</span><span className="text-zinc-700">{new Date(order.created_at).toLocaleDateString('tr-TR')}</span></div>
            </div>
          </div>

          {order.note && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-zinc-900">Not</h3>
              <p className="mt-2 text-sm text-zinc-600">{order.note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
