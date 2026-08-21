import type { MetadataRoute } from 'next'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.rahatio.com.tr'
const PLATFORM_ORIGIN = 'https://rahatio.com.tr'

function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null
  let d = String(domain).trim().toLowerCase()
  d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')
  if (!d || d === 'rahatio.com.tr' || d.endsWith('.rahatio.com.tr')) return null
  if (d === 'localhost' || d.endsWith('.localhost')) return null
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(d)) return null
  return d
}

function storeOrigin(siteCode: string, domain: string | null | undefined): string {
  const d = normalizeDomain(domain)
  if (d) return `https://${d}`
  return PLATFORM_ORIGIN
}

function storePath(siteCode: string, domain: string | null | undefined, p: string): string {
  const d = normalizeDomain(domain)
  const suffix = p ? `/${p.replace(/^\/+/, '')}` : ''
  if (d) return `${storeOrigin(siteCode, domain)}${suffix}`
  return `${PLATFORM_ORIGIN}/stores/${siteCode}${suffix}`
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticPages: MetadataRoute.Sitemap = [
    { url: PLATFORM_ORIGIN, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${PLATFORM_ORIGIN}/pricing`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${PLATFORM_ORIGIN}/features`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${PLATFORM_ORIGIN}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
  ]

  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 6000)
    // Published stores — try platform sitemap endpoint, fall back to empty
    const res = await fetch(`${API_BASE}/api/store/sitemap`, {
      signal: controller.signal,
      next: { revalidate: 3600 },
    })
    clearTimeout(t)
    if (!res.ok) return staticPages
    const data: any = await res.json().catch(() => null)
    const stores: Array<{ siteCode?: string; site_code?: string; domain?: string | null; siteUrl?: string | null; updatedAt?: string }> =
      data?.stores ?? data?.data ?? []

    const entries: MetadataRoute.Sitemap = [...staticPages]
    for (const s of stores.slice(0, 500)) {
      const code = s.siteCode ?? s.site_code ?? ''
      if (!code) continue
      const domain = s.domain ?? (s as any).siteUrl ?? null
      const lm = s.updatedAt ? new Date(s.updatedAt) : now
      entries.push({
        url: storePath(code, domain, ''),
        lastModified: lm,
        changeFrequency: 'daily',
        priority: 0.8,
      })

      const prods: Array<{ id: number; slug?: string | null; updatedAt?: string }> =
        (s as any).products ?? []
      for (const p of prods.slice(0, 200)) {
        const slug = p.slug ? String(p.slug) : String(p.id)
        entries.push({
          url: storePath(code, domain, `products/${slug}`),
          lastModified: p.updatedAt ? new Date(p.updatedAt) : lm,
          changeFrequency: 'weekly',
          priority: 0.6,
        })
      }
    }
    return entries
  } catch {
    return staticPages
  }
}
