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
  const [paymentMethods, setPaymentMethods] = useState<{ method: string; label: string; config?: any }[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [orderId, setOrderId] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [orderToken, setOrderToken] = useState('')
  const [requiresPaymentGateway, setRequiresPaymentGateway] = useState(false)
  const [paymentMethodLabel, setPaymentMethodLabel] = useState('')
  const [initiatingPayment, setInitiatingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [savingAddress, setSavingAddress] = useState(false)
  const [serverTotals, setServerTotals] = useState<{ subtotal: number; shippingAmount: number; taxAmount: number; discountAmount?: number; totalAmount: number } | null>(null)
  const [shippingSettings, setShippingSettings] = useState<any>(null)

  // Form state
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)
  const [showNewAddress, setShowNewAddress] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState('')
  const [note, setNote] = useState('')

  // New address form
  const [addrForm, setAddrForm] = useState({
    full_name: '', phone: '', email: '', city: '', district: '', zip: '', address_line: '', is_default: false,
  })

  const ownerTokenKey = `rahatio_address_token_${siteCode}`

  useEffect(() => {
    if (!siteCode) return
    const ownerToken = localStorage.getItem(ownerTokenKey) || ''
    Promise.all([
      ownerToken
        ? api.getAddresses(siteCode, ownerToken).then(r => {
            setAddresses(r.data)
            if (r.data.length > 0) setSelectedAddressId(r.data[0].id)
          }).catch(() => {})
        : Promise.resolve(),
      api.getCheckoutPaymentMethods(siteCode).then(r => { setPaymentMethods(r.data); if (r.data.length > 0) setSelectedPayment(r.data[0].method) }).catch(() => {}),
      api.getStoreFront(siteCode).then((r: any) => { setShippingSettings(r.store?.shipping_settings || r.store?.shippingSettings || null) }).catch(() => {}),
    ]).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteCode])

  async function persistAddressBook(ownerToken: string) {
    localStorage.setItem(ownerTokenKey, ownerToken)
    const r = await api.getAddresses(siteCode, ownerToken)
    setAddresses(r.data)
    if (r.data.length > 0) {
      setSelectedAddressId(r.data[0].id)
      setShowNewAddress(false)
    }
  }

  async function handleSaveAddress() {
    setSavingAddress(true)
    setError('')
    try {
      const ownerToken = localStorage.getItem(ownerTokenKey) || ''
      const res = await api.saveAddress(siteCode, {
        address: {
          full_name: addrForm.full_name,
          email: addrForm.email,
          phone: addrForm.phone,
          city: addrForm.city,
          district: addrForm.district,
          zip_code: addrForm.zip,
          address: addrForm.address_line,
          is_default: addrForm.is_default,
        },
      }, ownerToken || undefined)
      await persistAddressBook(res.ownerToken || ownerToken)
    } catch (err: any) {
      setError(err.message || 'Adres kaydedilemedi')
    } finally {
      setSavingAddress(false)
    }
  }

  async function handleDeleteAddress(id: number) {
    const ownerToken = localStorage.getItem(ownerTokenKey) || ''
    if (!ownerToken) return
    try {
      await api.deleteAddress(siteCode, id, ownerToken)
      setAddresses(prev => prev.filter(a => a.id !== id))
      if (selectedAddressId === id) setSelectedAddressId(addresses[0]?.id ?? null)
    } catch (err: any) {
      setError(err.message || 'Adres silinemedi')
    }
  }

  const estimatedShipping = (() => {
    if (!shippingSettings) return 0
    const enabled = shippingSettings.enabled ?? shippingSettings.is_active
    if (!enabled) return 0
    const cost = Number(shippingSettings.cost ?? shippingSettings.flat_rate ?? 0) || 0
    const freeAbove = Number(shippingSettings.freeAbove ?? shippingSettings.free_shipping_threshold)
    if (freeAbove > 0 && totalPrice >= freeAbove) return 0
    return cost
  })()

  async function handleSubmit() {
    setProcessing(true)
    setError('')

    const selectedAddr = selectedAddressId
      ? addresses.find(a => a.id === selectedAddressId)
      : undefined

    const shippingAddress = selectedAddr
      ? {
          full_name: selectedAddr.full_name,
          phone: selectedAddr.phone,
          email: selectedAddr.email || undefined,
          city: selectedAddr.city,
          district: selectedAddr.district || undefined,
          address: selectedAddr.address_line,
          zip_code: selectedAddr.zip || undefined,
        }
      : {
          full_name: addrForm.full_name,
          phone: addrForm.phone,
          email: addrForm.email || undefined,
          city: addrForm.city,
          district: addrForm.district || undefined,
          address: addrForm.address_line,
          zip_code: addrForm.zip || undefined,
        }

    try {
      const res = await api.checkout(siteCode, {
        items: items.map(i => ({ product_id: Number(i.product_id), sku: i.sku, quantity: Number(i.quantity) })),
        customer: {
          name: shippingAddress.full_name,
          email: shippingAddress.email || '',
          phone: shippingAddress.phone,
        },
        address_id: selectedAddressId != null ? Number(selectedAddressId) : undefined,
        address_owner_token: selectedAddressId ? (localStorage.getItem(ownerTokenKey) || undefined) : undefined,
        shipping_address: selectedAddressId ? undefined : shippingAddress,
        payment_method: selectedPayment,
        note: note || undefined,
      })

      setOrderId(String(res.orderId))
      setOrderNumber(res.orderNumber)
      setOrderToken(res.orderToken)
      setRequiresPaymentGateway(res.requiresPaymentGateway)
      setPaymentMethodLabel(paymentMethods.find(pm => pm.method === res.paymentMethod)?.label || res.paymentMethod)
      if (res.totals) setServerTotals(res.totals)
      setStep('done')
      clearCart()

      if (res.requiresPaymentGateway && res.orderToken) {
        sessionStorage.setItem(
          `rahatio_pending_order_${siteCode}`,
          JSON.stringify({ orderId: res.orderId, orderNumber: res.orderNumber, orderToken: res.orderToken })
        )
        await continueToPayment(Number(res.orderId), res.orderToken, res.paymentMethod)
      }
    } catch (err: any) {
      setError(err.message || 'Sipariş oluşturulamadı')
    } finally {
      setProcessing(false)
    }
  }

  async function continueToPayment(orderIdNum: number, token: string, _method: string) {
    setInitiatingPayment(true)
    setPaymentError('')
    try {
      const returnUrl = `${window.location.origin}/stores/${siteCode}/checkout/result`
      const res = await api.initiatePayment(siteCode, orderIdNum, token, returnUrl)
      if (res.alreadyPaid) return
      if (res.paymentUrl) {
        window.location.assign(res.paymentUrl)
      } else if (res.clientToken) {
        setPaymentError('Ödeme başlatılamadı: gateway istemci anahtarı eksik. Lütfen daha sonra tekrar deneyin.')
      } else {
        setPaymentError('Ödeme başlatılamadı. Lütfen daha sonra tekrar deneyin.')
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Ödeme başlatılamadı')
    } finally {
      setInitiatingPayment(false)
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
        <p className="mt-2 text-sm text-zinc-600">Sipariş No: <span className="font-mono font-medium">{orderNumber || orderId}</span></p>

        {serverTotals && (
          <div className="mt-4 mx-auto max-w-sm rounded-lg border border-zinc-200 bg-white p-4 text-left text-sm">
            <p className="text-xs font-medium uppercase text-zinc-500 mb-2">Sipariş Özeti</p>
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-zinc-600">Ara Toplam</span><span className="font-medium">{serverTotals.subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span></div>
              {serverTotals.shippingAmount > 0 && (
                <div className="flex justify-between"><span className="text-zinc-600">Kargo</span><span className="font-medium">{serverTotals.shippingAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span></div>
              )}
              {serverTotals.shippingAmount === 0 && (
                <div className="flex justify-between"><span className="text-zinc-600">Kargo</span><span className="font-medium text-green-600">Ücretsiz</span></div>
              )}
              {serverTotals.taxAmount > 0 && (
                <div className="flex justify-between"><span className="text-zinc-600">KDV</span><span className="font-medium">{serverTotals.taxAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span></div>
              )}
              {serverTotals.discountAmount && serverTotals.discountAmount > 0 && (
                <div className="flex justify-between text-green-600"><span>İndirim</span><span className="font-medium">-{serverTotals.discountAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span></div>
              )}
              <div className="flex justify-between border-t border-zinc-200 pt-2 mt-2"><span className="font-semibold text-zinc-900">Toplam</span><span className="text-lg font-bold text-zinc-900">{serverTotals.totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span></div>
            </div>
          </div>
        )}
        {requiresPaymentGateway ? (
          <>
            <p className="mt-1 text-sm text-zinc-600">
              Ödemenizi <span className="font-medium">{paymentMethodLabel}</span> üzerinden tamamladıktan sonra siparişiniz onaylanacaktır.
            </p>
            <div className="mt-4 rounded-lg bg-amber-50 p-4 text-left text-sm text-amber-800">
              <p className="font-medium">Ödeme bekleniyor</p>
              <p className="mt-1">Sipariş takip kodunuzu saklayın:</p>
              <p className="mt-1 font-mono text-xs break-all">{orderToken}</p>
            </div>
            {initiatingPayment && (
              <p className="mt-4 text-sm text-zinc-600">Ödeme sayfasına yönlendiriliyorsunuz...</p>
            )}
            {paymentError && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-left text-sm text-red-700">
                <p>{paymentError}</p>
                <button
                  onClick={() => orderId && orderToken && continueToPayment(Number(orderId), orderToken, paymentMethodLabel)}
                  className="mt-2 inline-flex items-center gap-1 font-medium text-red-800 hover:text-red-900"
                >
                  Tekrar dene
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">Siparişiniz en kısa sürede hazırlanacaktır.</p>
        )}
        <button
          onClick={() => router.push(`/stores/${siteCode}`)}
          className="mt-8 inline-flex items-center gap-1 sf-btn-primary rounded-lg px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800"
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
                <div key={addr.id} className={`block rounded-xl border p-4 transition-colors ${
                  selectedAddressId === addr.id ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200'
                }`}>
                  <label className="flex cursor-pointer items-start justify-between">
                    <input type="radio" name="address" checked={selectedAddressId === addr.id}
                      onChange={() => setSelectedAddressId(addr.id)} className="sr-only" />
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{addr.full_name}</p>
                      <p className="text-xs text-zinc-500">{addr.phone}</p>
                      <p className="mt-1 text-sm text-zinc-600">{addr.address_line}, {addr.district && `${addr.district}, `}{addr.city}/{addr.country}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedAddressId === addr.id && <Check className="h-5 w-5 text-zinc-900" />}
                      <button
                        onClick={(e) => { e.preventDefault(); handleDeleteAddress(addr.id) }}
                        className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-600"
                      >
                        Sil
                      </button>
                    </div>
                  </label>
                </div>
              ))}
              <button onClick={() => setShowNewAddress(true)} className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">
                <Plus className="h-4 w-4" /> Yeni Adres Ekle
              </button>
            </div>
          ) : (
            <AddressForm form={addrForm} onChange={setAddrForm} saving={savingAddress}
              onSave={handleSaveAddress} onBack={addresses.length > 0 ? () => setShowNewAddress(false) : undefined} />
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
                    {selectedPayment === pm.method && pm.method === 'bank_transfer' && (pm as any).config?.iban && (
                      <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm">
                        <p className="text-xs font-medium uppercase text-zinc-500">Banka Hesap Bilgileri</p>
                        {(pm as any).config.bank_name && <p className="mt-1 font-medium text-zinc-900">{String((pm as any).config.bank_name)}</p>}
                        <p className="mt-1 text-zinc-700"><span className="font-medium">IBAN:</span> {String((pm as any).config.iban)}</p>
                        {(pm as any).config.account_holder && <p className="mt-1 text-zinc-700"><span className="font-medium">Alıcı:</span> {String((pm as any).config.account_holder)}</p>}
                        {(pm as any).config.description && <p className="mt-2 text-xs text-zinc-500">{String((pm as any).config.description)}</p>}
                      </div>
                    )}
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
            <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Ara Toplam</span>
                <span className="text-zinc-700">{totalPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Kargo</span>
                {estimatedShipping > 0 ? (
                  <span className="text-zinc-700">{estimatedShipping.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
                ) : (
                  <span className="font-medium text-green-600">Ücretsiz</span>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-zinc-200 pt-2">
                <span className="text-base font-semibold text-zinc-900">Toplam</span>
                <span className="text-xl font-bold text-zinc-900">{(totalPrice + estimatedShipping).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={processing || !selectedPayment}
              className="mt-6 w-full sf-btn-primary rounded-lg px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {processing ? 'İşleniyor...' : 'Siparişi Tamamla'}
            </button>
          </section>
        )}
      </div>
    </div>
  )
}

function AddressForm({ form, onChange, saving, onSave, onBack }: {
  form: { full_name: string; phone: string; email: string; city: string; district: string; zip: string; address_line: string; is_default: boolean }
  onChange: (f: typeof form) => void
  saving: boolean
  onSave: () => void
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
          <label className="block text-xs font-medium text-zinc-700">E-posta</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
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
      <button
        onClick={onSave}
        disabled={saving || !form.full_name || !form.phone || !form.city || !form.address_line}
        className="mt-2 w-full sf-btn-primary rounded-lg px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {saving ? 'Kaydediliyor...' : 'Adresi Kaydet'}
      </button>
    </div>
  )
}
