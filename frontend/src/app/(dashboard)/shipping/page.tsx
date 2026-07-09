'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import { Truck, Save } from 'lucide-react'

interface ShippingData {
  id: number
  method: string
  flat_rate: number
  free_shipping_threshold: number | null
  zones: any[] | null
  is_active: boolean
}

export default function ShippingPage() {
  const [data, setData] = useState<ShippingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ method: 'flat_rate', flat_rate: '', free_shipping_threshold: '', is_active: true })

  useEffect(() => {
    api.getShippingSettings()
      .then((res) => {
        setData(res)
        setForm({
          method: res.method,
          flat_rate: String(res.flat_rate),
          free_shipping_threshold: res.free_shipping_threshold !== null ? String(res.free_shipping_threshold) : '',
          is_active: res.is_active,
        })
      })
      .catch(() => setMessage('Yüklenirken hata'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setMessage('')
    try {
      const payload: any = {
        method: form.method,
        flat_rate: parseFloat(form.flat_rate) || 0,
        is_active: form.is_active,
      }
      if (form.method === 'flat_rate' && form.free_shipping_threshold) {
        payload.free_shipping_threshold = parseFloat(form.free_shipping_threshold)
      }
      const res = await api.updateShippingSettings(payload)
      setData(res)
      setMessage('Kargo ayarları kaydedildi')
    } catch (err: any) {
      setMessage(err.message || 'Hata')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-zinc-500">Yükleniyor...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Kargo Ayarları</h1>
      <p className="mt-1 text-sm text-zinc-400">Mağazan için kargo yöntemini belirle.</p>

      {message && <div className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm text-green-400">{message}</div>}

      <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-900 p-6">
        <div className="flex items-center gap-3">
          <Truck className="h-5 w-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-white">Kargo Yöntemi</h2>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400">Yöntem</label>
            <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white">
              <option value="flat_rate">Sabit Ücret</option>
              <option value="free">Ücretsiz Kargo</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400">Sabit Kargo Ücreti (₺)</label>
              <input type="number" min="0" step="0.01" value={form.flat_rate} onChange={e => setForm({ ...form, flat_rate: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400">Bedava Kargo Eşiği (₺) — opsiyonel</label>
              <input type="number" min="0" step="0.01" value={form.free_shipping_threshold} onChange={e => setForm({ ...form, free_shipping_threshold: e.target.value })}
                placeholder="Boş bırakılırsa devre dışı"
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
            </div>
          </div>

          <p className="text-xs text-zinc-500">
            {form.method === 'free'
              ? 'Tüm siparişlerde ücretsiz kargo uygulanır.'
              : form.free_shipping_threshold
                ? `${parseFloat(form.free_shipping_threshold).toLocaleString('tr-TR')} ₺ ve üzeri siparişlerde kargo ücretsiz, altında ${parseFloat(form.flat_rate || '0').toLocaleString('tr-TR')} ₺ kargo ücreti alınır.`
                : `Her sipariş için ${parseFloat(form.flat_rate || '0').toLocaleString('tr-TR')} ₺ sabit kargo ücreti alınır.`}
          </p>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })}
              className="rounded border-zinc-600 bg-zinc-800" />
            Kargo aktif
          </label>

          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}