'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import { ShoppingBag, Store, Download } from 'lucide-react'

const MARKETPLACE_LOGOS: Record<string, string> = {
  trendyol: 'Trendyol',
  hepsiburada: 'Hepsiburada',
}

interface MarketplaceIntegration {
  marketplace: string
  label: string
  is_active: boolean
  config: Record<string, string>
  fields: Record<string, string>
  id: number | null
}

export default function IntegrationsPage() {
  const { user } = useAuth()
  const [integrations, setIntegrations] = useState<MarketplaceIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [importing, setImporting] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setLoading(true)
    api.getIntegrations()
      .then((res) => setIntegrations(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function toggleIntegration(marketplace: string, currentActive: boolean) {
    setSaving(marketplace)
    setMessage('')
    try {
      await api.updateIntegration(marketplace, { is_active: !currentActive })
      setIntegrations((prev) =>
        prev.map((i) => i.marketplace === marketplace ? { ...i, is_active: !currentActive } : i)
      )
      setMessage(`${MARKETPLACE_LOGOS[marketplace] || marketplace} ${!currentActive ? 'aktifleştirildi' : 'devre dışı bırakıldı'}`)
    } catch (err: any) {
      setMessage(err.message || 'Hata')
    } finally {
      setSaving(null)
    }
  }

  async function saveConfig(marketplace: string, config: Record<string, string>) {
    setSaving(marketplace)
    setMessage('')
    try {
      await api.updateIntegration(marketplace, { is_active: true, config })
      setIntegrations((prev) =>
        prev.map((i) => i.marketplace === marketplace ? { ...i, config, is_active: true } : i)
      )
      setMessage(`${MARKETPLACE_LOGOS[marketplace] || marketplace} ayarları kaydedildi`)
    } catch (err: any) {
      setMessage(err.message || 'Hata')
    } finally {
      setSaving(null)
    }
  }

  async function importCategories(marketplace: string) {
    setImporting(marketplace)
    setMessage('')
    try {
      const res = await api.importMarketplaceCategories(marketplace)
      if (!res || res.status !== 'processing') {
        setMessage(`${MARKETPLACE_LOGOS[marketplace] || marketplace}: içe aktarma başlatılamadı`)
        return
      }
      setMessage(`${MARKETPLACE_LOGOS[marketplace] || marketplace}: kategori ağacı yükleniyor...`)
      const started = Date.now()
      while (Date.now() - started < 3 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 2500))
        let status
        try {
          status = await api.getMarketplaceCategoryImportStatus(marketplace)
        } catch {
          continue
        }
        if (status.status === 'done') {
          setMessage(
            `${MARKETPLACE_LOGOS[marketplace] || marketplace}: ${status.imported ?? 0} kategori ağacı aktarıldı`
          )
          break
        } else if (status.status === 'failed') {
          setMessage(
            `${MARKETPLACE_LOGOS[marketplace] || marketplace}: hata - ${status.error || 'bilinmeyen hata'}`
          )
          break
        }
      }
    } catch (err: any) {
      setMessage(err.message || 'Kategori ağacı aktarılamadı')
    } finally {
      setImporting(null)
    }
  }

  async function importProducts(marketplace: string) {
    setImporting(marketplace)
    setMessage('')
    try {
      const res = await api.importIntegrationProducts(marketplace)
      if (!res.id) {
        setMessage('İçe aktarma başlatılamadı')
        return
      }
      setMessage(`${MARKETPLACE_LOGOS[marketplace] || marketplace}: içe aktarma başlatıldı, ürünler yükleniyor...`)
      const started = Date.now()
      while (Date.now() - started < 20 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 3000))
        const status = await api.getMarketplaceImportStatus(marketplace, res.id)
        if (status.status === 'done') {
          const s = status.summary
          if (s) {
            if (s.message) {
              setMessage(`${MARKETPLACE_LOGOS[marketplace] || marketplace}: ${s.message}`)
            } else {
              let msg = `${MARKETPLACE_LOGOS[marketplace] || marketplace}: ${s.imported} yeni, ${s.updated} güncellendi, ${s.failed} başarısız (${s.fetched ?? s.total} ürün çekildi)`
              if (s.failed > 0 && Array.isArray(s.errors) && s.errors.length) {
                msg += `\nHatalar:\n` + s.errors.slice(0, 8).join('\n')
              }
              setMessage(msg)
            }
          } else {
            setMessage(`${MARKETPLACE_LOGOS[marketplace] || marketplace}: içe aktarma tamamlandı`)
          }
          break
        } else if (status.status === 'failed') {
          setMessage(`${MARKETPLACE_LOGOS[marketplace] || marketplace}: hata - ${status.error || 'bilinmeyen hata'}`)
          break
        } else {
          setMessage(
            `${MARKETPLACE_LOGOS[marketplace] || marketplace}: içe aktarma devam ediyor (${status.status})...`
          )
        }
      }
    } catch (err: any) {
      setMessage(err.message || 'Ürün içe aktarma başarısız')
    } finally {
      setImporting(null)
    }
  }

  function renderConfigForm(integration: MarketplaceIntegration) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          const cfg: Record<string, string> = {}
          fd.forEach((v, k) => (cfg[k] = v as string))
          saveConfig(integration.marketplace, cfg)
        }}
        className="mt-4 space-y-3"
      >
        {Object.entries(integration.fields).map(([key, label]) => (
          <div key={key}>
            <label className="block text-xs font-medium text-zinc-700">{label}</label>
            <input
              type={key.includes('secret') || key === 'password' ? 'password' : 'text'}
              name={key}
              defaultValue={integration.config[key] || ''}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono"
            />
          </div>
        ))}
        <button
          type="submit"
          disabled={saving === integration.marketplace}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving === integration.marketplace ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </form>
    )
  }

  if (!user) return null

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Pazaryeri Entegrasyonları</h1>
      <p className="mt-1 text-sm text-zinc-600">Trendyol ve Hepsiburada API bağlantılarını yapılandır.</p>

      {message && (
        <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div>
      )}

      {loading && <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>}

      {!loading && (
        <div className="mt-6 space-y-4">
          {integrations.map((integration) => (
            <div key={integration.marketplace} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                    {integration.marketplace === 'trendyol' ? (
                      <ShoppingBag className="h-5 w-5" />
                    ) : (
                      <Store className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">{integration.label}</h3>
                    <p className="text-xs text-zinc-400">{integration.marketplace}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleIntegration(integration.marketplace, integration.is_active)}
                  disabled={saving === integration.marketplace}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    integration.is_active ? 'bg-green-500' : 'bg-zinc-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      integration.is_active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {integration.is_active && renderConfigForm(integration)}
              {integration.is_active && (
                <div className="mt-4 border-t border-zinc-100 pt-4">
                  {Object.keys(integration.fields).some((k) => !integration.config[k]) ? (
                    <p className="text-xs text-amber-600">
                      Önce yukarıdaki API bilgilerini ({Object.values(integration.fields).join(', ')}) girip <strong>Kaydet</strong> yapmalısın.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-zinc-500">
                        Pazaryerindeki mevcut ürünleri (kategori ve marka dahil) mağazana aktar.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => importProducts(integration.marketplace)}
                          disabled={importing === integration.marketplace}
                          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                        >
                          <Download className="h-4 w-4" />
                          {importing === integration.marketplace ? 'İçe aktarılıyor...' : 'Ürünleri İçe Aktar'}
                        </button>
                        <button
                          onClick={() => importCategories(integration.marketplace)}
                          disabled={importing === integration.marketplace}
                          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                        >
                          <Download className="h-4 w-4" />
                          {importing === integration.marketplace ? 'Aktarılıyor...' : 'Kategori Ağacını Aktar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
