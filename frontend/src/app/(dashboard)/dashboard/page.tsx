'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { DashboardData } from '@/lib/types'
import { CardSkeleton } from '@/components/ui/skeleton'

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (!user) return null

  const stats = data?.stats ?? { total_products: 0, active_products: 0, total_orders: 0, pending_orders: 0, ai_credits: user.ai_credits || 0, total_revenue: 0, active_integrations: 0, low_stock_count: 0 }
  const plan = data?.plan
  const subscription = data?.subscription

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

  const planBadge = (status: string) => {
    const colors: Record<string, string> = { active: 'bg-green-100 text-green-700', trialing: 'bg-blue-100 text-blue-700', past_due: 'bg-amber-100 text-amber-700', canceled: 'bg-red-100 text-red-700' }
    const labels: Record<string, string> = { active: 'Aktif', trialing: 'Deneme', past_due: 'Ödeme Bekliyor', canceled: 'İptal Edildi' }
    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] || 'bg-zinc-100 text-zinc-700'}`}>{labels[status] || status}</span>
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Hoş geldin, {user.name}!</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <CardSkeleton count={4} />
      ) : (
        <>
          {/* Plan & Subscription Card */}
          {plan && (
            <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Mevcut Plan</p>
                  <h2 className="mt-1 text-xl font-bold text-zinc-900">{plan.name}</h2>
                  {subscription && (
                    <div className="mt-3 flex items-center gap-3">
                      {planBadge(subscription.status)}
                      <span className="text-sm text-zinc-500">
                        {subscription.status === 'active' || subscription.status === 'trialing'
                          ? `Yenilenme: ${formatDate(subscription.currentPeriodEnd)}`
                          : subscription.status === 'past_due'
                            ? `Son ödeme: ${formatDate(subscription.currentPeriodEnd)}`
                            : `İptal: ${formatDate(subscription.canceledAt)}`
                        }
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-zinc-900">{plan.price.toLocaleString('tr-TR')} ₺</p>
                  <p className="text-xs text-zinc-400">/ay</p>
                </div>
              </div>
              {plan.features && typeof plan.features === 'object' && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {Object.entries(plan.features).filter(([, v]) => v).map(([key]) => (
                    <span key={key} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 capitalize">
                      {key.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quota summary (product + credits) */}
          {data?.quota && (() => {
            const q = data.quota
            const p = q.product
            const c = q.credits
            const pColor = p.severity === 'exhausted' ? 'text-red-600' : p.severity === 'critical' ? 'text-amber-600' : p.severity === 'warning' ? 'text-amber-600' : 'text-zinc-900'
            const cColor = c.severity === 'exhausted' ? 'text-red-600' : c.severity === 'critical' ? 'text-amber-600' : c.severity === 'warning' ? 'text-amber-600' : 'text-zinc-900'
            return (
              <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-2">
                <div className={`rounded-xl border p-4 ${p.severity === 'exhausted' ? 'border-red-200 bg-red-50' : p.severity !== 'ok' ? 'border-amber-200 bg-amber-50' : 'border-zinc-200 bg-white'}`}>
                  <p className="text-xs font-medium text-zinc-500">Ürün Kotası</p>
                  <p className={`mt-1 text-lg font-bold ${pColor}`}>{p.current} / {p.limit} <span className="text-xs font-normal text-zinc-500">(%{p.percentUsed})</span></p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                    <div className={`h-full rounded-full ${p.severity === 'exhausted' ? 'bg-red-500' : p.severity === 'critical' ? 'bg-amber-500' : p.severity === 'warning' ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, p.percentUsed)}%` }} />
                  </div>
                  {p.severity !== 'ok' && <p className="mt-1.5 text-xs font-medium text-zinc-600">{p.severity === 'exhausted' ? 'Limit doldu — yeni ürün ekleyemezsiniz' : p.severity === 'critical' ? 'Limit dolmak üzere' : 'Limite yaklaşıyorsunuz'} · <a href="/billing?reason=product_limit#plans" className="text-indigo-600 hover:underline">Planı yükselt</a></p>}
                </div>
                <div className={`rounded-xl border p-4 ${c.severity === 'exhausted' ? 'border-red-200 bg-red-50' : c.severity !== 'ok' ? 'border-amber-200 bg-amber-50' : 'border-zinc-200 bg-white'}`}>
                  <p className="text-xs font-medium text-zinc-500">AI Kredisi</p>
                  <p className={`mt-1 text-lg font-bold ${cColor}`}>{c.remaining} / {c.allowance} <span className="text-xs font-normal text-zinc-500">(%{c.percentRemaining} kalan)</span></p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                    <div className={`h-full rounded-full ${c.severity === 'exhausted' ? 'bg-red-500' : c.severity === 'critical' ? 'bg-amber-500' : c.severity === 'warning' ? 'bg-amber-400' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, 100 - c.percentRemaining)}%` }} />
                  </div>
                  {c.severity !== 'ok' && <p className="mt-1.5 text-xs font-medium text-zinc-600">{c.severity === 'exhausted' ? 'Kredi bitti — AI durdu' : c.severity === 'critical' ? 'Kredi kritik' : 'Kredi azalıyor'} · <a href="/billing?reason=credits#credits" className="text-indigo-600 hover:underline">Kredi al</a></p>}
                </div>
              </div>
            )
          })()}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-sm">
              <p className="text-xs font-medium text-zinc-500">AI Kredisi</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{stats.ai_credits}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-sm">
              <p className="text-xs font-medium text-zinc-500">Aktif Ürünler</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{stats.active_products}<span className="text-sm font-normal text-zinc-400">/{stats.total_products}</span></p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-sm">
              <p className="text-xs font-medium text-zinc-500">Siparişler</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{stats.pending_orders}<span className="text-sm font-normal text-zinc-400">/{stats.total_orders}</span></p>
              {stats.pending_orders > 0 && <p className="text-xs text-amber-600 mt-0.5">{stats.pending_orders} bekleyen</p>}
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-sm">
              <p className="text-xs font-medium text-zinc-500">Gelir</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{stats.total_revenue.toLocaleString('tr-TR')} ₺</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-sm">
              <p className="text-xs font-medium text-zinc-500">Entegrasyonlar</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{stats.active_integrations}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-sm">
              <p className="text-xs font-medium text-zinc-500">Düşük Stok</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{stats.low_stock_count}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-sm">
              <p className="text-xs font-medium text-zinc-500">AI Kredi Limiti</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{plan?.aiCredits ?? '—'}</p>
            </div>
          </div>
        </>
      )}

      {/* Quick Actions */}
      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Hızlı İşlemler</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Ürün Ekle', desc: 'Yeni ürün ekle veya AI ile oluştur', href: '/products' },
            { title: 'Pazaryeri Entegrasyonu', desc: 'Trendyol, Hepsiburada ve daha fazlası', href: '/integrations' },
            { title: 'XML Feed', desc: 'Dış kaynaklardan ürün içe aktar', href: '/feeds' },
            { title: 'Site Tasarımı', desc: 'Mağaza görünümünü özelleştir', href: '/site-builder' },
          ].map((item) => (
            <a key={item.title} href={item.href}
              className="flex items-center gap-4 rounded-lg border border-zinc-200 p-4 text-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50">
              <div>
                <p className="font-medium text-zinc-900">{item.title}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{item.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
