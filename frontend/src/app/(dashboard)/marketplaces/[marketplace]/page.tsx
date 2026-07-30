'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import type { Brand } from '@/lib/types'
import { RefreshCw, Tag, Download, Settings, ShoppingBag, Store, Package, ArrowLeft, ExternalLink, Globe } from 'lucide-react'

type TabKey = 'brands' | 'import' | 'categories' | 'config'

const MARKETPLACE_LABELS: Record<string, string> = {
  trendyol: 'Trendyol', hepsiburada: 'Hepsiburada', pazarama: 'Pazarama',
  n11: 'N11', amazon: 'Amazon', etsy: 'Etsy',
}

const MARKETPLACE_ACTIONS: Record<string, string[]> = {
  trendyol: ['Sync Brands', 'Import Products', 'Get Categories', 'Edit Config'],
  hepsiburada: ['Sync Brands', 'Import Products', 'Get Categories', 'Edit Config'],
  pazarama: ['Sync Brands', 'Import Products', 'Get Categories', 'Edit Config'],
  n11: ['Sync Brands', 'Import Products', 'Get Categories', 'Edit Config'],
  amazon: ['Sync Brands', 'Import Products', 'Get Categories', 'Edit Config'],
  etsy: ['Sync Brands', 'Import Products', 'Get Categories', 'Edit Config', 'OAuth Connect'],
}

function mapBrand(raw: any): Brand {
  return {
    id: raw.id,
    name: raw.name || '',
    marketplace: raw.marketplace || null,
    marketplaceBrandId: raw.marketplaceBrandId ?? raw.marketplace_brand_id ?? null,
    isActive: raw.isActive ?? raw.is_active ?? true,
    createdAt: raw.createdAt ?? raw.created_at ?? '',
    updatedAt: raw.updatedAt ?? raw.updated_at ?? '',
  }
}

