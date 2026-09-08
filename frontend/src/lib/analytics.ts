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

export function trackPlatform(extra: { path?: string; eventType?: string; metadata?: any } = {}) {
  if (typeof window === 'undefined') return
  const utm = getUtm()
  const payload: any = {
    path: extra.path || window.location.pathname,
    referrer: document.referrer || undefined,
    sessionId: getSid(),
    utmSource: utm.utm_source,
    utmMedium: utm.utm_medium,
    utmCampaign: utm.utm_campaign,
    eventType: extra.eventType || 'platform_view',
    metadata: extra.metadata,
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

export function trackWhatsappClick(source: string = 'landing') {
  if (typeof window === 'undefined') return
  // Internal SaaS analytics
  try { trackPlatform({ path: '/whatsapp', eventType: 'whatsapp_click', metadata: { source } }) } catch {}
  // Google ecosystems
  try {
    const w = window as any
    // dataLayer for GTM
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event: 'whatsapp_click', whatsapp_number: '+15054415616', source })
    // gtag
    if (typeof w.gtag === 'function') {
      w.gtag('event', 'whatsapp_click', { event_category: 'contact', event_label: source, value: 1 })
      w.gtag('event', 'conversion', { send_to: undefined })
    }
    // Meta / Facebook
    if (typeof w.fbq === 'function') w.fbq('track', 'Contact', { content_name: 'whatsapp', source })
    // TikTok
    if (w.ttq && typeof w.ttq.track === 'function') w.ttq.track('Contact')
  } catch {}
}

export function trackSignup(extra: { method?: string; source?: string; siteCode?: string } = {}) {
  if (typeof window === 'undefined') return
  const { method = 'email', source = 'site', siteCode } = extra
  try {
    if (siteCode) {
      trackStore(siteCode, 'signup', { metadata: { method, source } })
    } else {
      trackPlatform({ path: '/signup', eventType: 'signup', metadata: { method, source } })
    }
  } catch {}
  try {
    const w = window as any
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event: 'signup', method, source, siteCode: siteCode || undefined })
    if (typeof w.gtag === 'function') {
      w.gtag('event', 'sign_up', { method, source })
      // also fire conversion for Google Ads (GTM can map signup → AW conversion)
      w.gtag('event', 'conversion', { send_to: undefined })
    }
    if (typeof w.fbq === 'function') w.fbq('track', 'CompleteRegistration', { content_name: source, method })
    if (w.ttq && typeof w.ttq.track === 'function') w.ttq.track('CompleteRegistration', { method, source })
  } catch {}
}

export function trackPurchase(extra: { value: number; currency?: string; transactionId?: string; source?: string; siteCode?: string; items?: any[] } = { value: 0 }) {
  if (typeof window === 'undefined') return
  const { value, currency = 'TRY', transactionId, source = 'site', siteCode, items } = extra
  try {
    if (siteCode) {
      trackStore(siteCode, 'purchase', { metadata: { revenue: value, currency, transactionId, source, items } })
    } else {
      trackPlatform({ path: '/purchase', eventType: 'purchase', metadata: { value, currency, transactionId, source, items } })
    }
  } catch {}
  try {
    const w = window as any
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event: 'purchase', ecommerce: { transaction_id: transactionId, value, currency, items: items || [] }, source, siteCode: siteCode || undefined })
    if (typeof w.gtag === 'function') {
      w.gtag('event', 'purchase', { transaction_id: transactionId, value, currency, items: items || [] })
      // Ads conversion will be handled via GTM/GA4; fire generic conversion as hook
      w.gtag('event', 'conversion', { send_to: undefined, value, currency, transaction_id: transactionId })
    }
    if (typeof w.fbq === 'function') w.fbq('track', 'Purchase', { value, currency })
    if (w.ttq && typeof w.ttq.track === 'function') w.ttq.track('CompletePayment', { value: Number(value), currency })
  } catch {}
}
