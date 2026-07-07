'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { Plan, Subscription } from '@/lib/types'

export default function BillingPage() {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([
      api.getSubscription(),
      api.getAdminPlans(),
    ])
      .then(([sub, pl]) => {
        setSubscription(sub.subscription)
        setCurrentPlan(sub.plan)
        setPlans(pl)
      })
      .catch(() => setMessage('Failed to load billing info'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSelectPlan(plan: Plan) {
    if (plan.id === currentPlan?.id) return
    setActionLoading(true)
    setMessage('')
    try {
      const res = await api.createCheckoutSession(plan.id)
      if (res.url) {
        window.location.href = res.url
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to start checkout')
    } finally {
      setActionLoading(false)
    }
  }

  async function handlePortal() {
    setActionLoading(true)
    try {
      const res = await api.createPortalSession()
      if (res.url) {
        window.location.href = res.url
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to open portal')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel your subscription?')) return
    setActionLoading(true)
    try {
      await api.cancelSubscription()
      setMessage('Subscription canceled.')
      setSubscription((prev) => prev ? { ...prev, status: 'canceled' } : null)
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to cancel')
    } finally {
      setActionLoading(false)
    }
  }

  if (!user) return null

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Billing</h1>
      <p className="mt-1 text-sm text-zinc-600">Manage your subscription and plan.</p>

      {message && (
        <div className="mt-4 rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700">{message}</div>
      )}

      {loading ? (
        <div className="mt-8 text-sm text-zinc-500">Loading...</div>
      ) : (
        <>
          {currentPlan && (
            <div className="mt-6 rounded-xl border border-zinc-200 p-6">
              <h2 className="text-lg font-semibold text-zinc-900">Current Plan</h2>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold text-zinc-900">{currentPlan.name}</p>
                  <p className="text-sm text-zinc-500">
                    {currentPlan.price > 0 ? `${currentPlan.price} ${currentPlan.currency}/month` : 'Free'}
                  </p>
                  {subscription && (
                    <p className={`mt-1 text-xs font-medium ${
                      subscription.status === 'active' || subscription.status === 'trial'
                        ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {subscription.status === 'trial' ? 'Trial' :
                       subscription.status === 'active' ? 'Active' :
                       subscription.status === 'canceled' ? 'Canceled' : subscription.status}
                      {subscription.renews_at && ` — renews ${new Date(subscription.renews_at).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {subscription?.stripe_id && (
                    <button
                      onClick={handlePortal}
                      disabled={actionLoading}
                      className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      Billing Portal
                    </button>
                  )}
                  {subscription && subscription.status === 'active' && (
                    <button
                      onClick={handleCancel}
                      disabled={actionLoading}
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 border-t border-zinc-100 pt-4 text-sm">
                <div><span className="text-zinc-500">Products:</span> {currentPlan.product_limit < 0 ? 'Unlimited' : currentPlan.product_limit}</div>
                <div><span className="text-zinc-500">Stores:</span> {currentPlan.store_limit}</div>
                <div><span className="text-zinc-500">AI Credits:</span> {currentPlan.ai_credits}</div>
              </div>
            </div>
          )}

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-zinc-900">Available Plans</h2>
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
                    {plan.price > 0 ? `${plan.price} ${plan.currency}` : 'Free'}
                    {plan.price > 0 && <span className="text-sm font-normal text-zinc-500">/month</span>}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">{plan.description}</p>
                  <ul className="mt-4 space-y-2 text-sm text-zinc-600">
                    <li>• {plan.product_limit < 0 ? 'Unlimited' : plan.product_limit} products</li>
                    <li>• {plan.store_limit} store{plan.store_limit > 1 ? 's' : ''}</li>
                    <li>• {plan.ai_credits} AI credits/month</li>
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
                    {plan.id === currentPlan?.id ? 'Current Plan' : plan.price > 0 ? 'Subscribe' : 'Select'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
