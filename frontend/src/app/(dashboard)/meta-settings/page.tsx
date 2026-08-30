'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import { CardSkeleton } from '@/components/ui/skeleton'
import { FlaskConical, Loader2 } from 'lucide-react'

export default function MetaSettingsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ meta_app_id: '', meta_app_secret: '', meta_graph_version: 'v26.0', meta_oauth_scopes: 'catalog_management' })
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
          meta_oauth_scopes: String(m.meta_oauth_scopes?.value ?? m.meta_oauth_scopes ?? 'catalog_management'),
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
      await api.updateGlobalSetting('meta_oauth_scopes', form.meta_oauth_scopes || 'catalog_management')
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
          <div>
            <label className="block text-xs font-medium text-zinc-700">OAuth Scopes (izinler)</label>
            <input value={form.meta_oauth_scopes} onChange={e => setForm(f => ({ ...f, meta_oauth_scopes: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs font-mono" />
            <p className="mt-1 text-xs text-zinc-500">Hatalı “Invalid Scopes” aldığın için şu an <span className="font-mono">catalog_management</span> ile başla. App Type Business + Facebook Login for Business aktif edip App Review sonrası tam listeye geç: <span className="font-mono text-[11px]">pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_metadata,instagram_basic,instagram_content_publish,catalog_management,business_management</span> <button onClick={() => setForm(f => ({ ...f, meta_oauth_scopes: 'pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_metadata,instagram_basic,instagram_content_publish,catalog_management,business_management' }))} className="ml-1 underline text-indigo-600">Tam listeyi yükle</button></p>
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

          {/* Superadmin test area — inline (sadece superadmin) */}
          {user?.role === 'superadmin' && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-indigo-900 flex items-center gap-1.5"><FlaskConical className="h-4 w-4" /> Meta Test Alanı (sadece süperadmin)</p>
              <p className="text-xs text-indigo-700">Tüm endpoint'leri tek tıkla test et. Hata mesajları eksik izinleri gösterir (F12 → Network/Console).</p>
              <div className="grid gap-2">
                {[
                  { name: 'Yorumlar', path: '/api/admin/integrations/facebook/ig/comments' },
                  { name: 'Mesajlar', path: '/api/admin/integrations/facebook/ig/messages' },
                  { name: 'Reklamlar', path: '/api/admin/integrations/facebook/ads' },
                  { name: 'İstatistik', path: '/api/admin/integrations/facebook/page/insights' },
                  { name: 'IG Hesap', path: '/api/admin/integrations/facebook/ig/account' },
                ].map(item => (
                  <TestButton key={item.name} path={item.path} label={item.name} />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
            <p className="font-medium text-zinc-900">Token nereye girilir?</p>
            <p className="mt-1">Hiçbir satıcı token girmez. Satıcı Marketing → Meta'yu Otomatik Bağla deyince Facebook login popup'ında izin verir, token bizde <code className="bg-zinc-200 px-1 rounded">MarketplaceIntegration.config</code>'te saklanır (60 gün, günlük yenilenir). Senin girmen gereken tek şey bu sayfadaki App ID/Secret.</p>
            <p className="mt-1 text-zinc-500">Facebook SDK: ayrıca npm paketi kurmadık. Akış Graph API v26 OAuth redirect (<code className="bg-zinc-200 px-1 rounded">https://www.facebook.com/v26.0/dialog/oauth</code>) ile — JS SDK gerekmez. FBE için gerekirse <code className="bg-zinc-200 px-1 rounded">connect.facebook.net/en_US/sdk.js</code> otomatik yüklenir.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function TestButton({ path, label }: { path: string; label: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [ok, setOk] = useState<boolean | null>(null)
  return (
    <div className="rounded-lg bg-white border border-indigo-200 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-zinc-700">{label} <span className="font-mono text-[10px] text-zinc-500">{path}</span></span>
        <button
          onClick={async () => {
            setLoading(true); setResult(null); setOk(null)
            try { const r = await api.get(path); setResult(JSON.stringify(r, null, 2).slice(0, 800)); setOk(true) }
            catch (e: any) { setResult('Hata: ' + (e?.data?.error || e.message || 'Bilinmeyen hata')); setOk(false) }
            finally { setLoading(false) }
          }}
          disabled={loading}
          className="shrink-0 rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Test
        </button>
      </div>
      {result && (
        <pre className={`mt-2 max-h-40 overflow-auto rounded p-2 text-[11px] whitespace-pre-wrap break-all ${ok ? 'bg-zinc-900 text-green-300' : 'bg-red-50 text-red-700 border border-red-200'}`}>{result}</pre>
      )}
    </div>
  )
}
