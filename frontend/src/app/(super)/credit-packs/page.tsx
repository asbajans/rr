'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Plus, Trash2, Star, Save } from 'lucide-react'

type Pack = { credits: number; price: number; popular?: boolean; label?: string }

export default function SuperCreditPacksPage() {
  const [packs, setPacks] = useState<Pack[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.getCreditPacks().then(setPacks).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  function update(idx: number, field: keyof Pack, value: any) {
    setPacks(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  function add() {
    setPacks(prev => [...prev, { credits: 100, price: 100 }])
  }

  function remove(idx: number) {
    setPacks(prev => prev.filter((_, i) => i !== idx))
  }

  function togglePopular(idx: number) {
    setPacks(prev => prev.map((p, i) => i === idx ? { ...p, popular: !p.popular } : { ...p, popular: false }))
  }

  async function save() {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const res = await api.updateCreditPacks(packs)
      setPacks(res)
      setMessage('Paketler kaydedildi — artık billing/credits sayfalarında bu fiyatlar geçerli.')
    } catch (e: any) {
      setError(e.message || 'Kaydetme hatası')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Kredi Paketleri</h1>
          <p className="mt-1 text-sm text-zinc-400">Süperadmin — AI kredi paketlerini ve fiyatlarını yönet. Değişiklikler tüm mağazaların “Kredi Satın Al” alanına yansır. Stripe Checkout fiyatı buradan gelir, webhook krediyi otomatik ekler.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={add} className="flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800">
            <Plus className="h-4 w-4" /> Paket Ekle
          </button>
          <button onClick={save} disabled={saving || packs.length===0} className="flex items-center gap-1 rounded-lg bg-white px-4 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>

      {message && <div className="mt-4 rounded-lg bg-green-900/30 border border-green-800 p-3 text-sm text-green-400">{message}</div>}
      {error && <div className="mt-4 rounded-lg bg-red-900/30 border border-red-800 p-3 text-sm text-red-400">{error}</div>}

      <div className="mt-6 space-y-3">
        {packs.map((p, idx) => (
          <div key={idx} className={`flex items-center gap-3 rounded-xl border p-4 ${p.popular ? 'border-indigo-600 bg-zinc-900 ring-1 ring-indigo-600' : 'border-zinc-700 bg-zinc-900'}`}>
            <div className="grid flex-1 grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400">Kredi</label>
                <input type="number" min={1} value={p.credits} onChange={e => update(idx, 'credits', parseInt(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400">Fiyat (₺)</label>
                <input type="number" min={0} value={p.price} onChange={e => update(idx, 'price', parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400">Etiket (opsiyonel)</label>
                <input value={p.label || ''} onChange={e => update(idx, 'label', e.target.value)} placeholder="Örn. En Popüler"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <button onClick={() => togglePopular(idx)} title="Popüler yap (tek seçim)" className={`p-2 rounded-lg ${p.popular ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}>
              <Star className={`h-4 w-4 ${p.popular ? 'fill-white' : ''}`} />
            </button>
            <button onClick={() => remove(idx)} className="p-2 text-zinc-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {packs.length===0 && <p className="py-8 text-center text-sm text-zinc-500">Henüz paket yok — “Paket Ekle” ile oluştur.</p>}
      </div>

      <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-400">
        <p className="font-medium text-zinc-300">Stripe akışı</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>Satıcı `billing` veya `credits` sayfasında paket seçer → `POST /api/admin/subscription/purchase-credits` → Stripe Checkout `mode:payment` (TRY) açılır — fiyat buradan gelir.</li>
          <li>Ödeme bitince Stripe `checkout.session.completed` → `POST /api/admin/webhook/stripe` (whsec ile doğrulanır, idempotent) → `User.aiCredits` + `CreditLog` yazılır.</li>
          <li>Plan aboneliği için de aynı webhook `checkout.session.completed` → `Subscription` + `Store.planId` günceller; `customer.subscription.*` eventleri (created/updated/paused/resumed/deleted) durum senkronunu sağlar.</li>
          <li>Env sadece platform SAAS Stripe'ı için: `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` → `https://api.rahatio.com.tr/api/admin/webhook/stripe`</li>
        </ul>
      </div>
    </div>
  )
}
