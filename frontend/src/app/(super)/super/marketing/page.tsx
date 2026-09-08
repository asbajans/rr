'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import { BarChart3, Tag, Hash, Globe, Music, Code, ChevronDown, ChevronRight, Megaphone, Save, Check, AlertCircle } from 'lucide-react'

type PixelPlatform = {
  key: string
  label: string
  icon: React.ReactNode
  fields: { key: string; label: string; type?: string; placeholder?: string }[]
  description: string
}

const SAAS_PLATFORMS: PixelPlatform[] = [
  {
    key: 'google_analytics',
    label: 'Google Analytics',
    icon: <BarChart3 className="h-5 w-5" />,
    description: 'SaaS ana sayfa (rahatio.com.tr) için GA4 ölçüm ID\'si. Tüm landing trafiğini ölçer.',
    fields: [{ key: 'measurement_id', label: 'Ölçüm ID', placeholder: 'G-XXXXXXXXXX' }],
  },
  {
    key: 'google_tag_manager',
    label: 'Google Tag Manager',
    icon: <Tag className="h-5 w-5" />,
    description: 'SaaS için GTM kapsayıcı ID\'si. Tüm etiketleri tek yerden yönet.',
    fields: [{ key: 'container_id', label: 'Kapsayıcı ID', placeholder: 'GTM-XXXXXXX' }],
  },
  {
    key: 'google_ads',
    label: 'Google Ads',
    icon: <Hash className="h-5 w-5" />,
    description: 'SaaS için Google Ads dönüşüm etiketi (AW-...) — whatsapp / signup / purchase dönüşümlerini takip et. GTM üzerinden her event ayrı tetikleyiciye bağlanabilir.',
    fields: [
      { key: 'conversion_id', label: 'Dönüşüm ID', placeholder: 'AW-XXXXXXXXX' },
      { key: 'conversion_label', label: 'Etiket (opsiyonel)', placeholder: 'XXXXXXXXXXXXXXX' },
    ],
  },
  {
    key: 'facebook_pixel',
    label: 'Meta Pixel (Facebook / Instagram)',
    icon: <Globe className="h-5 w-5" />,
    description: 'Meta Pixel ile tüm dönüşümleri (Purchase / CompleteRegistration / Contact) retargeting ve optimizasyon için takip et.',
    fields: [
      { key: 'pixel_id', label: 'Pixel ID', placeholder: '1234567890' },
      { key: 'domain_verification', label: 'Domain Doğrulama Kodu (opsiyonel)', placeholder: 'facebook-domain-verification' },
    ],
  },
  {
    key: 'tiktok_pixel',
    label: 'TikTok Pixel',
    icon: <Music className="h-5 w-5" />,
    description: 'TikTok Pixel ile tüm SaaS + storefront dönüşümlerini (CompletePayment / CompleteRegistration / Contact) ölç.',
    fields: [{ key: 'pixel_id', label: 'Pixel ID', placeholder: 'TT-XXXXXXX' }],
  },
  {
    key: 'custom_head',
    label: 'Özel Head Kodu',
    icon: <Code className="h-5 w-5" />,
    description: 'SaaS <head> etiketine eklenecek özel kod (meta doğrulama, ek script).',
    fields: [{ key: 'code', label: 'HTML Kodu', type: 'textarea', placeholder: '<meta name="..." content="...">' }],
  },
  {
    key: 'custom_body',
    label: 'Özel Body Kodu',
    icon: <Code className="h-5 w-5" />,
    description: 'SaaS <body> başına eklenecek özel kod (sohbet widgetı, ek piksel). WhatsApp butonu zaten dahili.',
    fields: [{ key: 'code', label: 'HTML Kodu', type: 'textarea', placeholder: '<script>...</script>' }],
  },
]

const DEFAULT_PIXELS: Record<string, any> = {}
for (const p of SAAS_PLATFORMS) {
  const cfg: any = { enabled: false }
  for (const f of p.fields) cfg[f.key] = ''
  DEFAULT_PIXELS[p.key] = cfg
}

