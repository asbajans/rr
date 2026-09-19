'use client'

import { useEffect } from 'react'
import { api } from '@/lib/api-client'

export default function StoreSeo({ siteCode }: { siteCode: string }) {
  useEffect(() => {
    if (!siteCode) return
    api.getStoreFront(siteCode).then((r: any) => {
      const store = r?.store ?? {}
      const name = store.name || siteCode
      // Title: seller's store name, not Rahatio
      document.title = name

      // Update or create meta tags for SEO per domain
      const setMeta = (selector: string, content: string, attr: 'name' | 'property' = 'name') => {
        let el = document.querySelector(`meta[${attr}="${selector}"]`) as HTMLMetaElement | null
        if (!el) {
          el = document.createElement('meta')
          el.setAttribute(attr, selector)
          document.head.appendChild(el)
        }
        el.content = content
      }

      const description = store.description || `${name} — resmi mağaza`
      // Use current host for canonical/og:url when on custom domain, otherwise platform
      const host = window.location.host
      const isCustom = host && !host.includes('rahatio.com.tr') && !host.includes('localhost') && !/^\d+\.\d+\.\d+\.\d+/.test(host)
      const origin = isCustom ? `${window.location.protocol}//${host}` : `https://rahatio.com.tr/stores/${siteCode}`

      setMeta('description', description)
      setMeta('og:title', name, 'property')
      setMeta('og:description', description, 'property')
      setMeta('og:url', origin, 'property')
      setMeta('og:site_name', name, 'property')
      setMeta('twitter:title', name)
      setMeta('twitter:description', description)

      // Canonical link
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
      if (!link) {
        link = document.createElement('link')
        link.rel = 'canonical'
        document.head.appendChild(link)
      }
      link.href = origin
    }).catch(() => {})
  }, [siteCode])

  return null
}
