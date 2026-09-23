'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { api } from '@/lib/api-client'
import { renderPixelScripts, type PixelScript } from '@/lib/pixel-render'

export default function PixelInjector({ siteCode }: { siteCode: string }) {
  const [scripts, setScripts] = useState<PixelScript[]>([])

  useEffect(() => {
    if (!siteCode) return
    api.getStorePixels(siteCode)
      .then((pixels) => {
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
  }, [siteCode])

  return (
    <>
      {scripts.map((s) =>
        s.src ? (
          <Script key={s.id} id={s.id} src={s.src} strategy={s.strategy} />
        ) : (
          <Script key={s.id} id={s.id} strategy={s.strategy} dangerouslySetInnerHTML={{ __html: s.html! }} />
        )
      )}
    </>
  )
}
