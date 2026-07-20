'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Plan } from '@/lib/types'

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.rahatio.com.tr'
    fetch(`${apiBase}/api/plans`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.plans ?? [])
        setPlans(Array.isArray(list) ? list : [])
        setError('')
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="py-24">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Fiyatlandırma</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">İhtiyacına uygun planı seç, hemen başla.</p>
        <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-4">
          {loading && <p className="col-span-full text-sm text-zinc-400">Yükleniyor...</p>}
          {plans.map((plan, i) => (
            <div key={plan.id} className={`relative rounded-2xl border p-8 text-left ${i === 1 ? 'border-indigo-600 ring-2 ring-indigo-600' : 'border-zinc-200'}`}>
              {i === 1 && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">Popüler</span>}
              <h3 className="text-lg font-semibold text-zinc-900">{plan.name}</h3>
              <p className="mt-4 text-3xl font-bold text-zinc-900">{plan.price > 0 ? `₺${(plan.price ?? 0).toLocaleString('tr-TR')}/ay` : 'Ücretsiz'}</p>
              <ul className="mt-6 space-y-3">
                <li className="text-sm text-zinc-600">✓ {plan.product_limit === -1 ? 'Sınırsız' : (plan.product_limit ?? 0).toLocaleString('tr-TR')} ürün</li>
                <li className="text-sm text-zinc-600">✓ {plan.ai_credits === -1 ? 'Sınırsız' : (plan.ai_credits ?? 0).toLocaleString('tr-TR')} AI kredisi</li>
                <li className="text-sm text-zinc-600">✓ {plan.store_limit ?? 1} mağaza</li>
                {plan.description && <li className="text-sm text-zinc-500">{plan.description}</li>}
              </ul>
              <Link href="/register"
                className={`mt-8 block rounded-lg px-4 py-2 text-center text-sm font-semibold ${i === 1 ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'border border-zinc-300 text-zinc-900 hover:bg-zinc-50'}`}>
                {plan.price > 0 ? 'Seç' : 'Başla'}
              </Link>
            </div>
          ))}
          {!loading && plans.length === 0 && !error && <p className="col-span-full text-sm text-zinc-400">Henüz plan bulunmuyor.</p>}
          {error && <p className="col-span-full text-sm text-red-400">API hatası: {error}</p>}
        </div>
      </div>
    </div>
  )
}