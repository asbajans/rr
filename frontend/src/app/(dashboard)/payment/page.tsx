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
  cash_on_delivery: <Wallet className="h-5 w-5" />,
}

const METHOD_LABELS: Record<string, string> = {
  stripe: 'Kredi Kartı (Stripe)',
  bank_transfer: 'Banka Havalesi / EFT',
  crypto: 'Kripto Para',
  iyzico: 'Kredi Kartı (Iyzico)',
  paytr: 'Kredi Kartı (PayTR)',
  cash_on_delivery: 'Kapıda Ödeme',
}

const DEFAULT_CONFIG_FIELDS: Record<string, { key: string; label: string; type: string }[]> = {
  stripe: [
    { key: 'publishable_key', label: 'Yayınlanabilir Anahtar', type: 'text' },
    { key: 'secret_key', label: 'Gizli Anahtar', type: 'password' },
    { key: 'webhook_secret', label: 'Webhook Secret', type: 'password' },
  ],
  bank_transfer: [
    { key: 'iban', label: 'IBAN', type: 'text' },
    { key: 'bank_name', label: 'Banka Adı', type: 'text' },
    { key: 'account_holder', label: 'Hesap Sahibi', type: 'text' },
  ],
  iyzico: [
    { key: 'api_key', label: 'API Anahtarı', type: 'password' },
    { key: 'secret_key', label: 'Gizli Anahtar', type: 'password' },
    { key: 'base_url', label: 'Base URL', type: 'text' },
  ],
  paytr: [
    { key: 'merchant_id', label: 'Mağaza Numarası', type: 'text' },
    { key: 'merchant_key', label: 'Mağaza Anahtarı', type: 'password' },
    { key: 'merchant_salt', label: 'Mağaza Salt Değeri', type: 'password' },
  ],
  crypto: [
    { key: 'wallet_address', label: 'Cüzdan Adresi', type: 'text' },
    { key: 'network', label: 'Ağ (ERC20/BEP20/TRC20)', type: 'text' },
  ],
  cash_on_delivery: [
    { key: 'extra_fee', label: 'Ek Ücret (TL)', type: 'text' },
  ],
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
      .then((res) => setMethods(res))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function toggleMethod(method: string, currentActive: boolean) {
    setSaving(method)
    setMessage('')
    try {
      const updated = await api.updatePaymentMethod(method, { isActive: !currentActive })
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
      await api.updatePaymentMethod(method, { isActive: true, config })
      setMethods((prev) => prev.map((m) => m.method === method ? { ...m, config } : m))
      setMessage(`${method} ayarları kaydedildi`)
    } catch (err: any) {
      setMessage(err.message || 'Hata')
    } finally {
      setSaving(null)
    }
  }

  function renderConfigForm(method: StorePaymentMethod) {
    const defaultFields = DEFAULT_CONFIG_FIELDS[method.method] || []
    const existingKeys = Object.keys(method.config || {})
    const fields = existingKeys.length > 0
      ? existingKeys.map(k => {
          const def = defaultFields.find(d => d.key === k)
          return { key: k, label: def?.label || k.replace(/_/g, ' '), type: def?.type || (k.includes('key') || k.includes('secret') || k.includes('salt') ? 'password' : 'text') }
        })
      : defaultFields
    if (fields.length === 0) return null
    return (
      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const cfg: Record<string, string> = {}; fd.forEach((v, k) => cfg[k] = v as string); saveConfig(method.method, cfg) }}
        className="mt-4 space-y-3">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-xs font-medium capitalize text-zinc-700">{field.label}</label>
            {field.type === 'password' ? (
              <input type="password" name={field.key} defaultValue={(method.config as any)?.[field.key] || ''}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono" />
            ) : field.key.includes('iban') ? (
              <input name={field.key} defaultValue={(method.config as any)?.[field.key] || ''}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono uppercase" />
            ) : (
              <input name={field.key} defaultValue={(method.config as any)?.[field.key] || ''}
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
                      <h3 className="text-sm font-semibold text-zinc-900">{METHOD_LABELS[method.method] || method.label}</h3>
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
