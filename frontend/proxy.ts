import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const platformDomains = ['rahatio.com.tr', 'www.rahatio.com.tr', 'app.rahatio.com.tr', 'localhost:3690']

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host') || ''

  if (platformDomains.some(d => host === d || host.endsWith('.' + d))) {
    return NextResponse.next()
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.rahatio.com.tr'

  try {
    const url = new URL('/api/resolve-domain', apiBase)
    url.searchParams.set('domain', host)
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) })

    if (!res.ok) {
      return NextResponse.next()
    }

    const data = await res.json()
    if (!data.exists) {
      return NextResponse.next()
    }

    const dest = request.nextUrl.clone()
    const path = dest.pathname === '/' ? '' : dest.pathname
    dest.pathname = `/store/${data.site_code}${path}`
    return NextResponse.rewrite(dest)
  } catch {
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!api/|_next/|_static/|_vercel|favicon.ico|robots.txt).*)',
  ],
}
