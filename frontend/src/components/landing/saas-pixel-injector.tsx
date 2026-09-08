'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { API_BASE } from '@/lib/api-client'
import { renderPixelScripts } from '@/lib/pixel-render'

export function SaasPixelInjector() {
  const [scripts, setScripts] = useState<{ id: string; html: string; strategy: 'afterInteractive' | 'beforeInteractive' }[]>([])

  useEffect(() => {
    fetch(`${API_BASE}/api/analytics/platform/pixels`)
      .then((r) => (r.ok ? r.json() : { pixels: {} }))
      .then((data) => {
        const pixels = (data as any).pixels || {}
        setScripts(renderPixelScripts(pixels))
        const token = (pixels as any)?._meta_domain_verification || (pixels as any)?.facebook_pixel?.domain_verification
        if (token) {
          let tag = document.querySelector('meta[name="facebook-domain-verification"]') as HTMLMetaElement | null
          if (!tag) {
            tag = document.createElement('meta')
            tag.name = 'facebook-domain-verification'
            document.head.appendChild(tag)
          }
          tag.content = String(token)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <>
      {scripts.map((s) => (
        <Script key={s.id} id={`saas-${s.id}`} strategy={s.strategy} dangerouslySetInnerHTML={{ __html: s.html }} />
      ))}
    </>
  )
}
