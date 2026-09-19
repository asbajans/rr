import type { Metadata } from 'next'
import { headers } from 'next/headers'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.rahatio.com.tr'
const PLATFORM_ORIGIN = 'https://rahatio.com.tr'

export async function generateMetadata({ params }: { params: Promise<{ siteCode: string }> }): Promise<Metadata> {
  const { siteCode } = await params
  try {
    const h = await headers()
    const host = h.get('host') || ''
    const isCustom = host && !host.includes('rahatio.com.tr') && !host.includes('localhost') && !/^\d+\.\d+\.\d+\.\d+/.test(host.split(':')[0])

    const res = await fetch(`${API_BASE}/api/store/${siteCode}`, { cache: 'no-store', next: { revalidate: 0 } })
    if (!res.ok) return {}
    const data: any = await res.json().catch(() => null)
    const store = data?.store ?? {}
    const name = store.name || siteCode
    const description = store.description ? String(store.description).replace(/<[^>]*>/g, '').slice(0, 160) : `${name} — resmi mağaza`

    // Canonical: custom domain if request came via custom host and store has that domain, otherwise platform
    let canonical: string | undefined
    if (isCustom) {
      const proto = h.get('x-forwarded-proto') || 'https'
      canonical = `${proto}://${host.split(':')[0]}`
    } else if (store.domain) {
      // Use store's custom domain as canonical if exists, otherwise platform
      const d = String(store.domain).trim().toLowerCase().replace(/^www\./, '')
      if (d && d !== 'rahatio.com.tr' && !d.endsWith('.rahatio.com.tr')) {
        canonical = `https://${store.domain}`
      } else {
        canonical = `${PLATFORM_ORIGIN}/stores/${siteCode}`
      }
    } else {
      canonical = `${PLATFORM_ORIGIN}/stores/${siteCode}`
    }

    return {
      title: name,
      description,
      openGraph: {
        title: name,
        description,
        url: canonical,
        siteName: name,
        type: 'website',
      },
      twitter: {
        card: 'summary',
        title: name,
        description,
      },
      alternates: canonical ? { canonical } : undefined,
    }
  } catch {
    return { title: siteCode }
  }
}

export default function StoreSiteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
