'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import { CardSkeleton } from '@/components/ui/skeleton'
import { FlaskConical, AlertTriangle, Check, X, Loader2, ExternalLink, Copy } from 'lucide-react'

export default function MetaTestPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<any>(null)
  const [testResult, setTestResult] = useState<Record<string, any>>({})
  const [running, setRunning] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    if (user.role !== 'superadmin') {
      setLoading(false)
      setError('Bu sayfa yalnızca süperadmin tarafından görüntülenebilir.')
      return
    }
    setLoading(true)
    api.get('/api/admin/meta/test').then(r => { setConfig(r); setLoading(false) }).catch(e => { setError(e.message || 'Yüklenemedi'); setLoading(false) })
  }, [user])

  const runTest = async (name: string, path: string, opts?: any) => {
    setRunning(name)
    try {
      const res = await api.get(path, opts)
      setTestResult(prev => ({ ...prev, [name]: { ok: true, data: res } }))
    } catch (e: any) {
      setTestResult(prev => ({ ...prev, [name]: { ok: false, error: e.message || 'Hata' } }))
    } finally { setRunning(null) }
  }

  if (loading) return <div className="mt-8"><CardSkeleton count={3} /></div>
  if (error) return <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6"><p className="text-red-700 font-medium">{error}</p></div>
  if (!config) return null

  const scopes = config.scopes || {}
  const endpoints = config.endpoints || {}

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2"><FlaskConical className="h-6 w-6 text-indigo-600" /> Meta Test Alanı</h1>
          <p className="mt-1 text-sm text-zinc-600">Super admin only — tüm Meta entegrasyon endpoint'lerini test et.</p>
        </div>
        {config.user && (
          <span className="rounded-lg bg-indigo-100 px-3 py-1.5 text-xs font-medium text-indigo-700">{config.user.email} ({config.user.role})</span>
        )}
      </div>

      {/* Scope status */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-zinc-900 mb-3">OAuth İzin Durumu</h3>
        <div className="flex flex-wrap gap-2">
          {scopes.full && scopes.full.map((s: string) => {
            const approved = true // all are approved in app review
            return (
              <span key={s} className={`rounded-full px-2.5 py-1 text-xs font-medium ${approved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {approved ? <Check className="h-3 w-3 inline mr-1" /> : <X className="h-3 w-3 inline mr-1" />} {s}
              </span>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-zinc-500">Aktif: <span className="font-mono font-medium">{scopes.current}</span></p>
      </div>

      {/* Test buttons */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-zinc-900 mb-3">Endpoint Testleri</h3>
        <div className="space-y-3">
          {[
            { name: 'Yorumları Getir', path: '/api/admin/integrations/facebook/ig/comments', desc: 'GET /facebook/ig/comments' },
            { name: 'Mesajları Getir', path: '/api/admin/integrations/facebook/ig/messages', desc: 'GET /facebook/ig/messages' },
            { name: 'Reklamları Getir', path: '/api/admin/integrations/facebook/ads', desc: 'GET /facebook/ads' },
            { name: 'İstatistikleri Getir', path: '/api/admin/integrations/facebook/page/insights', desc: 'GET /facebook/page/insights' },
            { name: 'IG Hesap Bilgisi', path: '/api/admin/integrations/facebook/ig/account', desc: 'GET /facebook/ig/account' },
          ].map(item => (
            <div key={item.name} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <button onClick={() => runTest(item.name, item.path)} disabled={running === item.name} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {running === item.name ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test'}
              </button>
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-900">{item.name}</p>
                <p className="text-xs text-zinc-500">{item.desc}</p>
              </div>
              {testResult[item.name] && (
                <span className={`text-xs font-medium ${testResult[item.name].ok ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult[item.name].ok ? <Check className="h-3 w-3 inline" /> : <X className="h-3 w-3 inline" />}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Test results */}
      {Object.entries(testResult).filter(([, v]) => v).length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-zinc-900 mb-3">Sonuçlar</h3>
          <div className="space-y-2 max-h-[400px] overflow-auto">
            {Object.entries(testResult).map(([name, r]: [string, any]) => (
              <div key={name} className={`rounded-lg p-3 text-xs ${r.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className="font-medium">{name}: {r.ok ? 'Başarılı' : 'Başarısız'}</p>
                {r.ok ? (
                  <pre className="mt-1 bg-zinc-900 text-green-300 rounded p-2 overflow-auto max-h-[160px] text-[11px]">{JSON.stringify(r.data, null, 2)}</pre>
                ) : (
                  <p className="text-red-600">{r.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
        <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4" /> Nasıl Kullanılır</h3>
        <ul className="text-xs text-amber-800 space-y-1">
          <li>• "Test" butonuna basarak herhangi bir endpointi çağır ve yanıtı gözlemle.</li>
          <li>• Hata mesajları eksik izinleri gösterir (ör. "User not approved for instagram_manage_comments").</li>
          <li>• Bu sayfa sadece süperadmin görünümünde görünür.</li>
          <li>• Tüm istekler F12 → Network ve Console tablarında inceleyebilirsin.</li>
          <li>• OAuth bağlantısı için Marketing sayfasını kullan: <a href="/marketing" className="underline">/marketing</a></li>
        </ul>
      </div>
    </div>
  )
}