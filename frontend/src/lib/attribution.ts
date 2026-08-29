'use client'

const STORAGE_KEY = 'rahatio_attribution'
const KNOWN = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'rh_src', 'rh_pid', 'fbclid', 'gclid'] as const

export type Attribution = Record<string, string>

function parseFromSearch(search: string): Attribution | null {
  if (!search) return null
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  const out: Attribution = {}
  for (const k of KNOWN) {
    const v = params.get(k)
    if (v) out[k] = v
  }
  // capture referrer if fb/ig
  if (out.rh_src || out.utm_source) return Object.keys(out).length ? out : null
  // still capture fbclid/gclid alone
  if (out.fbclid || out.gclid) return out
  return Object.keys(out).length ? out : null
}

export function captureAttribution(): void {
  if (typeof window === 'undefined') return
  const parsed = parseFromSearch(window.location.search)
  if (parsed) {
    const enriched: Attribution = {
      ...parsed,
      referrer: document.referrer || undefined as any,
      landingPath: window.location.pathname + window.location.search,
    }
    // remove undefined
    Object.keys(enriched).forEach(k => { if (!enriched[k]) delete enriched[k] })
    try {
      const existingRaw = localStorage.getItem(STORAGE_KEY)
      const existing = existingRaw ? JSON.parse(existingRaw) as Attribution : {}
      // keep first-touch if already has rh_src, else overwrite with latest fb/ig touch
      const shouldOverwrite = !existing.rh_src || parsed.rh_src === 'facebook' || parsed.rh_src === 'instagram' || parsed.rh_src === 'facebook_catalog'
      if (shouldOverwrite) localStorage.setItem(STORAGE_KEY, JSON.stringify(enriched))
      else if (!existingRaw) localStorage.setItem(STORAGE_KEY, JSON.stringify(enriched))
    } catch {}
  }
}

export function getAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

export function clearAttribution(): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}
