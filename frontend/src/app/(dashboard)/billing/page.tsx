'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { api } from '@/lib/api-client'
import type { Plan, Subscription } from '@/lib/types'
import { Coins, ShoppingCart, ArrowUp, ArrowDown } from 'lucide-react'

const FALLBACK_PACKS = [
  { credits: 50, price: 50 },
  { credits: 200, price: 150, popular: true },
  { credits: 500, price: 300 },
]

const MODULE_KEYS: Record<string, string> = {
  ai_product_create: 'module_ai_product_create',
  ai_image_generate: 'module_ai_image_generate',
  credit_purchase: 'module_credit_purchase',
}

const MODULE_LABELS: Record<string, string> = {
  ai_product_create: 'AI Ürün Oluşturma',
  ai_image_generate: 'AI Görsel Üretme',
  b2b: 'B2B / Beatby',
  marketplace: 'Pazaryeri Entegrasyonu',
  xml_feed: 'XML Feed',
  variations: 'Varyasyonlar',
  blog: 'Blog',
  custom_domain: 'Özel Domain',
  shipping: 'Kargo Yönetimi',
  static_pages: 'Statik Sayfalar',
}

type PlanModule = { enabled: boolean; credit_cost?: number; limit?: number }

function enabledModules(plan: Plan | null): { key: string; label: string }[] {
  const modules = (plan?.modules as Record<string, PlanModule> | null) ?? null
  if (!modules) return []
  return Object.entries(modules)
    .filter(([, v]) => v?.enabled === true)
    .map(([key]) => ({ key, label: MODULE_LABELS[key] || key }))
}

