import { LandingPage } from '@/components/landing/landing-page'
import type { Plan } from '@/lib/types'

export const dynamic = 'force-dynamic'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.rahatio.com.tr'

async function fetchPlans(): Promise<Plan[] | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(`${API_BASE}/api/plans`, { signal: controller.signal })
    if (!res.ok) return null
    const data = await res.json()
    const list = Array.isArray(data) ? data : (data?.plans ?? [])
    return Array.isArray(list) ? list : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export default async function Home() {
  const plans = await fetchPlans()
  return <LandingPage initialPlans={plans} />
}
