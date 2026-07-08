'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import { useCart } from '@/lib/cart'
import type { CustomerAddress } from '@/lib/types'
import { ArrowLeft, Check, Plus } from 'lucide-react'

type Step = 'info' | 'payment' | 'review' | 'done'

export default function CheckoutPage() {
  const { siteCode } = useParams<{ siteCode: string }>()
  const router = useRouter()
  const { items, totalPrice, clearCart } = useCart()

  const [step, setStep] = useState<Step>('info')
  const [addresses, setAddresses] = useState<CustomerAddress[]>([])
  const [paymentMethods, setPaymentMethods] = useState<{ method: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [orderId, setOrderId] = useState('')

  // Form state
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)
  const [showNewAddress, setShowNewAddress] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState('')
  const [note, setNote] = useState('')

  // New address form
  const [addrForm, setAddrForm] = useState({
    full_name: '', phone: '', city: '', district: '', zip: '', address_line: '', is_default: false,
  })

  useEffect(() => {
    if (!siteCode) return
    Promise.all([
      api.getAddresses(siteCode).then(r => { setAddresses(r.data); if (r.data.length > 0) setSelectedAddressId(r.data[0].id) }).catch(() => {}),
      api.getCheckoutPaymentMethods(siteCode).then(r => { setPaymentMethods(r.data); if (r.data.length > 0) setSelectedPayment(r.data[0].method) }).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [siteCode])

  async function handleSubmit() {
    setProcessing(true)
    setError('')

    const customer = selectedAddressId
      ? { name: addresses.find(a => a.id === selectedAddressId)!.full_name, email: '', phone: addresses.find(a => a.id === selectedAddressId)!.phone }
      : { name: addrForm.full_name, email: '', phone: addrForm.phone }

    try {
      const res = await api.checkout(siteCode, {
        items: items.map(i => ({ product_id: i.product_id, sku: i.sku, name: i.name, quantity: i.quantity, unit_price: i.price })),
        customer,
        address_id: selectedAddressId ?? undefined,
        shipping: selectedAddressId ? undefined : {
          full_name: addrForm.full_name,
          phone: addrForm.phone,
          city: addrForm.city,
          address_line: addrForm.address_line,
        },
        payment_method: selectedPayment,
        note: note || undefined,
      })

      setOrderId(res.order_id)
      setStep('done')
      clearCart()
    } catch (err: any) {
      setError(err.message || 'Sipariş oluşturulamadı')
    } finally {
      setProcessing(false)
    }
  }

  if (items.length === 0 && step !== 'done') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-zinc-900">Ödeme</h1>
        <p className="mt-4 text-sm text-zinc-500">Sepetin boş.</p>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-zinc-900">Siparişiniz Alındı!</h1>
        <p className="mt-2 text-sm text-zinc-600">Sipariş No: <span className="font-mono font-medium">{orderId}</span></p>
        <p className="mt-1 text-sm text-zinc-500">Siparişiniz en kısa sürede hazırlanacaktır.</p>
        <button
          onClick={() => router.push(`/store/${siteCode}`)}
          className="mt-8 inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" /> Alışverişe Devam Et
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-zinc-900">Ödeme</h1>

      {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Steps */}
      <div className="mt-8 space-y-8">
        {/* 1. Shipping Info */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Teslimat Bilgileri</h2>

          {loading ? (
            <p className="mt-2 text-sm text-zinc-500">Yükleniyor...</p>
          ) : addresses.length > 0 && !showNewAddress ? (
            <div className="mt-4 space-y-3">
              {addresses.map(addr => (
                <label key={addr.id} className={`block cursor-pointer rounded-xl border p-4 transition-colors ${
                  selectedAddressId === addr.id ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200'
                }`}>
                  <input type="radio" name="address" checked={selectedAddressId === addr.id}
                    onChange={() => setSelectedAddressId(addr.id)} className="sr-only" />
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{addr.full_name}</p>
                      <p className="text-xs text-zinc-500">{addr.phone}</p>
                      <p className="mt-1 text-sm text-zinc-600">{addr.address_line}, {addr.district && `${addr.district}, `}{addr.city}/{addr.country}</p>
                    </div>
                    {selectedAddressId === addr.id && <Check className="h-5 w-5 text-zinc-900" />}
                  </div>
                </label>
              ))}
              <button onClick={() => setShowNewAddress(true)} className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">
                <Plus className="h-4 w-4" /> Yeni Adres Ekle
              </button>
            </div>
          ) : (
            <AddressForm form={addrForm} onChange={setAddrForm} onBack={addresses.length > 0 ? () => setShowNewAddress(false) : undefined} />
          )}
        </section>

        {/* 2. Payment */}
        {!showNewAddress && (
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">Ödeme Yöntemi</h2>
            {loading ? (
              <p className="mt-2 text-sm text-zinc-500">Yükleniyor...</p>
            ) : (
              <div className="mt-4 space-y-3">
                {paymentMethods.map(pm => (
                  <label key={pm.method} className={`block cursor-pointer rounded-xl border p-4 transition-colors ${
                    selectedPayment === pm.method ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200'
                  }`}>
                    <input type="radio" name="payment" checked={selectedPayment === pm.method}
                      onChange={() => setSelectedPayment(pm.method)} className="sr-only" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-900">{pm.label}</span>
                      {selectedPayment === pm.method && <Check className="h-5 w-5 text-zinc-900" />}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 3. Note */}
        {!showNewAddress && (
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">Sipariş Notu</h2>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="İsteğe bağlı..." rows={3}
              className="mt-2 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </section>
        )}

        {/* 4. Review */}
        {!showNewAddress && (
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">Sipariş Özeti</h2>
            <div className="mt-4 space-y-3">
              {items.map(item => (
                <div key={item.sku} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600">{item.name} <span className="text-zinc-400">x{item.quantity}</span></span>
                  <span className="font-medium text-zinc-900">{(item.price * item.quantity).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4">
              <span className="text-base font-semibold text-zinc-900">Toplam</span>
              <span className="text-xl font-bold text-zinc-900">{totalPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
            </div>

            <button
              onClick={handleSubmit}
              disabled={processing || !selectedPayment}
              className="mt-6 w-full rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {processing ? 'İşleniyor...' : 'Siparişi Tamamla'}
            </button>
          </section>
        )}
      </div>
    </div>
  )
}

function AddressForm({ form, onChange, onBack }: {
  form: { full_name: string; phone: string; city: string; district: string; zip: string; address_line: string; is_default: boolean }
  onChange: (f: typeof form) => void
  onBack?: () => void
}) {
  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    onChange({ ...form, [key]: value })
  }

  return (
    <div className="mt-4 space-y-3">
      {onBack && (
        <button onClick={onBack} className="text-sm text-zinc-500 hover:text-zinc-900">← Kayıtlı adresler</button>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-zinc-700">Ad Soyad</label>
          <input value={form.full_name} onChange={e => set('full_name', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">Telefon</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">İl</label>
          <input value={form.city} onChange={e => set('city', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">İlçe</label>
          <input value={form.district} onChange={e => set('district', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">Posta Kodu</label>
          <input value={form.zip} onChange={e => set('zip', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Adres</label>
        <textarea value={form.address_line} onChange={e => set('address_line', e.target.value)} rows={2}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-600">
        <input type="checkbox" checked={form.is_default} onChange={e => set('is_default', e.target.checked)}
          className="rounded border-zinc-300" />
        Varsayılan adres yap
      </label>
    </div>
  )
}
