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

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Custom domain: sitemap should be per-store with custom origin
  try {
    const { headers } = await import('next/headers')
    const h = (await headers()).get('host') || ''
    const host = h.toLowerCase().split(':')[0].replace(/^www\./, '').replace(/\.$/, '')
    const isCustom = host && host !== 'rahatio.com.tr' && !host.endsWith('.rahatio.com.tr') && host !== 'localhost' && !host.endsWith('.localhost') && !/^\d+\.\d+\.\d+\.\d+$/.test(host)
    if (isCustom) {
      const now = new Date()
      // Resolve custom host to siteCode
      try {
        const r = await fetch(`${API_BASE}/api/store/resolve?domain=${encodeURIComponent(host)}`, { cache: 'no-store' })
        if (r.ok) {
          const j: any = await r.json().catch(() => null)
          const siteCode: string | undefined = j?.store?.siteCode
          const domain: string | null = j?.store?.domain || host
          if (siteCode) {
            const origin = `https://${domain}`
            const entries: MetadataRoute.Sitemap = [
              { url: origin, lastModified: now, changeFrequency: 'daily', priority: 1 },
              { url: `${origin}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
            ]
            // Fetch store's products/blogs for custom sitemap
            try {
              const sr = await fetch(`${API_BASE}/api/store/${siteCode}`, { cache: 'no-store' })
              if (sr.ok) {
                const sd: any = await sr.json().catch(() => null)
                const prods: any[] = sd?.products ?? []
                for (const p of prods.slice(0, 500)) {
                  const id = p['product.id'] ?? p.id
                  const slug = p.slug ? String(p.slug) : String(id)
                  const lm = p.updatedAt ? new Date(p.updatedAt) : now
                  entries.push({ url: `${origin}/products/${slug}`, lastModified: lm, changeFrequency: 'weekly', priority: 0.8 })
                }
              }
            } catch {}
            try {
              const br = await fetch(`${API_BASE}/api/store/${siteCode}/blogs?limit=100`, { cache: 'no-store' })
              if (br.ok) {
                const bd: any = await br.json().catch(() => null)
                const posts: any[] = bd?.posts ?? []
                for (const p of posts.slice(0, 100)) {
                  if (!p.slug) continue
                  entries.push({ url: `${origin}/blog/${p.slug}`, lastModified: p.updatedAt ? new Date(p.updatedAt) : (p.publishedAt ? new Date(p.publishedAt) : now), changeFrequency: 'weekly', priority: 0.7 })
                }
              }
            } catch {}
            // Mağaza sayfaları (/pages/[slug]) — custom domain canonical
            try {
              const pr = await fetch(`${API_BASE}/api/store/${siteCode}/pages`, { cache: 'no-store' })
              if (pr.ok) {
                const pd: any = await pr.json().catch(() => null)
                const pages: any[] = pd?.pages ?? []
                for (const pg of pages.slice(0, 100)) {
                  if (!pg.slug) continue
                  entries.push({ url: `${origin}/pages/${pg.slug}`, lastModified: pg.updatedAt ? new Date(pg.updatedAt) : now, changeFrequency: 'monthly', priority: 0.5 })
                }
              }
            } catch {}
            if (entries.length > 2) return entries
          }
        }
      } catch {}
    }
  } catch {}
  const now = new Date()
  const staticPages: MetadataRoute.Sitemap = [
    { url: PLATFORM_ORIGIN, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${PLATFORM_ORIGIN}/pricing`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${PLATFORM_ORIGIN}/features`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${PLATFORM_ORIGIN}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${PLATFORM_ORIGIN}/gizlilik-politikasi`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${PLATFORM_ORIGIN}/kvkk-aydinlatma-metni`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${PLATFORM_ORIGIN}/cerez-politikasi`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${PLATFORM_ORIGIN}/kullanim-sartlari`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${PLATFORM_ORIGIN}/mesafeli-satis-sozlesmesi`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${PLATFORM_ORIGIN}/iptal-iade`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${PLATFORM_ORIGIN}/teslimat`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${PLATFORM_ORIGIN}/deletemyaccount`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]

  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 6000)
    // Published stores — try platform sitemap endpoint, fall back to empty
    const res = await fetch(`${API_BASE}/api/store/sitemap`, {
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(t)
    if (!res.ok) return staticPages
    const data: any = await res.json().catch(() => null)
    const stores: Array<{ siteCode?: string; site_code?: string; domain?: string | null; siteUrl?: string | null; updatedAt?: string; pages?: Array<{ slug: string; updatedAt?: string }> }> =
      data?.stores ?? data?.data ?? []

    const entries: MetadataRoute.Sitemap = [...staticPages]
    const seen = new Set<string>()
    const addEntry = (e: MetadataRoute.Sitemap[number]) => {
      if (!seen.has(e.url)) { seen.add(e.url); entries.push(e) }
    }
    // platform blogs (fallback + ensures even if sitemap endpoint lacks them)
    try {
      const br = await fetch(`${API_BASE}/api/store/platform/blogs?limit=100`, { cache: 'no-store' })
      if (br.ok) {
        const bd:any = await br.json().catch(()=>null)
        const posts:any[] = bd?.posts ?? []
        for (const p of posts) {
          addEntry({ url: `${PLATFORM_ORIGIN}/blog/${p.slug}`, lastModified: p.updatedAt ? new Date(p.updatedAt) : (p.publishedAt ? new Date(p.publishedAt) : now), changeFrequency: 'weekly', priority: 0.75 })
        }
      }
    } catch {}

    for (const s of stores.slice(0, 500)) {
      const code = s.siteCode ?? s.site_code ?? ''
      if (!code) continue
      const lm = s.updatedAt ? new Date(s.updatedAt) : now
      // Ana sitemap sadece rahatio.com.tr domainindeki URL'leri içermeli — custom domain URL'ler mağazanın kendi panelindeki sitemap'inde.
      // Her mağaza zaten /stores/{siteCode} altında da erişilebilir, bu URL sitemap'e eklenir.
      if (code !== 'platform') {
        addEntry({
          url: `${PLATFORM_ORIGIN}/stores/${code}`,
          lastModified: lm,
          changeFrequency: 'daily',
          priority: 0.8,
        })
        // Mağaza blog index sayfası (/stores/[code]/blog) — yazıların kendisi aşağıda
        addEntry({
          url: `${PLATFORM_ORIGIN}/stores/${code}/blog`,
          lastModified: lm,
          changeFrequency: 'weekly',
          priority: 0.6,
        })
      }

      const prods: Array<{ id: number; slug?: string | null; updatedAt?: string }> =
        (s as any).products ?? []
      for (const p of prods.slice(0, 200)) {
        const slug = p.slug ? String(p.slug) : String(p.id)
        addEntry({
          url: `${PLATFORM_ORIGIN}/stores/${code}/products/${slug}`,
          lastModified: p.updatedAt ? new Date(p.updatedAt) : lm,
          changeFrequency: 'weekly',
          priority: 0.6,
        })
      }

      const blogs: Array<{ slug: string; updatedAt?: string; publishedAt?: string }> =
        (s as any).blogs ?? []
      for (const b of blogs.slice(0, 100)) {
        if (!b.slug) continue
        const blogUrl =
          code === 'platform'
            ? `${PLATFORM_ORIGIN}/blog/${b.slug}`
            : `${PLATFORM_ORIGIN}/stores/${code}/blog/${b.slug}`
        addEntry({
          url: blogUrl,
          lastModified: b.updatedAt ? new Date(b.updatedAt) : (b.publishedAt ? new Date(b.publishedAt) : lm),
          changeFrequency: 'weekly',
          priority: code === 'platform' ? 0.75 : 0.65,
        })
      }

      // Mağaza içerik sayfaları (/stores/[code]/pages/[slug]) — admin/panel hariç tüm public sayfalar
      const pages: Array<{ slug: string; updatedAt?: string }> =
        (s as any).pages ?? []
      for (const pg of pages.slice(0, 100)) {
        if (!pg.slug) continue
        if (code === 'platform') continue
        addEntry({
          url: `${PLATFORM_ORIGIN}/stores/${code}/pages/${pg.slug}`,
          lastModified: pg.updatedAt ? new Date(pg.updatedAt) : lm,
          changeFrequency: 'monthly',
          priority: 0.5,
        })
      }
    }
    return entries
  } catch {
    return staticPages
  }
}