export default function MarketplaceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const mp = params.marketplace as string

  const [tab, setTab] = useState<TabKey>('brands')
  const [integration, setIntegration] = useState<any>(null)
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<{ state: 'importing' | 'success' | 'error'; message: string; detail?: string } | null>(null)
  const [configForm, setConfigForm] = useState<Record<string, string>>({})
  const [savingConfig, setSavingConfig] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.getIntegration(mp),
      api.getBrands({ marketplace: mp }),
    ]).then(([int, br]) => {
      setIntegration(int)
      setBrands((br || []).map(mapBrand))
      if (int?.fields) {
        const cfg: Record<string, string> = {}
        Object.keys(int.fields).forEach(k => { cfg[k] = int.config?.[k] || '' })
        setConfigForm(cfg)
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [mp])

  useEffect(() => { load(); return () => { if (pollingRef.current) clearInterval(pollingRef.current) } }, [load])

  async function handleSync() {
    setSyncing('brands')
    setMessage('')
    try {
      const res = await api.syncBrands(mp)
      setMessage(`${MARKETPLACE_LABELS[mp] || mp}: ${res.imported} yeni marka içe aktarıldı`)
      load()
    } catch (err: any) {
      setMessage(err.message || 'Senkronizasyon hatası')
    } finally {
      setSyncing(null)
    }
  }

  async function handleImport() {
    setImporting(true)
    setImportStatus({ state: 'importing', message: `${MARKETPLACE_LABELS[mp] || mp} ürünleri içe aktarılıyor...` })
    try {
      const res = await api.importIntegrationProducts(mp)
      const jobId = res.jobId
      if (!jobId) {
        setImportStatus({ state: 'error', message: 'İçe aktarma başlatılamadı', detail: 'Sunucudan iş kimliği alınamadı.' })
        return
      }
      const started = Date.now()
      const poll = async () => {
        try {
          const status = await api.getImportJobStatus(mp, jobId)
          if (status.state === 'completed') {
            const r = status.result || {}
            const imported = r.imported ?? r.total ?? 0
            const updated = r.updated ?? 0
            const failed = r.failed ?? 0
            setImportStatus({
              state: 'success',
              message: `İçe aktarma tamamlandı: ${imported} ürün işlendi`,
              detail: [
                updated > 0 ? `${updated} güncellendi` : '',
                failed > 0 ? `${failed} başarısız` : '',
              ].filter(Boolean).join(', ') || undefined,
            })
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
          } else if (status.state === 'failed') {
            setImportStatus({ state: 'error', message: 'İçe aktarma hatası', detail: status.failedReason || 'Bilinmeyen hata' })
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
          } else if (Date.now() - started > 20 * 60 * 1000) {
            setImportStatus({ state: 'error', message: 'İçe aktarma zaman aşımına uğradı', detail: '20 dakika aşıldı' })
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
          } else {
            const pct = status.progress ? Math.round(status.progress * 100) : undefined
            setImportStatus({ state: 'importing', message: `${MARKETPLACE_LABELS[mp] || mp} ürünleri içe aktarılıyor...`, detail: pct ? `%${pct}` : undefined })
          }
        } catch {
          // polling error — ignore, retry on next tick
        }
      }
      pollingRef.current = setInterval(poll, 3000)
      await poll()
    } catch (err: any) {
      setImportStatus({ state: 'error', message: 'İçe aktarma başlatılamadı', detail: err?.response?.data?.message || err.message || 'Bilinmeyen hata' })
    } finally {
      setImporting(false)
    }
  }

  async function handleImportCategories() {
    setSyncing('categories')
    setMessage('')
    try {
      const res = await api.getMarketplaceCategories(mp)
      const count = res?.categories?.length || 0
      setMessage(`${MARKETPLACE_LABELS[mp] || mp}: ${count} kategori aktarıldı`)
    } catch (err: any) {
      setMessage(err.message || 'Kategori aktarma hatası')
    } finally {
      setSyncing(null)
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault()
    setSavingConfig(true)
    setMessage('')
    try {
      await api.updateIntegration(mp, { isActive: true, config: configForm })
      setMessage('Ayarlar kaydedildi')
      load()
    } catch (err: any) {
      setMessage(err.message || 'Kaydetme hatası')
    } finally {
      setSavingConfig(false)
    }
  }

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'brands', label: 'Markalar' },
    { key: 'import', label: 'İçe Aktar' },
    { key: 'categories', label: 'Kategoriler' },
    { key: 'config', label: 'Ayarlar' },
  ]

  if (!mp || !['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy'].includes(mp)) {
    return <div className="text-sm text-zinc-500 mt-8">Geçersiz pazaryeri.</div>
  }

  return (
    <div>
      <button onClick={() => router.push('/marketplaces')}
        className="mb-4 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Tüm Pazaryerleri
      </button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 text-xs font-bold uppercase">
            {mp.slice(0, 3)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{MARKETPLACE_LABELS[mp] || mp}</h1>
            <p className="text-xs text-zinc-500">
              {integration?.is_active
                ? <span className="text-green-600">● Aktif</span>
                : <span className="text-zinc-400">○ Pasif</span>}
              {' '}· {brands.length} marka
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncing === 'brands'}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${syncing === 'brands' ? 'animate-spin' : ''}`} />
            {syncing === 'brands' ? 'Senkronize Ediliyor...' : 'Markaları Senkronize Et'}
          </button>
          <button onClick={handleImport} disabled={importing}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
            <Download className="h-3.5 w-3.5" />
            Ürünleri İçe Aktar
          </button>
        </div>
      </div>

      {importStatus && (
        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
          importStatus.state === 'importing'
            ? 'border-blue-200 bg-blue-50 text-blue-800'
            : importStatus.state === 'success'
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {importStatus.state === 'importing' && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {importStatus.state === 'success' && (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              )}
              {importStatus.state === 'error' && (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              )}
              <span className="font-medium">{importStatus.message}</span>
            </div>
            <button onClick={() => setImportStatus(null)} className="text-current opacity-60 hover:opacity-100">&times;</button>
          </div>
          {importStatus.detail && (
            <p className="mt-1 text-xs opacity-80">{importStatus.detail}</p>
          )}
        </div>
      )}

      {message && !importStatus && (
        <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700 whitespace-pre-wrap">{message}</div>
      )}

      <div className="mt-6 flex gap-1 border-b border-zinc-200">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="mt-6 text-sm text-zinc-500">Yükleniyor...</p>}

      {!loading && tab === 'brands' && (
        <div className="mt-4">
          {brands.length === 0 ? (
            <div className="mt-12 text-center text-sm text-zinc-500">
              <Tag className="mx-auto h-8 w-8 text-zinc-300" />
              <p className="mt-2">Henüz {MARKETPLACE_LABELS[mp]} markası bulunmuyor.</p>
              <button onClick={handleSync} disabled={syncing === 'brands'}
                className="mt-2 inline-flex items-center gap-1.5 text-indigo-600 hover:underline disabled:opacity-50">
                <RefreshCw className={`h-3.5 w-3.5 ${syncing === 'brands' ? 'animate-spin' : ''}`} />
                Pazaryerinden markaları içe aktar
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                    <th className="px-4 py-3">Marka Adı</th>
                    <th className="px-4 py-3">Pazaryeri ID</th>
                    <th className="px-4 py-3">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {brands.map(b => (
                    <tr key={b.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900">{b.name}</td>
                      <td className="px-4 py-3 text-xs font-mono text-zinc-500">{b.marketplaceBrandId || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                          {b.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'import' && (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-zinc-900">Ürünleri İçe Aktar</h3>
            <p className="mt-1 text-xs text-zinc-500">{MARKETPLACE_LABELS[mp]}'deki mevcut ürünleri mağazana aktar.</p>
            <button onClick={handleImport} disabled={importing}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
              <Download className="h-4 w-4" />
              {importing ? 'İçe Aktarılıyor...' : 'Ürünleri İçe Aktar'}
            </button>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-zinc-900">Kategorileri İçe Aktar</h3>
            <p className="mt-1 text-xs text-zinc-500">{MARKETPLACE_LABELS[mp]} kategori ağacını mağazana aktar.</p>
            <button onClick={handleImportCategories} disabled={syncing === 'categories'}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
              <Globe className="h-4 w-4" />
              {syncing === 'categories' ? 'Aktarılıyor...' : 'Kategorileri Aktar'}
            </button>
          </div>
        </div>
      )}

      {!loading && tab === 'config' && integration && (
        <div className="mt-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-zinc-900">API Ayarları</h3>
            <p className="mt-1 text-xs text-zinc-500">{MARKETPLACE_LABELS[mp]} bağlantı bilgilerini yapılandır.</p>
            <form onSubmit={handleSaveConfig} className="mt-4 space-y-3">
              {Object.entries(integration.fields || {}).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-zinc-700">{label as string}</label>
                  <input
                    type={key.includes('secret') || key === 'password' ? 'password' : 'text'}
                    value={configForm[key] || ''}
                    onChange={e => setConfigForm({ ...configForm, [key]: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-zinc-900 focus:outline-none"
                  />
                </div>
              ))}
              {Object.keys(integration.fields || {}).length === 0 && (
                <p className="text-xs text-zinc-400">Bu pazaryeri için yapılandırma alanı bulunmuyor.</p>
              )}
              <button type="submit" disabled={savingConfig}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                {savingConfig ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </form>
          </div>

          {mp === 'etsy' && (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-zinc-900">Etsy OAuth</h3>
              <p className="mt-1 text-xs text-zinc-500">Etsy hesabına bağlanmak için OAuth yetkilendirmesi yap.</p>
              <button onClick={async () => {
                try {
                  const res = await api.get<any>(`/api/admin/integrations/etsy/oauth/connect`)
                  if (res.url) window.location.href = res.url
                } catch (err: any) {
                  setMessage(err.message || 'Etsy bağlantısı başlatılamadı')
                }
              }}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-medium text-white hover:bg-orange-700">
                <ExternalLink className="h-4 w-4" />
                Etsy ile Bağlan
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
