'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { DropshippingOrderDetail } from '@/lib/types'
import { ArrowLeft, Package, Truck, CheckCircle, XCircle, RotateCcw, Clock, ThumbsUp, Barcode, ChevronDown, ChevronUp, Star, X } from 'lucide-react'
import { CardSkeleton } from '@/components/ui/skeleton'

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
  const [labelUrl, setLabelUrl] = useState<string | null>(null)
  const [labelZpl, setLabelZpl] = useState<string | null>(null)
  const [cargoCompany, setCargoCompany] = useState<string | null>(null)
  const [labelLoading, setLabelLoading] = useState(false)
  const [showRawPayload, setShowRawPayload] = useState(false)
  const [rawData, setRawData] = useState<any>(null)
  const [refunding, setRefunding] = useState(false)
  const [invoiceLink, setInvoiceLink] = useState('')
  const [refundId, setRefundId] = useState('')
  const [capabilities, setCapabilities] = useState<{ integrationConnected: boolean; unsupported: string[] } | null>(null)

  // Supplier ratings
  const [ratings, setRatings] = useState<Record<number, { id: number; rating: number; comment: string }>>({})
  const [ratingOpen, setRatingOpen] = useState<number | null>(null)
  const [ratingScore, setRatingScore] = useState(5)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingSaving, setRatingSaving] = useState(false)

  useEffect(() => {
    if (!id || !user) return
    api.getOrder(parseInt(id))
      .then(r => {
        setOrder(r.order)
        setLabelUrl(r.order.label_url || null)
        setLabelZpl(r.order.label_zpl || null)
        setCargoCompany(r.order.cargo_company || null)
        setRawData(r.order)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    api.getOrderCapabilities(parseInt(id)).then(setCapabilities).catch(() => setCapabilities(null))
    api.getMySupplierRatings({ orderId: parseInt(id) }).then((list) => {
      const map: Record<number, { id: number; rating: number; comment: string }> = {}
      for (const r of list || []) if (r.supplierId) map[r.supplierId] = { id: r.id, rating: r.rating, comment: r.comment || '' }
      setRatings(map)
    }).catch(() => {})
  }, [id, user])

  async function submitRating(supplierId: number) {
    if (!ratingOpen || ratingScore < 1) return
    setRatingSaving(true)
    try {
      await api.rateSupplier({ orderId: parseInt(id), supplierId, rating: ratingScore, comment: ratingComment || undefined })
      const list = await api.getMySupplierRatings({ orderId: parseInt(id) })
      const map: Record<number, { id: number; rating: number; comment: string }> = {}
      for (const r of list || []) if (r.supplierId) map[r.supplierId] = { id: r.id, rating: r.rating, comment: r.comment || '' }
      setRatings(map)
      setMessage('Tedarikçi puanlaması kaydedildi')
      setRatingOpen(null)
    } catch (err: any) {
      setMessage(err.message || 'Puanlama kaydedilemedi')
    } finally {
      setRatingSaving(false)
    }
  }

  async function updateStatus(status: string) {
    setUpdating(true)
    setMessage('')
    try {
      const updated = await api.updateOrderStatus(parseInt(id), status, statusNote || undefined)
      setOrder(updated.order)
      setStatusNote('')
      setMessage(`Durum "${STATUS_CONFIG[status]?.label}" olarak güncellendi`)
    } catch (err: any) {
      setMessage(err.message || 'Güncellenemedi')
    } finally {
      setUpdating(false)
    }
  }

  async function approveTrendyolOrder() {
    setUpdating(true)
    setMessage('')
    try {
      const updated = await api.approveTrendyolOrder(parseInt(id))
      setOrder(updated.order)
      setMessage('Sipariş işleme alındı')
    } catch (err: any) {
      setMessage(err.message || 'Onaylanamadı')
    } finally {
      setUpdating(false)
    }
  }

  async function downloadLabel() {
    setLabelLoading(true)
    try {
      const result = await api.getOrderLabel(parseInt(id))
      if (result.reason) {
        setMessage(result.reason)
      } else if (result.cargoCompany) setCargoCompany(result.cargoCompany)
      if (result.labelZpl) {
        setLabelZpl(result.labelZpl)
        const blob = new Blob([result.labelZpl], { type: 'text/plain' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `label-${order?.external_id || id}.zpl`
        a.click()
        window.URL.revokeObjectURL(url)
        setMessage('Kargo etiketi (ZPL) indiriliyor')
      } else if (result.labelUrl) {
        setLabelUrl(result.labelUrl)
        window.open(result.labelUrl, '_blank')
        setMessage('Kargo etiketi açıldı')
      } else if (result.cargoCompany && !/TEX|Aras/i.test(result.cargoCompany)) {
        setMessage(`Kargo firması (${result.cargoCompany}) için etiket Trendyol üzerinden alınamıyor. Kargo firmasından temin ediniz.`)
      } else {
        setMessage('Etiket bulunamadı. Önce siparişi işleme almayı deneyin.')
      }
    } catch (err: any) {
      setMessage(err.message || 'Etiket alınamadı')
    } finally {
      setLabelLoading(false)
    }
  }

  async function saveTracking() {
    setUpdating(true)
    setMessage('')
    try {
      const updated = await api.updateOrderTracking(parseInt(id), trackingNum, trackingCompany || undefined)
      setOrder(updated.order)
      setShowTracking(false)
      setMessage('Kargo bilgisi kaydedildi')
    } catch (err: any) {
      setMessage(err.message || 'Kaydedilemedi')
    } finally {
      setUpdating(false)
    }
  }

  async function handleRefund() {
    if (!window.confirm(`Bu sipariş için para iadesi başlatılacak. Emin misiniz?`)) return
    setRefunding(true)
    setMessage('')
    try {
      const res = await api.refundOrder(parseInt(id))
      setOrder(prev => prev ? { ...prev, payment_status: res.paymentStatus } : prev)
      setMessage(`Para iadesi işlendi (${res.refId})`)
    } catch (err: any) {
      setMessage(err.message || 'İade yapılamadı')
    } finally {
      setRefunding(false)
    }
  }

  async function sendPazaramaInvoice() {
    setUpdating(true); setMessage('')
    try { await api.updateMarketplaceInvoice(parseInt(id), invoiceLink); setMessage('Fatura bağlantısı Pazarama’ya gönderildi') }
    catch (err: any) { setMessage(err.message || 'Fatura gönderilemedi') }
    finally { setUpdating(false) }
  }

  async function processPazaramaReturn(decision: 'approve' | 'reject') {
    if (!refundId) return setMessage('Pazarama iade ID gerekli')
    setUpdating(true); setMessage('')
    try { await api.updateMarketplaceReturn(parseInt(id), refundId, decision); setMessage(decision === 'approve' ? 'İade onaylandı' : 'İade reddedildi') }
    catch (err: any) { setMessage(err.message || 'İade işlemi başarısız') }
    finally { setUpdating(false) }
  }

  if (!user) return null
  if (loading) return <div className="p-8"><CardSkeleton count={3} /></div>
  if (error) return <div className="p-8 text-sm text-red-600">{error}</div>
  if (!order) return null

  const config = STATUS_CONFIG[order.status]
  const nextStatuses = STATUS_FLOW[order.status] || []
  const isTrendyol = order.marketplace === 'trendyol'
  const isSubOrder = !!order.parent_order_id

  const labelField = (label: string, value: any) =>
    value ? <div className="flex justify-between"><span className="text-zinc-500">{label}</span><span className="text-zinc-700 text-right max-w-[60%] break-all">{String(value)}</span></div> : null

  return (
    <div>
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" /> Siparişler
      </Link>

      {order.parent_order_id && (
        <div className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          <span className="font-semibold">B2B Tedarikçi Alt Siparişi</span> — Bu sipariş,
          <Link href={`/orders/${order.parent_order_id}`} className="font-medium underline mx-1">#{order.parent_order_id}</Link>
          numaralı ana siparişe ait tedarikçi alt siparişidir.
          Durum, ana siparişten otomatik güncellenir.
        </div>
      )}

      {order.parent_order && (
        <div className="mt-2 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-700">
          Ana Sipariş: <Link href={`/orders/${order.parent_order.id}`} className="font-medium underline">#{order.parent_order.id}</Link>
          {' '}({STATUS_CONFIG[order.parent_order.status]?.label || order.parent_order.status})
        </div>
      )}

      {message && (
        <div className={`mt-4 rounded-lg p-3 text-sm ${message.includes('başarısız') || message.includes('hatası') || message.includes('alamıyor') || message.includes('bulunamadı') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{message}</div>
      )}

      {capabilities && (capabilities.unsupported.length > 0 || !capabilities.integrationConnected) && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {!capabilities.integrationConnected
            ? 'Pazaryeri entegrasyonu bağlı değil; pazaryeri işlemleri kullanılamaz.'
            : `Bu pazaryeri için henüz desteklenmeyen işlemler: ${capabilities.unsupported.join(', ')}.`}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left - Order Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status + Header */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${config.color}`}>
                {config.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-zinc-900">
                  {order.external_id || `#${order.id}`}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${config.color}`}>
                    {config.label}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {order.created_at ? new Date(order.created_at).toLocaleString('tr-TR') : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Trendyol: İşleme Al - only main orders, NOT sub-orders (B2B supplier) */}
            {isTrendyol && order.status === 'pending' && !isSubOrder && (
              <div className="mt-6 border-t border-zinc-100 pt-4">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Trendyol Sipariş İşlemleri</p>
                {cargoCompany && (
                  <p className="mt-2 text-xs text-zinc-500">Kargo: <span className="font-medium text-zinc-700">{cargoCompany}</span></p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={approveTrendyolOrder} disabled={updating}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                    <ThumbsUp className="h-4 w-4" /> İşleme Al
                  </button>
                  <button onClick={downloadLabel} disabled={labelLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
                    <Barcode className="h-4 w-4" /> Kargo Etiketini İndir
                  </button>
                </div>
                <p className="mt-2 text-xs text-zinc-400">Siparişi işleme aldıktan sonra kargo takibi Trendyol ve kargo şirketi arasında otomatik güncellenir.</p>
              </div>
            )}

            {/* Trendyol: label download for everyone (main + sub-orders) */}
            {isTrendyol && (
            <div className="mt-6 border-t border-zinc-100 pt-4">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                {isSubOrder ? 'Kargo Etiketi' : 'Trendyol Sipariş İşlemleri'}
              </p>
              {cargoCompany && (
                <p className="mt-2 text-xs text-zinc-500">Kargo: <span className="font-medium text-zinc-700">{cargoCompany}</span></p>
              )}
              {isSubOrder && order.status === 'pending' && (
                <p className="mt-2 text-xs text-amber-600">Bu B2B tedarikçi alt siparişidir. İşleme alma işlemi ana sipariş sahibi tarafından yapılır. Etiketi yine de indirebilirsiniz.</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {labelZpl ? (
                  <button onClick={downloadLabel}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                    <Barcode className="h-4 w-4" /> Kargo Etiketini İndir (ZPL)
                  </button>
                ) : labelUrl ? (
                  <a href={labelUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                    <Barcode className="h-4 w-4" /> Kargo Etiketini İndir
                  </a>
                ) : (
                  <button onClick={downloadLabel} disabled={labelLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
                    <Barcode className="h-4 w-4" /> Kargo Etiketini İndir
                  </button>
                )}
                {cargoCompany && !/TEX|Aras/i.test(cargoCompany) && (
                  <p className="mt-2 w-full text-xs text-amber-600">Kargo firması ({cargoCompany}) için etiket Trendyol üzerinden alınamaz. Lütfen kargo firmasından temin ediniz.</p>
                )}
              </div>
              {!isSubOrder && (
                <p className="mt-2 text-xs text-zinc-400">Sipariş durumu Trendyol tarafından otomatik güncellenir. Kargo takibi için Trendyol panelini kullanın.</p>
              )}
            </div>
            )}

            {/* Non-Trendyol: status flow */}
            {!isTrendyol && nextStatuses.length > 0 && (
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
              {(order.items ?? []).map((item: any, i: number) => (
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

          {/* Non-Trendyol: Tracking section */}
          {!isTrendyol && (
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
          </div>)}

          {order.marketplace === 'pazarama' && !isSubOrder && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-900">Pazarama işlemleri</h3>
              <input value={invoiceLink} onChange={e => setInvoiceLink(e.target.value)} placeholder="Fatura PDF bağlantısı" className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
              <button onClick={sendPazaramaInvoice} disabled={updating || !invoiceLink} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">Fatura bağlantısını gönder</button>
              <input value={refundId} onChange={e => setRefundId(e.target.value)} placeholder="Pazarama iade ID" className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
              <div className="flex gap-2"><button onClick={() => processPazaramaReturn('approve')} disabled={updating || !refundId} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">İadeyi onayla</button><button onClick={() => processPazaramaReturn('reject')} disabled={updating || !refundId} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-50">İadeyi reddet</button></div>
            </div>
          )}

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

          {/* Sub-orders */}
          {order.sub_orders && order.sub_orders.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-zinc-900">Tedarikçi Alt Siparişleri</h3>
              <div className="mt-4 space-y-3">
                {order.sub_orders.map((sub: any) => {
                  const sup = sub.supplier
                  const existing = sup ? ratings[sup.id] : null
                  const canRate = order.status === 'delivered' && !!sup
                  return (
                    <div key={sub.id} className="rounded-lg border border-zinc-100 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900">#{sub.external_id || sub.id}</p>
                          <p className="text-xs text-zinc-500">{sub.items?.length || 0} ürün{sup ? ` · ${sup.name || 'Tedarikçi'}` : ''}</p>
                          {existing && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-0.5 text-xs text-amber-600">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <Star key={n} className={`h-3.5 w-3.5 ${n <= existing.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'}`} />
                                ))}
                              </span>
                              <span className="text-[11px] text-zinc-400">{existing.comment || 'Puanlandı'}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-right">
                          <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_CONFIG[sub.status]?.color || 'bg-zinc-100 text-zinc-700'}`}>
                            {STATUS_CONFIG[sub.status]?.label || sub.status}
                          </span>
                          {canRate && (
                            <button
                              onClick={() => { setRatingOpen(sup.id); setRatingScore(existing?.rating || 5); setRatingComment(existing?.comment || '') }}
                              className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                            >
                              {existing ? 'Puanı Düzenle' : 'Tedarikçiyi Puanla'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right - Customer & Details */}
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-zinc-900">Müşteri</h3>
            {order.customer_name ? (
              <div className="mt-3 space-y-2 text-sm">
                <p className="text-zinc-700 font-medium">{order.customer_name}</p>
                {order.customer_email && <p className="text-zinc-500">{order.customer_email}</p>}
                {order.customer_phone && <p className="text-zinc-500">{order.customer_phone}</p>}
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-400">Müşteri bilgisi bulunamadı</p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-zinc-900">Teslimat</h3>
            <p className="mt-2 text-sm text-zinc-600 whitespace-pre-wrap">{order.shipping_address || '—'}</p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-zinc-900">Sipariş Detayları</h3>
            <div className="mt-3 space-y-2 text-sm">
              {labelField('Pazaryeri', order.marketplace)}
              {labelField('Sipariş No', order.external_id)}
              {labelField('Sipariş ID', `#${order.id}`)}
              {labelField('Durum', STATUS_CONFIG[order.status]?.label)}
              {labelField('Ödeme Yöntemi', order.payment_method)}
              {labelField('Ödeme Durumu', order.payment_status)}
              {order.payment_status === 'paid' && (
                <button
                  onClick={handleRefund}
                  disabled={refunding}
                  className="mt-1 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {refunding ? 'İşleniyor...' : 'Para İadesi Yap'}
                </button>
              )}
              {cargoCompany && labelField('Kargo Firması', cargoCompany)}
              {order.tracking_number && labelField('Kargo Takip', order.tracking_number)}
              {order.tracking_company && labelField('Kargo Şirketi', order.tracking_company)}
              <div className="border-t border-zinc-100 pt-2 mt-2">
                {labelField('Ara Toplam', `${parseFloat(order.subtotal).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${order.currency}`)}
                {labelField('Kargo', `${parseFloat(order.shipping).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${order.currency}`)}
                {labelField('Vergi', `${parseFloat(order.tax).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${order.currency}`)}
                <div className="flex justify-between border-t border-zinc-200 pt-2 mt-2 font-semibold">
                  <span className="text-zinc-900">Toplam</span>
                  <span className="text-zinc-900">{parseFloat(order.grand_total).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {order.currency}</span>
                </div>
              </div>
              <div className="border-t border-zinc-100 pt-2 mt-2">
                {labelField('Oluşturulma', order.created_at ? new Date(order.created_at).toLocaleString('tr-TR') : null)}
              </div>
            </div>
          </div>

          {order.note && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-zinc-900">Not</h3>
              <p className="mt-2 text-sm text-zinc-600 whitespace-pre-wrap">{order.note}</p>
            </div>
          )}

          {/* Raw Data Toggle */}
          {rawData && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <button onClick={() => setShowRawPayload(!showRawPayload)}
                className="flex w-full items-center justify-between text-sm font-semibold text-zinc-900">
                Ham Veri
                {showRawPayload ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showRawPayload && (
                <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
                  {JSON.stringify(rawData, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>

      {ratingOpen != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRatingOpen(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900">Tedarikçiyi Puanla</h3>
              <button onClick={() => setRatingOpen(null)} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRatingScore(n)} className="p-1">
                  <Star className={`h-8 w-8 ${n <= ratingScore ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'}`} />
                </button>
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-zinc-500">
              {['Çok kötü', 'Kötü', 'Orta', 'İyi', 'Mükemmel'][ratingScore - 1]}
            </p>
            <textarea
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="Yorum (opsiyonel)"
              rows={3}
              className="mt-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={() => submitRating(ratingOpen)}
              disabled={ratingSaving}
              className="mt-4 w-full rounded-lg bg-amber-600 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {ratingSaving ? 'Kaydediliyor...' : 'Puanı Kaydet'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
