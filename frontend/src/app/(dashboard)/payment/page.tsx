'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { StorePaymentMethod } from '@/lib/types'
import { CreditCard, Landmark, Bitcoin, Wallet, Shield } from 'lucide-react'

const METHOD_ICONS: Record<string, React.ReactNode> = {
  stripe: <CreditCard className="h-5 w-5" />,
  bank_transfer: <Landmark className="h-5 w-5" />,
  crypto: <Bitcoin className="h-5 w-5" />,
  iyzico: <Shield className="h-5 w-5" />,
  paytr: <Wallet className="h-5 w-5" />,
}

export default function PaymentSettingsPage() {
  const { user } = useAuth()
  const [methods, setMethods] = useState<StorePaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setLoading(true)
    api.getPaymentMethods()
      .then((res) => setMethods(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function toggleMethod(method: string, currentActive: boolean) {
    setSaving(method)
    setMessage('')
    try {
      const updated = await api.updatePaymentMethod(method, { is_active: !currentActive })
      setMethods((prev) => prev.map((m) => m.method === method ? { ...m, is_active: !currentActive, id: updated.id } : m))
      setMessage(`${method} ${!currentActive ? 'aktifleştirildi' : 'devre dışı bırakıldı'}`)
    } catch (err: any) {
      setMessage(err.message || 'Hata')
    } finally {
      setSaving(null)
    }
  }

  async function saveConfig(method: string, config: Record<string, string>) {
    setSaving(method)
    setMessage('')
    try {
      await api.updatePaymentMethod(method, { is_active: true, config })
      setMethods((prev) => prev.map((m) => m.method === method ? { ...m, config } : m))
      setMessage(`${method} ayarları kaydedildi`)
    } catch (err: any) {
      setMessage(err.message || 'Hata')
    } finally {
      setSaving(null)
    }
  }

  function renderConfigForm(method: StorePaymentMethod) {
    const fields = Object.keys(method.config || {})
    return (
      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const cfg: Record<string, string> = {}; fd.forEach((v, k) => cfg[k] = v as string); saveConfig(method.method, cfg) }}
        className="mt-4 space-y-3">
        {fields.map((key) => (
          <div key={key}>
            <label className="block text-xs font-medium capitalize text-zinc-700">{key.replace(/_/g, ' ')}</label>
            {key.includes('key') || key.includes('secret') || key.includes('salt') ? (
              <input type="password" name={key} defaultValue={method.config[key] || ''}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono" />
            ) : key.includes('iban') ? (
              <input name={key} defaultValue={method.config[key] || ''}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono uppercase" />
            ) : (
              <input name={key} defaultValue={method.config[key] || ''}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            )}
          </div>
        ))}
        <button type="submit" disabled={saving === method.method}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
          {saving === method.method ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </form>
    )
  }

  if (!user) return null

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Ödeme Yöntemleri</h1>
      <p className="mt-1 text-sm text-zinc-600">Mağazanda kullanılacak ödeme yöntemlerini yapılandır.</p>

      {message && (
        <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div>
      )}

      {loading && <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>}

      {!loading && (
        <div className="mt-6 space-y-4">
          {methods.map((method) => (
            <div key={method.method} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                    {METHOD_ICONS[method.method] || <CreditCard className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">{method.label}</h3>
                    <p className="text-xs text-zinc-400">{method.method}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleMethod(method.method, method.is_active)}
                  disabled={saving === method.method}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    method.is_active ? 'bg-green-500' : 'bg-zinc-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    method.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              {method.is_active && renderConfigForm(method)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
