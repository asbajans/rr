'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import Link from 'next/link'
import { ShoppingBag, Store, Globe, Box, Tag, RefreshCw, ChevronRight, ExternalLink, AlertTriangle } from 'lucide-react'
import { CardSkeleton } from '@/components/ui/skeleton'
import { useQuotaStatus } from '@/lib/quota'

const MARKETPLACE_ICONS: Record<string, string> = {
  trendyol: 'Trendyol',
  hepsiburada: 'HB',
  pazarama: 'PZ',
  n11: 'N11',
  amazon: 'AMZ',
  etsy: 'ETSY',
}

const MARKETPLACE_COLORS: Record<string, string> = {
  trendyol: 'bg-orange-100 text-orange-700',
  hepsiburada: 'bg-green-100 text-green-700',
  pazarama: 'bg-purple-100 text-purple-700',
  n11: 'bg-blue-100 text-blue-700',
  amazon: 'bg-yellow-100 text-yellow-800',
  etsy: 'bg-red-100 text-red-700',
}

const ALL_MARKETPLACES = ['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy']

export default function MarketplacesPage() {
  const { user } = useAuth()
  const [integrations, setIntegrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [brandCounts, setBrandCounts] = useState<Record<string, number>>({})
  const { quota } = useQuotaStatus()

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getIntegrations(),
      ...ALL_MARKETPLACES.map(mp =>
        api.getBrands({ marketplace: mp }).then(brands => ({ mp, count: brands.length })).catch(() => ({ mp, count: 0 }))
      ),
    ]).then(([integrationsRes, ...counts]) => {
      setIntegrations(integrationsRes || [])
      const bc: Record<string, number> = {}
      counts.forEach((c: any) => { bc[c.mp] = c.count })
      setBrandCounts(bc)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (!user) return null

  const mpQuota = (quota as any)?.marketplace
  const activeCount = integrations.filter((i: any) => i.is_active).length

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Pazaryerleri</h1>
      <p className="mt-1 text-sm text-zinc-600">Tüm pazaryeri entegrasyonlarını yönetin. {mpQuota?.limit ? `Aktif: ${activeCount}/${mpQuota.limit} (Kendi Siteniz dahil değil)` : ''}</p>
      {mpQuota && mpQuota.severity !== 'ok' && mpQuota.limit > 0 && (
        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${mpQuota.severity === 'exhausted' ? 'border-red-300 bg-red-50 text-red-800' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
          <span className="inline-flex items-center gap-1.5 font-medium"><AlertTriangle className="h-4 w-4" /> {mpQuota.severity === 'exhausted' ? 'Pazaryeri limitiniz doldu' : 'Pazaryeri limitine yaklaşıyorsunuz'}</span>
          <span className="ml-2 text-xs">{activeCount}/{mpQuota.limit} aktif entegrasyon. Yeni pazaryeri eklemek için planınızı yükseltin.</span>
          <Link href="/billing?reason=product_limit#plans" className="ml-3 inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800">Planı Yükselt →</Link>
          <p className="mt-1 text-xs opacity-80">Mağaza limiti ({quota?.product.limit ?? '?'}) ile karıştırılmamalı — mağaza limiti kaç mağaza açabileceğinizdir, pazaryeri limiti kaç dış pazaryeri bağlayabileceğinizdir.</p>
        </div>
      )}

      {loading && <div className="mt-8"><CardSkeleton count={4} /></div>}

      {!loading && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ALL_MARKETPLACES.map(mp => {
            const integration = integrations.find((i: any) => i.marketplace === mp)
            const isActive = integration?.is_active ?? false
            return (
              <Link key={mp} href={`/marketplaces/${mp}`}
                className="group rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold ${MARKETPLACE_COLORS[mp] || 'bg-zinc-100 text-zinc-600'}`}>
                      {MARKETPLACE_ICONS[mp] || mp.slice(0, 3).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 capitalize">{mp}</h3>
                      <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'
                      }`}>
                        {isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> {brandCounts[mp] || 0} marka</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
