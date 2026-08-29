'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import { CardSkeleton } from '@/components/ui/skeleton'

export default function MetaSettingsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ meta_app_id: '', meta_app_secret: '', meta_graph_version: 'v26.0' })
  const [redirectUri, setRedirectUri] = useState('https://api.rahatio.com.tr/api/admin/integrations/facebook/oauth/callback')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    Promise.allSettled([api.getGlobalSettings(), api.getMetaOAuthConfig().catch(() => null as any)]).then(([a, b]) => {
      if (a.status === 'fulfilled') {
        const m = (a.value as any).settings || {}
        setForm({
          meta_app_id: String(m.meta_app_id?.value ?? m.meta_app_id ?? ''),
          meta_app_secret: String(m.meta_app_secret?.value ?? m.meta_app_secret ?? ''),
          meta_graph_version: String(m.meta_graph_version?.value ?? m.meta_graph_version ?? 'v26.0'),
        })
      }
      if (b.status === 'fulfilled' && (b.value as any)?.redirectUri) setRedirectUri((b.value as any).redirectUri)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [user])

  const save = async () => {
    setSaving(true); setMessage('')
    try {
      await api.updateGlobalSetting('meta_app_id', form.meta_app_id)
      await api.updateGlobalSetting('meta_app_secret', form.meta_app_secret)
      await api.updateGlobalSetting('meta_graph_version', form.meta_graph_version || 'v26.0')
      setMessage('Kaydedildi. Artık Marketing → Meta’yı Otomatik Bağla çalışır.')
    } catch (e: any) { setMessage(e.message || 'Kaydedilemedi') } finally { setSaving(false) }
  }

  if (!user) return null
  // superadmin check — backend will 403 if not
  if ((user as any).role !== 'superadmin' && !(user as any).is_admin) {
    return <div className="p-8 text-sm text-red-600">Bu sayfa sadece Super Admin içindir.</div>
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-zinc-900">Meta Ayarları (Super Admin)</h1>
      <p className="mt-1 text-sm text-zinc-600">developers.facebook.com’daki uygulamanın App ID ve App Secret’ı buraya girilir. Kaydedince tüm mağazalar için geçerli olur. Alternatif: .env’de META_APP_ID / META_APP_SECRET.</p>

      {loading ? <div className="mt-6"><CardSkeleton count={2} /></div> : (
        <div className="mt-6 space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
          <div>
            <label className="block text-xs font-medium text-zinc-700">Meta App ID</label>
            <input value={form.meta_app_id} onChange={e => setForm(f => ({ ...f, meta_app_id: e.target.value }))} placeholder="örn. 123456789012345" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono" />
            <p className="mt-1 text-xs text-zinc-500">Uygulama → Ayarlar → Temel → App ID</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Meta App Secret</label>
            <input type="password" value={form.meta_app_secret} onChange={e => setForm(f => ({ ...f, meta_app_secret: e.target.value }))} placeholder="••••••••••••••••" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono" />
            <p className="mt-1 text-xs text-zinc-500">Aynı sayfada “Göster” ile alınır — asla frontend’de paylaşılmaz.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Graph API Versiyonu</label>
            <input value={form.meta_graph_version} onChange={e => setForm(f => ({ ...f, meta_graph_version: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono" />
            <p className="mt-1 text-xs text-zinc-500">Güncel: v26.0 (biz v22→v26 geçtik). Değiştirmen gerekmez.</p>
          </div>
          <button onClick={save} disabled={saving} className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
          {message && <p className={`text-sm ${message.includes('Kaydedildi') ? 'text-green-700 bg-green-50 p-3 rounded-lg' : 'text-red-600'}`}>{message}</p>}

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900">⚠️ En önemli adım — Valid OAuth Redirect URI (beyaz liste)</p>
            <p className="mt-1 text-xs text-amber-800">Aldığın hata (“Yönlendirme URI’si beyaz listede değil”) tam bu yüzden. Aşağıdaki URI’yi <span className="font-medium">aynen</span> eklemelisin:</p>
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-white border border-amber-200 px-3 py-2">
              <code className="flex-1 text-xs font-mono text-zinc-900 break-all">{redirectUri}</code>
              <button onClick={() => { navigator.clipboard.writeText(redirectUri); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="shrink-0 rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800">{copied ? 'Kopyalandı' : 'Kopyala'}</button>
            </div>
            <ol className="mt-2 list-decimal pl-4 text-xs text-amber-800 space-y-1">
              <li><a href="https://developers.facebook.com/" target="_blank" rel="noreferrer" className="underline">developers.facebook.com</a> → Uygulamalarım → senin Meta uygulaman → <span className="font-medium">Facebook Login → Ayarlar</span></li>
              <li><span className="font-medium">Client OAuth Login</span> ve <span className="font-medium">Web OAuth Login</span> → <span className="font-medium">Açık</span> yap</li>
              <li><span className="font-medium">Valid OAuth Redirect URIs</span> alanına yukarıdaki URI’yi yapıştır → <span className="font-medium">Değişiklikleri Kaydet</span></li>
              <li>Aynı sayfada <span className="font-medium">Enforce HTTPS</span> açıksa kalabilir (biz https kullanıyoruz)</li>
              <li>Üstteki <span className="font-medium">Ayarlar → Temel</span> → <span className="font-medium">Uygulama Domainleri</span> → <span className="font-mono">rahatio.com.tr</span> ve <span className="font-mono">api.rahatio.com.tr</span> ekle</li>
            </ol>
            <p className="mt-2 text-xs text-amber-700">Not: URI <span className="font-mono">http</span> değil <span className="font-mono">https</span>, sonunda <span className="font-mono">/</span> yok, birebir aynı olmalı. Ekledikten sonra 1dk bekleyip tekrar “Meta’yı Bağla” dene.</p>
          </div>

          <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
            <p className="font-medium text-zinc-900">Token nereye girilir?</p>
            <p className="mt-1">Hiçbir satıcı token girmez. Satıcı Marketing → Meta’yı Otomatik Bağla deyince Facebook login popup’ında izin verir, token bizde `MarketplaceIntegration.config`’te saklanır (60 gün, günlük yenilenir). Senin girmen gereken tek şey bu sayfadaki App ID/Secret.</p>
            <p className="mt-1 text-zinc-500">Facebook SDK: ayrıca npm paketi kurmadık. Akış Graph API v26 OAuth redirect (`https://www.facebook.com/v26.0/dialog/oauth`) ile — JS SDK gerekmez. FBE için gerekirse `connect.facebook.net/en_US/sdk.js` otomatik yüklenir.</p>
          </div>
        </div>
      )}
    </div>
  )
}
