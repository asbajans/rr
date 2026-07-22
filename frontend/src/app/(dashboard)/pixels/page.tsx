'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import { BarChart3, Tag, Hash, Globe, ShoppingBag, Music, Store, Code, ChevronDown, ChevronRight } from 'lucide-react'

type PixelPlatform = {
  key: string
  label: string
  icon: React.ReactNode
  fields: { key: string; label: string; type?: string; placeholder?: string }[]
  description: string
}

const PIXEL_PLATFORMS: PixelPlatform[] = [
  {
    key: 'google_analytics',
    label: 'Google Analytics',
    icon: <BarChart3 className="h-5 w-5" />,
    description: 'GA4 ölçüm ID\'si ile site trafiğini takip et.',
    fields: [{ key: 'measurement_id', label: 'Ölçüm ID', placeholder: 'G-XXXXXXXXXX' }],
  },
  {
    key: 'google_tag_manager',
    label: 'Google Tag Manager',
    icon: <Tag className="h-5 w-5" />,
    description: 'Google Tag Manager kapsayıcı ID\'si ile etiketleri yönet.',
    fields: [{ key: 'container_id', label: 'Kapsayıcı ID', placeholder: 'GTM-XXXXXXX' }],
  },
  {
    key: 'google_merchant_center',
    label: 'Google Merchant Center',
    icon: <ShoppingBag className="h-5 w-5" />,
    description: 'Google Merchant Center satıcı ID\'si ile ürünleri eşleştir.',
    fields: [{ key: 'merchant_id', label: 'Satıcı ID', placeholder: '123456789' }],
  },
  {
    key: 'facebook_pixel',
    label: 'Facebook Pixel',
    icon: <Globe className="h-5 w-5" />,
    description: 'Facebook Pixel ID\'si ile dönüşüm takibi ve reklam optimizasyonu.',
    fields: [{ key: 'pixel_id', label: 'Pixel ID', placeholder: '1234567890' }],
  },
  {
    key: 'instagram',
    label: 'Instagram',
    icon: <Store className="h-5 w-5" />,
    description: 'Instagram işletme hesabı bağlantısı.',
    fields: [{ key: 'business_account_id', label: 'İşletme Hesap ID', placeholder: '1234567890' }],
  },
  {
    key: 'tiktok_pixel',
    label: 'TikTok Pixel',
    icon: <Music className="h-5 w-5" />,
    description: 'TikTok Pixel ID\'si ile dönüşüm takibi.',
    fields: [{ key: 'pixel_id', label: 'Pixel ID', placeholder: 'TT-XXXXXXX' }],
  },
  {
    key: 'custom_head',
    label: 'Özel Head Kodu',
    icon: <Code className="h-5 w-5" />,
    description: 'Site <head> etiketine eklenecek özel kod (meta etiketleri, scriptler).',
    fields: [{ key: 'code', label: 'HTML Kodu', type: 'textarea', placeholder: '<meta name="..." content="...">' }],
  },
  {
    key: 'custom_body',
    label: 'Özel Body Kodu',
    icon: <Code className="h-5 w-5" />,
    description: 'Site <body> başlangıcına eklenecek özel kod (pixeller, widgetlar).',
    fields: [{ key: 'code', label: 'HTML Kodu', type: 'textarea', placeholder: '<script>...</script>' }],
  },
]

const DEFAULT_PIXELS: Record<string, any> = {}
for (const p of PIXEL_PLATFORMS) {
  const cfg: any = { enabled: false }
  for (const f of p.fields) cfg[f.key] = ''
  DEFAULT_PIXELS[p.key] = cfg
}

export default function PixelsPage() {
  const { user } = useAuth()
  const [pixels, setPixels] = useState<Record<string, any>>(DEFAULT_PIXELS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.getPixels()
      .then((data) => {
        const merged: Record<string, any> = {}
        for (const p of PIXEL_PLATFORMS) {
          const existing = data[p.key]
          const defaults: any = { enabled: false }
          for (const f of p.fields) defaults[f.key] = existing?.[f.key] ?? ''
          merged[p.key] = { ...defaults, enabled: existing?.enabled ?? false }
        }
        setPixels(merged)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setMessage('')
    try {
      await api.updatePixels(pixels)
      setMessage('Piksel ve takip kodları kaydedildi.')
    } catch (err: any) {
      setMessage(err.message || 'Hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  function toggle(key: string) {
    setPixels((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key]?.enabled },
    }))
  }

  function updateField(platform: string, field: string, value: string) {
    setPixels((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value },
    }))
  }

  if (!user) return null

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Piksel & Takip Kodları</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Google Analytics, Facebook Pixel, TikTok ve diğer takip kodlarını mağazana ekle.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="rounded-lg bg-zinc-900 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>

      {message && (
        <div className={`mt-4 rounded-lg p-3 text-sm ${
          message.includes('Hata') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>{message}</div>
      )}

      {loading && <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>}

      {!loading && (
        <div className="mt-6 space-y-3">
          {PIXEL_PLATFORMS.map((platform) => {
            const cfg = pixels[platform.key] || {}
            const isExpanded = expanded === platform.key

            return (
              <div key={platform.key} className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-50"
                  onClick={() => setExpanded(isExpanded ? null : platform.key)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                      {platform.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900">{platform.label}</h3>
                      <p className="text-xs text-zinc-500">{platform.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <label className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer"
                      style={{ backgroundColor: cfg.enabled ? '#22c55e' : '#d1d5db' }}>
                      <input type="checkbox" checked={!!cfg.enabled}
                        onChange={() => toggle(platform.key)}
                        className="sr-only" />
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        cfg.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </label>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-zinc-100 px-4 py-4 space-y-4">
                    {platform.fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-xs font-medium text-zinc-700">{field.label}</label>
                        {field.type === 'textarea' ? (
                          <textarea
                            rows={4}
                            value={cfg[field.key] || ''}
                            onChange={(e) => updateField(platform.key, field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          <input
                            type="text"
                            value={cfg[field.key] || ''}
                            onChange={(e) => updateField(platform.key, field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