export default function BillingPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [creditStats, setCreditStats] = useState<any>(null)
  const [creditLogs, setCreditLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [buying, setBuying] = useState(false)
  const [message, setMessage] = useState('')
  const [packs, setPacks] = useState<{ credits: number; price: number; popular?: boolean; label?: string }[]>(FALLBACK_PACKS)
  const [reason, setReason] = useState<string | null>(null)

  const loadBilling = useCallback(async () => {
    const [sub, pl] = await Promise.all([api.getSubscription(), api.getPlans()])
    setSubscription(sub)
    setCurrentPlan(sub.plan || null)
    setPlans(pl)
  }, [])

  const loadCredits = useCallback(async () => {
    try {
      const [stats, logs, fetchedPacks] = await Promise.all([api.getCreditStats(), api.getCreditLogs(), api.getCreditPacks().catch(() => FALLBACK_PACKS)])
      setCreditStats(stats)
      setCreditLogs(logs)
      if (Array.isArray(fetchedPacks) && fetchedPacks.length) setPacks(fetchedPacks)
    } catch {
      setCreditStats(null)
      setCreditLogs([])
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const r = params.get('reason')
    if (r) setReason(r)
    Promise.all([loadBilling(), loadCredits()])
      .catch(() => setMessage(t('loadFailed')))
      .finally(() => setLoading(false))
    // Auto-scroll to highlighted section when reason present
    setTimeout(() => {
      const hash = window.location.hash
      if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      else if (r === 'credits') document.getElementById('credits')?.scrollIntoView({ behavior: 'smooth' })
      else if (r === 'product_limit') document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })
    }, 400)
  }, [loadBilling, loadCredits])

  async function handleSelectPlan(plan: Plan) {
    if (plan.id === currentPlan?.id) return
    setActionLoading(true)
    setMessage('')
    try {
      const res = await api.createCheckoutSession(plan.id, window.location.href, window.location.href)
      if (res.url) {
        window.location.href = res.url
      } else {
        await loadBilling()
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : t('paymentFailed'))
    } finally {
      setActionLoading(false)
    }
  }

  async function handlePortal() {
    setActionLoading(true)
    try {
      const res = await api.createPortalSession(window.location.href)
      if (res.url) {
        window.location.href = res.url
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : t('portalFailed'))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCancel() {
    if (!confirm(t('cancelConfirm'))) return
    setActionLoading(true)
    try {
      await api.cancelSubscription()
      setMessage(t('cancelSuccess'))
      setSubscription((prev) => prev ? { ...prev, status: 'canceled' } : null)
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : t('cancelFailed'))
    } finally {
      setActionLoading(false)
    }
  }

  async function buyCredits(credits: number) {
    setBuying(true)
    setMessage('')
    try {
      const res = await api.buyCredits(credits)
      if (res.url) {
        window.open(res.url, '_blank')
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : t('creditsFailed'))
    } finally {
      setBuying(false)
    }
  }

  if (!user) return null

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">{t('billingTitle')}</h1>
      <p className="mt-1 text-sm text-zinc-600">{t('billingSubtitle')}</p>

      {reason === 'product_limit' && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Ürün limitiniz doldu.</span> Yeni ürün ekleyemezsiniz çünkü plan kotanız dolu. Aşağıdan üst pakete geçerek limitinizi artırabilirsiniz.
        </div>
      )}
      {reason === 'credits' && (
        <div className="mt-4 rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          <span className="font-semibold">AI krediniz bitti.</span> AI ile ürün oluşturma ve görsel üretimi durdu. Aşağıdan kredi paketi alın veya üst pakete geçin.
        </div>
      )}
      {message && (
        <div className="mt-4 rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700">{message}</div>
      )}

      {loading ? (
        <div className="mt-8 text-sm text-zinc-500">{t('loading')}</div>
      ) : (
        <>
          {currentPlan && (
            <div className="mt-6 rounded-xl border border-zinc-200 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">{t('currentPlan')}</h2>
                  <p className="mt-2 text-xl font-bold text-zinc-900">{currentPlan.name}</p>
                  <p className="text-sm text-zinc-500">
                    {currentPlan.price > 0 ? `${currentPlan.price} ${currentPlan.currency}${t('perMonth')}` : t('free')}
                  </p>
                  {subscription && (
                    <p className={`mt-1 text-xs font-medium ${
                      subscription.status === 'active' || subscription.status === 'trialing'
                        ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {subscription.status === 'trialing' ? t('trialing') :
                       subscription.status === 'active' ? t('active') :
                       subscription.status === 'canceled' ? t('canceled') : subscription.status}
                      {subscription.renews_at && ` — ${t('renewsOn')} ${new Date(subscription.renews_at).toLocaleDateString('tr-TR')}`}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {subscription?.stripe_id && (
                    <button
                      onClick={handlePortal}
                      disabled={actionLoading}
                      className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {t('billingPortal')}
                    </button>
                  )}
                  {subscription && (subscription.status === 'active' || subscription.status === 'trialing') && (
                    <button
                      onClick={handleCancel}
                      disabled={actionLoading}
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {t('cancelPlan')}
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-zinc-100 pt-4 text-sm sm:grid-cols-4">
                <div><span className="text-zinc-500">{t('product')}:</span> {currentPlan.product_limit}</div>
                <div><span className="text-zinc-500">{t('store')}:</span> {currentPlan.store_limit}</div>
                <div><span className="text-zinc-500">{t('aiCredits')}:</span> {currentPlan.ai_credits}/ay</div>
                <div className="flex items-center gap-1">
                  <Coins className="h-4 w-4 text-indigo-500" />
                  <span className="text-zinc-500">{t('remaining')}:</span> {creditStats?.current_credits ?? user?.ai_credits ?? 0}
                </div>
              </div>
              {enabledModules(currentPlan).length > 0 && (
                <div className="mt-4 border-t border-zinc-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{t('includedModules')}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {enabledModules(currentPlan).map(m => (
                      <span key={m.key} className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">{m.label}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div id="plans" className={`mt-8 rounded-xl p-1 ${reason === 'product_limit' ? 'ring-2 ring-amber-400 bg-amber-50/50' : ''}`}>
            <h2 className="text-lg font-semibold text-zinc-900">{t('availablePlans')}</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {plans.filter(p => p.is_active).map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded-xl border p-5 ${
                    plan.id === currentPlan?.id
                      ? 'border-zinc-900 bg-zinc-50'
                      : 'border-zinc-200'
                  }`}
                >
                  <h3 className="font-semibold text-zinc-900">{plan.name}</h3>
                  <p className="mt-1 text-2xl font-bold text-zinc-900">
                    {plan.price > 0 ? `${plan.price} ${plan.currency}` : t('free')}
                    {plan.price > 0 && <span className="text-sm font-normal text-zinc-500">{t('perMonth')}</span>}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">{plan.description}</p>
                  <ul className="mt-4 space-y-2 text-sm text-zinc-600">
                    <li>✓ {plan.product_limit} {t('productsCount')}</li>
                    <li>✓ {plan.store_limit} {t('storesCount')}</li>
                    <li>✓ {plan.ai_credits} {t('aiCreditsPerMonth')}</li>
                    {enabledModules(plan).map(m => (
                      <li key={m.key}>✓ {m.label}</li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={actionLoading || plan.id === currentPlan?.id}
                    className={`mt-4 w-full rounded-lg py-2 text-sm font-medium ${
                      plan.id === currentPlan?.id
                        ? 'bg-zinc-200 text-zinc-500 cursor-not-allowed'
                        : 'bg-zinc-900 text-white hover:bg-zinc-800'
                    } disabled:opacity-50`}
                  >
                    {plan.id === currentPlan?.id ? t('currentPlanBtn') : plan.price > 0 ? t('subscribe') : t('select')}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div id="credits" className={`mt-8 rounded-xl p-1 ${reason === 'credits' ? 'ring-2 ring-indigo-400 bg-indigo-50/50' : ''}`}>
            <h2 className="text-lg font-semibold text-zinc-900">{t('buyCreditsTitle')}</h2>
            <p className="mt-1 text-xs text-zinc-500">Süperadmin tarafından yönetilir — fiyatlar anlık güncellenir.</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {packs.map(pack => (
                <div key={pack.credits} className={`relative rounded-xl border p-5 ${pack.popular ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-zinc-200'}`}>
                  {pack.popular && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white">{t('popular')}</span>}
                  <p className="text-lg font-bold text-zinc-900">{pack.credits} {t('creditsUnit')}</p>
                  <p className="mt-1 text-2xl font-bold text-indigo-600">₺{pack.price}</p>
                  <button onClick={() => buyCredits(pack.credits)} disabled={buying}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                    <ShoppingCart className="h-4 w-4" /> {buying ? t('redirecting') : t('buy')}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-zinc-900">{t('creditHistory')}</h2>
            <div className="mt-4 space-y-2">
              {creditLogs.length === 0 && <p className="text-sm text-zinc-500">{t('noCreditLogs')}</p>}
              {creditLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    {log.action === 'consume' ? (
                      <ArrowUp className="h-4 w-4 text-red-500" />
                    ) : (
                      <ArrowDown className="h-4 w-4 text-green-600" />
                    )}
                    <div>
                      <p className="text-sm text-zinc-900">
                        {log.action === 'consume' ? t('usage') : t('topup')}
                        {log.module && ` — ${MODULE_KEYS[log.module] ? t(MODULE_KEYS[log.module]) : log.module}`}
                      </p>
                      <p className="text-xs text-zinc-500">{log.note || ''} · {new Date(log.created_at).toLocaleString('tr-TR')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${log.action === 'consume' ? 'text-red-500' : 'text-green-600'}`}>
                      {log.action === 'consume' ? '-' : '+'}{log.amount}
                    </p>
                    <p className="text-xs text-zinc-500">{log.balance_before} → {log.balance_after}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