export default function SaasMarketingPage() {
  const [pixels, setPixels] = useState<Record<string, any>>(DEFAULT_PIXELS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [expanded, setExpanded] = useState<string | null>('google_analytics')

  useEffect(() => {
    setLoading(true)
    api.getSaasPixels()
      .then((data) => {
        const merged: Record<string, any> = {}
        for (const p of SAAS_PLATFORMS) {
          const existing = (data as any)[p.key]
          const defaults: any = { enabled: false }
          for (const f of p.fields) defaults[f.key] = existing?.[f.key] ?? ''
          merged[p.key] = { ...defaults, enabled: existing?.enabled ?? false }
        }
        setPixels(merged)
      })
      .catch(() => setMessage('Ayarlar yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  const isError = message.includes('Hata') || message.includes('yüklenemedi')

  async function handleSave() {
    setSaving(true)
    setMessage('')
    try {
      await api.updateSaasPixels(pixels)
      setMessage('SaaS pazarlama takip kodları kaydedildi — rahatio.com.tr anında güncellenir.')
    } catch (err: any) {
      setMessage(err.message || 'Kaydedilemedi')
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

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-indigo-400" /> SaaS Pazarlama & Takip
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          rahatio.com.tr (landing + SaaS) için pazarlama etiketleri. Burada tanımlanan GA / GTM / Meta / Google Ads / TikTok kodları tüm ziyaretçiler için landing sayfasına enjekte edilir. Tüm dönüşümler — <span className="text-white font-medium">WhatsApp</span> (<span className="font-mono text-zinc-300">+15054415616</span>), <span className="text-white font-medium">Üye Olma (signup)</span> ve <span className="text-white font-medium">Satın Alma (purchase)</span> — otomatik olarak GA, GTM dataLayer, Meta Pixel, TikTok ve SaaS Analitik’e gönderilir.
        </p>
        <div className="mt-3 rounded-lg border border-indigo-900/40 bg-indigo-950/30 p-3 text-xs leading-relaxed text-zinc-300">
          <span className="font-semibold text-white">Dönüşüm Takibi:</span> Her olay 3 kanaldan izlenir: <br />
          <span className="text-emerald-300">WhatsApp</span> (<code className="rounded bg-zinc-800 px-1 py-0.5">whatsapp_click</code>) — yeşil fab tıklaması<br />
          <span className="text-amber-300">Üye Olma</span> (<code className="rounded bg-zinc-800 px-1 py-0.5">signup</code>) — e-posta veya Google ile kayıt (landing → register, store müşteri kaydı)<br />
          <span className="text-sky-300">Satın Alma</span> (<code className="rounded bg-zinc-800 px-1 py-0.5">purchase</code>) — storefront sipariş + SaaS plan/kredi satın alma<br />
          <span className="text-indigo-300"> GA4 (gtag purchase/sign_up), GTM (dataLayer event: purchase/signup/whatsapp_click), Meta (fbq Purchase/CompleteRegistration/Contact), TikTok (CompletePayment/CompleteRegistration/Contact)</span> ve <span className="text-white">SaaS Analitik + Mağaza İstatistiği</span>’nde hunide görünür.
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
        <span className="text-xs text-zinc-500">Kaydedince landing önbelleklenmeden güncellenir.</span>
      </div>

      {message && (
        <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${isError ? 'bg-red-950/40 text-red-300 border border-red-900/40' : 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/40'}`}>
          {isError ? <AlertCircle className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
          {message}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Yükleniyor...</p>
      ) : (
        <div className="space-y-3">
          {SAAS_PLATFORMS.map((platform) => {
            const cfg = pixels[platform.key] || {}
            const isExpanded = expanded === platform.key
            return (
              <div key={platform.key} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800/50"
                  onClick={() => setExpanded(isExpanded ? null : platform.key)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${cfg.enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                      {platform.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate">{platform.label}</h3>
                      <p className="text-xs text-zinc-500 line-clamp-2">{platform.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <label className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer"
                      style={{ backgroundColor: cfg.enabled ? '#22c55e' : '#3f3f46' }}>
                      <input type="checkbox" checked={!!cfg.enabled}
                        onChange={() => toggle(platform.key)}
                        className="sr-only" />
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cfg.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </label>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-zinc-800 px-4 py-4 space-y-4">
                    {platform.fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-xs font-medium text-zinc-300">{field.label}</label>
                        {field.type === 'textarea' ? (
                          <textarea
                            rows={4}
                            value={cfg[field.key] || ''}
                            onChange={(e) => updateField(platform.key, field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          <input
                            type="text"
                            value={cfg[field.key] || ''}
                            onChange={(e) => updateField(platform.key, field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        )}
                      </div>
                    ))}
                    {platform.key === 'google_ads' && (
                      <p className="text-[11px] text-zinc-500">AW- ID olmadan Google Ads dönüşüm saymaz. Her dönüşüm <code className="bg-zinc-800 px-1 rounded">gtag(&apos;event&apos;,&apos;purchase&apos;|&apos;sign_up&apos;|&apos;whatsapp_click&apos;)</code> + <code className="bg-zinc-800 px-1 rounded">dataLayer</code> olarak tetiklenir; GTM’de ayrı Ads dönüşümlerine bağla.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold text-white">Nasıl çalışır? (Tüm hunisi)</h3>
        <ul className="mt-2 list-disc pl-5 text-xs leading-relaxed text-zinc-400 space-y-1">
          <li><span className="text-zinc-200">Google Analytics (GA4):</span> <code className="bg-zinc-800 px-1 rounded">G-XXXXXXXXXX</code> — <code>page_view</code>, <code>sign_up</code>, <code>purchase</code> (+ value/currency), <code>whatsapp_click</code> otomatik.</li>
          <li><span className="text-zinc-200">Tag Manager:</span> <code className="bg-zinc-800 px-1 rounded">GTM-XXXXXXX</code> — her dönüşüm <code className="bg-zinc-800 px-1 rounded">dataLayer.push({'{'}event: &apos;signup|purchase|whatsapp_click&apos;{'}'})</code>; GTM’de tetikleyici + Google Ads dönüşümüne bağla.</li>
          <li><span className="text-zinc-200">Meta Pixel:</span> <code>PageView</code> + <code>CompleteRegistration</code> (üye) + <code>Purchase</code> (değerli) + <code>Contact</code> (whatsapp) — Ads Manager’da dönüşüm olarak optimize et.</li>
          <li><span className="text-zinc-200">TikTok Pixel:</span> <code>CompleteRegistration</code> + <code>CompletePayment</code> + <code>Contact</code>.</li>
          <li><span className="text-zinc-200">Google Ads:</span> <code>AW-XXXXXXXX</code> — her purchase/sign_up tetiklerinde <code>gtag conversion</code> (GTM üzerinden etiket bağlayarak).</li>
          <li>Süperadmin → <span className="text-zinc-200">SaaS Analitik</span>’te huniyi <span className="text-white">Ziyaret → WhatsApp → Üye → Satın Alma</span> ve günlük seriyi, mağaza satıcısı → <span className="text-zinc-200">Site İstatistiği</span>’nde kendi mağaza hunisini görür.</li>
        </ul>
      </div>
    </div>
  )
}
