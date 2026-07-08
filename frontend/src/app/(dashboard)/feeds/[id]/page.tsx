'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { ExternalFeed, FeedTestResult } from '@/lib/types'
import { ArrowLeft, Rss, Play, TestTube, Clock, CheckCircle, XCircle, History } from 'lucide-react'

const FILE_FORMATS = ['xml', 'csv', 'xlsx', 'json']
const AUTH_TYPES = ['none', 'basic', 'bearer', 'api-key']
const PRICING_MODES = ['fixed', 'gold-formula']
const CURRENCIES = ['TRY', 'USD']
const INTERVALS = ['manual', 'hourly', 'daily', 'weekly']

export default function FeedDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const isNew = id === 'new'

  const [feed, setFeed] = useState<ExternalFeed | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<FeedTestResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncLogs, setSyncLogs] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'config' | 'test' | 'logs'>('config')
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '', feed_url: '', file_format: 'xml', auth_type: 'none',
    auth_credentials: {} as Record<string, string>,
    pricing_mode: 'fixed', currency: 'TRY',
    price_multiplier: '1.00', default_category: '', default_quantity: '1',
    default_is_b2b_enabled: false, default_marketplaces: [] as string[],
    auto_sync: false, update_interval: 'manual', is_active: true,
    field_mapping: {} as Record<string, string>,
  })

  useEffect(() => {
    if (!isNew && id) {
      setLoading(true)
      api.getFeed(parseInt(id)).then((f) => {
        setFeed(f)
        setForm({
          name: f.name, feed_url: f.feed_url, file_format: f.file_format,
          auth_type: f.auth_type, auth_credentials: f.auth_credentials || {},
          pricing_mode: f.pricing_mode, currency: f.currency,
          price_multiplier: String(f.price_multiplier), default_category: f.default_category || '',
          default_quantity: String(f.default_quantity), default_is_b2b_enabled: f.default_is_b2b_enabled,
          default_marketplaces: f.default_marketplaces || [],
          auto_sync: f.auto_sync, update_interval: f.update_interval, is_active: f.is_active,
          field_mapping: f.field_mapping || {},
        })
      }).catch(() => router.push('/feeds')).finally(() => setLoading(false))
    }
  }, [id, isNew, router])

  const loadLogs = useCallback(() => {
    if (!id || isNew) return
    api.getFeedLogs(parseInt(id)).then((res) => setSyncLogs(res.data)).catch(() => {})
  }, [id, isNew])

  useEffect(() => { if (!isNew) loadLogs() }, [loadLogs, isNew])

  function updateForm(field: string, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.name.trim() || !form.feed_url.trim()) return
    setSaving(true)
    setError('')
    try {
      const data = {
        name: form.name, feed_url: form.feed_url, file_format: form.file_format,
        auth_type: form.auth_type, auth_credentials: form.auth_type !== 'none' ? form.auth_credentials : null,
        pricing_mode: form.pricing_mode, currency: form.currency,
        price_multiplier: parseFloat(form.price_multiplier) || 1,
        default_category: form.default_category || null,
        default_quantity: parseInt(form.default_quantity) || 1,
        default_is_b2b_enabled: form.default_is_b2b_enabled,
        default_marketplaces: form.default_marketplaces.length > 0 ? form.default_marketplaces : null,
        auto_sync: form.auto_sync, update_interval: form.update_interval,
        is_active: form.is_active, field_mapping: form.field_mapping,
      }
      if (feed) {
        await api.updateFeed(feed.id, data as any)
      } else {
        await api.createFeed(data as any)
      }
      router.push('/feeds')
    } catch (err: any) {
      setError(err.message || 'Failed to save feed')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!feed) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await api.testFeed(feed.id)
      setTestResult(res)
    } catch (err: any) {
      setTestResult({ success: false, message: err.message, headers: null, preview: null, error: err.message })
    } finally {
      setTesting(false)
    }
  }

  async function handleSync() {
    if (!feed) return
    setSyncing(true)
    setError('')
    try {
      await api.syncFeed(feed.id)
      loadLogs()
      const updated = await api.getFeed(feed.id)
      setFeed(updated)
    } catch (err: any) {
      setError(err.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  if (!user) return null
  if (loading) return <p className="text-sm text-zinc-500">Yükleniyor...</p>

  return (
    <div>
      <button onClick={() => router.push('/feeds')} className="mb-4 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" /> Feed'ler
      </button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Rss className="h-6 w-6 text-amber-600" />
          <h1 className="text-2xl font-bold text-zinc-900">{feed ? feed.name : 'Yeni Feed'}</h1>
        </div>
        {!isNew && (
          <div className="flex items-center gap-2">
            <button onClick={handleTest} disabled={testing}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
              <TestTube className="h-3.5 w-3.5" /> {testing ? 'Test Ediliyor...' : 'Test Et'}
            </button>
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              <Play className="h-3.5 w-3.5" /> {syncing ? 'Senkronize...' : 'Şimdi Senkronize Et'}
            </button>
          </div>
        )}
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      {!isNew && (
        <div className="mt-6 flex gap-4 border-b border-zinc-200">
          <button onClick={() => setActiveTab('config')} className={`pb-3 text-sm font-medium ${activeTab === 'config' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'}`}>Yapılandırma</button>
          <button onClick={() => setActiveTab('test')} className={`pb-3 text-sm font-medium ${activeTab === 'test' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'}`}>Test Sonucu</button>
          <button onClick={() => { setActiveTab('logs'); loadLogs() }} className={`pb-3 text-sm font-medium ${activeTab === 'logs' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'}`}>
            <History className="mr-1 inline h-3.5 w-3.5" /> Senkron Geçmişi
          </button>
        </div>
      )}

      <div className="mt-6">
        {activeTab === 'config' && (
          <div className="rounded-xl border border-zinc-200 p-6">
            {!feed && (
              <div className="mb-6 flex gap-2">
                {[1, 2, 3, 4].map((s) => (
                  <button key={s} onClick={() => setStep(s)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${step === s ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                    Adım {s}
                  </button>
                ))}
              </div>
            )}

            {/* Step 1: Basic Info */}
            {(step === 1 || feed) && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900">1. Kaynak Bilgileri</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700">Feed Adı</label>
                    <input value={form.name} onChange={(e) => updateForm('name', e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" placeholder="Örn: Trendyol Ürünleri" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700">Dosya Formatı</label>
                    <select value={form.file_format} onChange={(e) => updateForm('file_format', e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
                      {FILE_FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Feed URL</label>
                  <input value={form.feed_url} onChange={(e) => updateForm('feed_url', e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono" placeholder="https://example.com/feed.xml" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700">Auth Türü</label>
                    <select value={form.auth_type} onChange={(e) => updateForm('auth_type', e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
                      {AUTH_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  {form.auth_type !== 'none' && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-700">
                        {form.auth_type === 'basic' ? 'Kullanıcı Adı' : form.auth_type === 'bearer' ? 'Token' : 'API Key'}
                      </label>
                      <input value={form.auth_credentials[form.auth_type === 'basic' ? 'username' : form.auth_type === 'bearer' ? 'token' : 'key'] || ''}
                        onChange={(e) => updateForm('auth_credentials', { ...form.auth_credentials, [form.auth_type === 'basic' ? 'username' : form.auth_type === 'bearer' ? 'token' : 'key']: e.target.value })}
                        className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                    </div>
                  )}
                </div>
                {form.auth_type === 'basic' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-700">Şifre</label>
                    <input type="password" value={form.auth_credentials['password'] || ''}
                      onChange={(e) => updateForm('auth_credentials', { ...form.auth_credentials, password: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                  </div>
                )}
                {form.auth_type === 'api-key' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-700">Header Adı</label>
                    <input value={form.auth_credentials['header_name'] || 'X-API-Key'}
                      onChange={(e) => updateForm('auth_credentials', { ...form.auth_credentials, header_name: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Pricing */}
            {(step === 2 || feed) && (
              <div className="mt-8 space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900">2. Fiyatlandırma</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700">Fiyat Modu</label>
                    <select value={form.pricing_mode} onChange={(e) => updateForm('pricing_mode', e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
                      {PRICING_MODES.map((m) => <option key={m} value={m}>{m === 'fixed' ? 'Sabit Fiyat' : 'Altın Formülü'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700">Para Birimi</label>
                    <select value={form.currency} onChange={(e) => updateForm('currency', e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700">Fiyat Çarpanı</label>
                    <input type="number" step="0.01" min="0" value={form.price_multiplier}
                      onChange={(e) => updateForm('price_multiplier', e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700">Varsayılan Kategori</label>
                    <input value={form.default_category} onChange={(e) => updateForm('default_category', e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" placeholder="Opsiyonel" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700">Varsayılan Stok</label>
                    <input type="number" min="0" value={form.default_quantity}
                      onChange={(e) => updateForm('default_quantity', e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 pt-6">
                      <input type="checkbox" checked={form.default_is_b2b_enabled}
                        onChange={(e) => updateForm('default_is_b2b_enabled', e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-300" />
                      <span className="text-xs font-medium text-zinc-700">B2B'ye Aç</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Field Mapping */}
            {(step === 3 || feed) && (
              <div className="mt-8 space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900">3. Alan Eşleme</h3>
                <p className="text-xs text-zinc-500">Feed'deki alan adlarını sistem alanlarına eşle. Boş bırakılırsa otomatik algılama dener.</p>
                <div className="grid grid-cols-2 gap-4">
                  {['title', 'sku', 'price', 'description', 'image', 'quantity', 'category'].map((field) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-zinc-700 capitalize">{field}</label>
                      <input value={form.field_mapping[field] || ''}
                        onChange={(e) => updateForm('field_mapping', { ...form.field_mapping, [field]: e.target.value })}
                        className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono"
                        placeholder={field === 'title' ? 'ürün_adı, name, title, etc.' : `${field}_field_name`} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Sync Settings */}
            {(step === 4 || feed) && (
              <div className="mt-8 space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900">4. Senkronizasyon Ayarları</h3>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.auto_sync}
                      onChange={(e) => updateForm('auto_sync', e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300" />
                    <span className="text-sm font-medium text-zinc-700">Otomatik Senkron</span>
                  </label>
                  {form.auto_sync && (
                    <select value={form.update_interval} onChange={(e) => updateForm('update_interval', e.target.value)}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm">
                      {INTERVALS.filter((i) => i !== 'manual').map((i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                  )}
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.is_active}
                    onChange={(e) => updateForm('is_active', e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300" />
                  <span className="text-sm font-medium text-zinc-700">Aktif</span>
                </label>
              </div>
            )}

            <div className="mt-8 flex justify-end gap-3">
              {!feed && step > 1 && (
                <button onClick={() => setStep(step - 1)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Geri</button>
              )}
              {!feed && step < 4 ? (
                <button onClick={() => setStep(step + 1)} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">İleri</button>
              ) : (
                <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.feed_url.trim()}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                  {saving ? 'Kaydediliyor...' : feed ? 'Güncelle' : 'Feed Oluştur'}
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'test' && (
          <div className="rounded-xl border border-zinc-200 p-6">
            <h3 className="text-sm font-semibold text-zinc-900">Test Sonucu</h3>
            {!testResult && !testing && <p className="mt-2 text-sm text-zinc-400">Henüz test yapılmadı. "Test Et" butonuna tıkla.</p>}
            {testing && <p className="mt-2 text-sm text-zinc-500">Test ediliyor...</p>}
            {testResult && (
              <div className="mt-4 space-y-4">
                <div className={`rounded-lg p-3 text-sm ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  <div className="flex items-center gap-2">
                    {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <span className="font-medium">{testResult.success ? 'Başarılı' : 'Hata'}</span>
                    <span className="text-xs opacity-75">{testResult.message}</span>
                  </div>
                  {testResult.error && <p className="mt-1 text-xs">{testResult.error}</p>}
                </div>
                {testResult.preview && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-700">İçerik Önizleme (ilk 2000 karakter)</label>
                    <pre className="mt-1 max-h-64 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs font-mono text-zinc-700">{testResult.preview}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="rounded-xl border border-zinc-200 p-6">
            <h3 className="text-sm font-semibold text-zinc-900">Senkron Geçmişi</h3>
            {syncLogs.length === 0 && <p className="mt-2 text-sm text-zinc-400">Henüz senkron yapılmamış.</p>}
            {syncLogs.length > 0 && (
              <div className="mt-4 space-y-2">
                {syncLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3">
                    <div className="flex items-center gap-3">
                      {log.status === 'success' ? <CheckCircle className="h-5 w-5 text-green-500" /> : log.status === 'running' ? <Clock className="h-5 w-5 text-amber-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{log.status === 'success' ? 'Başarılı' : log.status === 'running' ? 'Çalışıyor' : 'Başarısız'}</p>
                        {log.summary && (
                          <p className="text-xs text-zinc-500">
                            {log.summary.total ?? 0} ürün · {log.summary.imported ?? 0} içe aktarıldı
                            {log.summary.failed ? ` · ${log.summary.failed} hata` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-zinc-400">
                      {log.created_at && <p>{new Date(log.created_at).toLocaleString('tr-TR')}</p>}
                      {log.summary?.error && <p className="text-red-500">{log.summary.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
