'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api-client'
import { storeBase } from '@/lib/store-path'
import { ArrowLeft, Check, X, RefreshCw } from 'lucide-react'

function ResultInner() {
  const { siteCode } = useParams<{ siteCode: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const payment = searchParams.get('payment')
  const orderIdParam = searchParams.get('orderId')

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let pending: { orderId: number; orderNumber: string; orderToken: string } | null = null
    try {
      const raw = sessionStorage.getItem(`rahatio_pending_order_${siteCode}`)
      if (raw) pending = JSON.parse(raw)
    } catch {
      pending = null
    }
    const orderId = orderIdParam || (pending ? String(pending.orderId) : '')
    const token = pending?.orderToken || ''

    if (!orderId) {
      setLoading(false)
      setError('Sipariş bilgisi bulunamadı.')
      return
    }
    if (!token) {
      setLoading(false)
      return
    }

    api.getOrderTracking(siteCode, orderId, token)
      .then(r => {
        setOrder(r.order)
        setLoading(false)
        if (payment === 'success' && r.order.paymentStatus !== 'paid') {
          // Poll until the webhook confirms the payment
          let attempts = 0
          const timer = setInterval(() => {
            attempts += 1
            api.getOrderTracking(siteCode, orderId, token)
              .then(r2 => {
                setOrder(r2.order)
                if (r2.order.paymentStatus === 'paid' || r2.order.status === 'confirmed' || attempts >= 20) {
                  clearInterval(timer)
                }
              })
              .catch(() => {
                clearInterval(timer)
              })
          }, 3000)
          return () => clearInterval(timer)
        }
      })
      .catch(() => {
        setOrder(null)
        setLoading(false)
        setError('Sipariş durumu alınamadı.')
      })
  }, [siteCode, orderIdParam, payment])

  const succeeded = payment === 'success' || order?.paymentStatus === 'paid'

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 text-center">
      <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${succeeded ? 'bg-green-100' : 'bg-red-100'}`}>
        {succeeded ? <Check className="h-8 w-8 text-green-600" /> : <X className="h-8 w-8 text-red-600" />}
      </div>
      <h1 className="mt-6 text-2xl font-bold text-zinc-900">
        {succeeded ? 'Ödeme Alındı!' : payment === 'cancelled' ? 'Ödeme İptal Edildi' : 'Ödeme İşlemi'}
      </h1>

      {loading && <p className="mt-4 text-sm text-zinc-500">Sipariş durumu alınıyor...</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {order && (
        <div className="mt-6 rounded-2xl border border-zinc-200 p-6 text-left">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-600">Sipariş No</p>
            <p className="font-mono font-medium text-zinc-900">{order.orderNumber}</p>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm text-zinc-600">Durum</p>
            <p className="text-sm font-medium text-zinc-900">{order.status}</p>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm text-zinc-600">Ödeme</p>
            <p className="text-sm font-medium text-zinc-900">{order.paymentStatus}</p>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm text-zinc-600">Tutar</p>
            <p className="text-sm font-medium text-zinc-900">
              {Number(order.totalAmount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {order.currency || 'TRY'}
            </p>
          </div>
          {order.trackingNumber && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm text-zinc-600">Kargo Takip No</p>
              <p className="text-sm font-medium text-zinc-900">{order.trackingNumber} {order.carrier && `(${order.carrier})`}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <button
          onClick={() => router.push(storeBase(siteCode))}
          className="inline-flex items-center gap-1 sf-btn-primary rounded-lg px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" /> Alışverişe Devam Et
        </button>
        {!succeeded && payment !== 'success' && (
          <button
            onClick={() => router.push(`${storeBase(siteCode)}/checkout`)}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <RefreshCw className="h-4 w-4" /> Yeniden Dene
          </button>
        )}
      </div>
    </div>
  )
}

export default function CheckoutResultPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-zinc-500">Yükleniyor...</div>}>
      <ResultInner />
    </Suspense>
  )
}
