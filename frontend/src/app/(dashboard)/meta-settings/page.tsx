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

  useEffect(() => {
    if (!user) return
    setLoading(true)
    api.getGlobalSettings().then((res: any) => {
      const m = res.settings || {}
      setForm({
        meta_app_id: String(m.meta_app_id?.value ?? m.meta_app_id ?? ''),
        meta_app_secret: String(m.meta_app_secret?.value ?? m.meta_app_secret ?? ''),
        meta_graph_version: String(m.meta_graph_version?.value ?? m.meta_graph_version ?? 'v26.0'),
      })
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

          <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
            <p className="font-medium text-zinc-900">Token nereye girilir?</p>
            <p className="mt-1">Hiçbir satıcı token girmez. Satıcı Marketing → Meta’yı Otomatik Bağla deyince Facebook login popup’ında izin verir, token bizde `MarketplaceIntegration.config`’te saklanır (60 gün, günlük yenilenir). Senin girmen gereken tek şey bu sayfadaki App ID/Secret. Uygulamayı developers.facebook.com → TechProvider portfolyon → App → Valid OAuth Redirect URI: <span className="font-mono">https://api.rahatio.com.tr/api/admin/integrations/facebook/oauth/callback</span> ekle.</p>
          </div>
        </div>
      )}
    </div>
  )
}
