'use client'

import { API_BASE } from './api-client'

const SID_KEY = 'rahatio_sid'
const UTM_KEY = 'rahatio_utm'

function getSid(): string {
  if (typeof window === 'undefined') return ''
  let sid = localStorage.getItem(SID_KEY)
  if (!sid) {
    sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(SID_KEY, sid)
  }
  return sid
}

function getUtm(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const sp = new URLSearchParams(window.location.search)
    const utm: Record<string, string> = {}
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
    let hasNew = false
    for (const k of keys) {
      const v = sp.get(k)
      if (v) { utm[k] = v; hasNew = true }
    }
    if (hasNew) {
      localStorage.setItem(UTM_KEY, JSON.stringify(utm))
      return utm
    }
    const stored = localStorage.getItem(UTM_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return {}
}

export function trackStore(siteCode: string, eventType: string, extra: { productId?: number; path?: string; metadata?: any } = {}) {
  if (typeof window === 'undefined' || !siteCode) return
  const utm = getUtm()
  const payload: any = {
    eventType,
    path: extra.path || window.location.pathname,
    referrer: document.referrer || undefined,
    sessionId: getSid(),
    utmSource: utm.utm_source,
    utmMedium: utm.utm_medium,
    utmCampaign: utm.utm_campaign,
    productId: extra.productId,
    metadata: extra.metadata,
  }
  const url = `${API_BASE}/api/store/${encodeURIComponent(siteCode)}/track`
  const body = JSON.stringify(payload)
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon(url, blob)
      return
    }
  } catch {}
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true } as any).catch(() => {})
}

export function trackPlatform(extra: { path?: string } = {}) {
  if (typeof window === 'undefined') return
  const utm = getUtm()
  const payload: any = {
    path: extra.path || window.location.pathname,
    referrer: document.referrer || undefined,
    sessionId: getSid(),
    utmSource: utm.utm_source,
    utmMedium: utm.utm_medium,
    utmCampaign: utm.utm_campaign,
  }
  const url = `${API_BASE}/api/analytics/platform/track`
  const body = JSON.stringify(payload)
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon(url, blob)
      return
    }
  } catch {}
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true } as any).catch(() => {})
}
