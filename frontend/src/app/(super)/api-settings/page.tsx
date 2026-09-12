'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import { Settings, Eye, EyeOff, Check, AlertCircle } from 'lucide-react'

export default function SuperApiSettingsPage() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({})

  useEffect(() => {
    api.getGlobalSettings()
      .then(r => setSettings(r.settings || {}))
      .catch(() => setMessage('Ayarlar yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  async function saveSetting(key: string, value: string) {
    setSaving(key)
    setMessage('')
    try {
      await api.updateGlobalSetting(key, value)
      setSettings(prev => ({ ...prev, [key]: value }))
      setMessage(`${key} kaydedildi`)
    } catch {
      setMessage(`${key} kaydedilemedi`)
    } finally {
      setSaving(null)
    }
  }

  if (!user) return null

  const sections: { title: string; note?: string; fields: { key: string; label: string; secret: boolean; placeholder?: string; hint?: string }[] }[] = [
    {
      title: 'Etsy (Global)',
      fields: [
        { key: 'etsy_client_id', label: 'Etsy Client ID', secret: false },
        { key: 'etsy_client_secret', label: 'Etsy Client Secret', secret: true },
      ],
    },
    {
      title: 'Amazon SP-API — Global Uygulama Bilgileri',
      note: 'Solution Provider Portal (SPP) uygulamanızın global credential’ları. Seller’a özel refreshToken / sellerId BURADA DEĞİL, her mağazanın Entegrasyonlar > Amazon ayarlarında saklanır (per-store MarketplaceIntegration.config).',
      fields: [
        { key: 'amazon_lwa_client_id', label: 'Amazon LWA Client ID', secret: false, placeholder: 'amzn1.application-oa2-client...', hint: 'developer.amazon.com > LWA Security Profile' },
        { key: 'amazon_lwa_client_secret', label: 'Amazon LWA Client Secret', secret: true, hint: 'LWA Client Secret' },
        { key: 'amazon_aws_access_key', label: 'AWS Access Key ID', secret: false, placeholder: 'AKIA...', hint: 'IAM user/role Access Key' },
        { key: 'amazon_aws_secret_key', label: 'AWS Secret Access Key', secret: true, hint: 'IAM Secret' },
        { key: 'amazon_iam_role_arn', label: 'IAM Role ARN (SP-API)', secret: false, placeholder: 'arn:aws:iam::123456789012:role/SPAPIRole', hint: 'SPP > Application > IAM ARN' },
        { key: 'amazon_application_id', label: 'SP-API Application ID', secret: false, placeholder: 'amzn1.sp.solution...', hint: 'SPP > Application ID' },
        { key: 'amazon_marketplace_id', label: 'Default Marketplace ID', secret: false, placeholder: 'A33AVAJ2PDY3EV (TR)', hint: 'TR=A33AVAJ2PDY3EV, UK=A1F83G8C2ARO7P, DE=A1PA6795UKMFR9' },
        { key: 'amazon_aws_region', label: 'AWS Region', secret: false, placeholder: 'eu-west-1', hint: 'EU için eu-west-1' },
      ],
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Global API Ayarları</h1>
      <p className="mt-1 text-sm text-zinc-600">Pazaryeri entegrasyonları için global API anahtarları</p>

      {message && (
        <div className={`mt-4 rounded-lg p-3 text-sm flex items-center gap-2 ${message.includes('edildi') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.includes('edildi') ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message}
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>
      ) : (
        <div className="mt-6 space-y-8 max-w-2xl">
          {sections.map((sec) => (
            <div key={sec.title} className="space-y-3">
              <div>
                <h2 className="text-sm font-bold text-zinc-800">{sec.title}</h2>
                {sec.note && <p className="mt-1 text-xs leading-relaxed text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">{sec.note}</p>}
              </div>
              {sec.fields.map(({ key, label, secret, placeholder, hint }) => (
                <div key={key} className="rounded-xl border border-zinc-200 bg-white p-4">
                  <label className="block text-sm font-semibold text-zinc-900 mb-1">{label}</label>
                  {hint && <p className="text-[11px] text-zinc-500 mb-2">{hint}</p>}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={secret && !showSecret[key] ? 'password' : 'text'}
                        defaultValue={settings[key] || ''}
                        placeholder={placeholder || ''}
                        className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono pr-10 placeholder:text-zinc-400"
                        id={`input-${key}`}
                      />
                      {secret && (
                        <button
                          type="button"
                          onClick={() => setShowSecret(prev => ({ ...prev, [key]: !prev[key] }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                        >
                          {showSecret[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        const input = document.getElementById(`input-${key}`) as HTMLInputElement
                        if (input) saveSetting(key, input.value)
                      }}
                      disabled={saving === key}
                      className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 shrink-0"
                    >
                      {saving === key ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 leading-relaxed">
            <p className="font-semibold text-zinc-800">Per-store (mağaza) Amazon ayarları:</p>
            <p className="mt-1">Her mağazanın kendi <span className="font-mono">MarketplaceIntegration.config</span> içinde saklanır: <span className="font-mono">sellerId</span>, <span className="font-mono">marketplaceId</span> (override), <span className="font-mono">refreshToken</span>. Global secretlar ile karıştırma — mağaza panelinde Entegrasyonlar &gt; Amazon formundan girilir / OAuth ile doldurulur.</p>
            <p className="mt-2 text-amber-700">Callback URL (SPP & LWA’ye gir): <span className="font-mono">https://api.rahatio.com.tr/api/admin/integrations/amazon/callback</span></p>
          </div>
        </div>
      )}
    </div>
  )
}