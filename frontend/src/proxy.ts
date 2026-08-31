import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Edge proxy (Next.js 16; formerly middleware).
 *
 * Resolves custom-domain hosts to the matching storefront:
 *   https://magaza.example.com/products/1  →  rewrite /stores/{siteCode}/products/1
 *
 * Platform domains (rahatio.com.tr and subdomains), localhost and bare IPs
 * pass through untouched.
 */

const PLATFORM_DOMAINS = ['rahatio.com.tr']
const API_BASES = [
  process.env.API_PROXY_TARGET,
  process.env.NEXT_PUBLIC_API_URL,
  'https://api.rahatio.com.tr',
  'http://rahatio-core:3000',
  'http://core-api:3000',
].filter(Boolean) as string[]
const CACHE_TTL_MS = 60_000

const resolveCache = new Map<string, { siteCode: string; expires: number }>()

function normalizeHost(host: string): string {
  let h = host.toLowerCase()
  if (h.startsWith('www.')) h = h.slice(4)
  const port = h.indexOf(':')
  if (port > 0) h = h.slice(0, port)
  return h.replace(/\.$/, '')
}

function isPlatformHost(host: string): boolean {
  const h = normalizeHost(host)
  if (!h) return true
  if (PLATFORM_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`))) return true
  if (h === 'localhost' || h.endsWith('.localhost')) return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true
  return false
}

async function resolveStore(domain: string): Promise<string | null> {
  const cached = resolveCache.get(domain)
  if (cached && cached.expires > Date.now()) return cached.siteCode

  for (const base of API_BASES) {
    try {
      const url = `${base.replace(/\/$/, '')}/api/store/resolve?domain=${encodeURIComponent(domain)}`
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) continue
      const data: any = await res.json()
      const siteCode: string | undefined = data?.store?.siteCode
      if (!siteCode) continue
      resolveCache.set(domain, { siteCode, expires: Date.now() + CACHE_TTL_MS })
      return siteCode
    } catch (e) {
      // try next base
      continue
    }
  }
  return null
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host') || ''
  if (isPlatformHost(host)) return NextResponse.next()

  const { pathname, search } = request.nextUrl
  // Already a platform storefront path — don't double-rewrite.
  if (pathname.startsWith('/stores/')) return NextResponse.next()

  const domain = normalizeHost(host)
  const siteCode = await resolveStore(domain)
  if (!siteCode) return NextResponse.next()

  const destPath = pathname === '/' ? `/stores/${siteCode}` : `/stores/${siteCode}${pathname}`
  const url = new URL(`${destPath}${search}`, request.url)
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
}