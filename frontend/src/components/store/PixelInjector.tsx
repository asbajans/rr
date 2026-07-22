'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { api } from '@/lib/api-client'

type PixelConfig = Record<string, any>

function renderPixelScripts(pixels: PixelConfig): { id: string; html: string; strategy: 'afterInteractive' | 'beforeInteractive' }[] {
  const scripts: { id: string; html: string; strategy: 'afterInteractive' | 'beforeInteractive' }[] = []

  if (pixels.google_analytics?.enabled && pixels.google_analytics.measurement_id) {
    const id = pixels.google_analytics.measurement_id
    scripts.push({
      id: 'ga-script',
      html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','${id}');`,
      strategy: 'afterInteractive',
    })
    scripts.push({
      id: 'ga-loader',
      html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtag/js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`,
      strategy: 'beforeInteractive',
    })
  }

  if (pixels.google_tag_manager?.enabled && pixels.google_tag_manager.container_id) {
    const id = pixels.google_tag_manager.container_id
    scripts.push({
      id: 'gtm-script',
      html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`,
      strategy: 'beforeInteractive',
    })
    scripts.push({
      id: 'gtm-noscript',
      html: `<iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
      strategy: 'afterInteractive',
    })
  }

  if (pixels.facebook_pixel?.enabled && pixels.facebook_pixel.pixel_id) {
    const id = pixels.facebook_pixel.pixel_id
    scripts.push({
      id: 'fb-pixel',
      html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`,
      strategy: 'afterInteractive',
    })
  }

  if (pixels.tiktok_pixel?.enabled && pixels.tiktok_pixel.pixel_id) {
    const id = pixels.tiktok_pixel.pixel_id
    scripts.push({
      id: 'tt-pixel',
      html: `!function(w,d,e,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(i){var s=d.createElement('script');s.type='text/javascript';s.async=true;s.src='https://analytics.tiktok.com/i18n/pixel/sdk.js?sdkid='+i;var x=d.getElementsByTagName('script')[0];x.parentNode.insertBefore(s,x)};ttq.load('${id}');ttq.page();}(window,document,'script','ttq');`,
      strategy: 'afterInteractive',
    })
  }

  if (pixels.custom_head?.enabled && pixels.custom_head.code) {
    scripts.push({
      id: 'custom-head',
      html: pixels.custom_head.code,
      strategy: 'beforeInteractive',
    })
  }

  if (pixels.custom_body?.enabled && pixels.custom_body.code) {
    scripts.push({
      id: 'custom-body',
      html: pixels.custom_body.code,
      strategy: 'afterInteractive',
    })
  }

  return scripts
}

export default function PixelInjector({ siteCode }: { siteCode: string }) {
  const [scripts, setScripts] = useState<{ id: string; html: string; strategy: 'afterInteractive' | 'beforeInteractive' }[]>([])

  useEffect(() => {
    if (!siteCode) return
    api.getStorePixels(siteCode)
      .then((pixels) => setScripts(renderPixelScripts(pixels)))
      .catch(() => {})
  }, [siteCode])

  return (
    <>
      {scripts.map((s) => (
        <Script key={s.id} id={s.id} strategy={s.strategy} dangerouslySetInnerHTML={{ __html: s.html }} />
      ))}
    </>
  )
}
