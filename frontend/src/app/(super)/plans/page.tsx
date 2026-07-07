'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import type { Plan } from '@/lib/types'

export default function SuperPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getAdminPlans()
      .then(setPlans)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Planlar</h1>
      <p className="mt-1 text-sm text-zinc-600">Abonelik planlarını yönet.</p>
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-4">
        {plans.map((plan) => (
          <div key={plan.id} className={`rounded-xl border p-6 ${plan.is_active ? 'border-zinc-200' : 'border-red-200 opacity-60'}`}>
            <h3 className="text-lg font-semibold text-zinc-900">{plan.name}</h3>
            <p className="mt-1 text-sm text-zinc-500">{plan.description}</p>
            <p className="mt-4 text-3xl font-bold text-zinc-900">{plan.price.toLocaleString('tr-TR')} <span className="text-sm font-normal text-zinc-500">₺/ay</span></p>
            <ul className="mt-6 space-y-2 text-sm text-zinc-600">
              <li>• {plan.ai_credits === -1 ? 'Sınırsız' : plan.ai_credits.toLocaleString('tr-TR')} AI kredisi</li>
              <li>• {plan.product_limit === -1 ? 'Sınırsız' : plan.product_limit.toLocaleString('tr-TR')} ürün</li>
              <li>• {plan.store_limit} mağaza</li>
            </ul>
            {!plan.is_active && (
              <p className="mt-4 text-xs font-medium text-red-600">Pasif</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
