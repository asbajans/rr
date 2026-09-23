export type PixelConfig = Record<string, any>

export type PixelScript = { id: string; html?: string; src?: string; strategy: 'afterInteractive' | 'beforeInteractive' | 'lazyOnload' }

// Shared renderer for both storefront (PixelInjector) and SaaS landing (SaasPixelInjector).
// Covers GA4, GTM, Google Ads, Meta (FB), TikTok, plus custom head/body.
export function renderPixelScripts(pixels: PixelConfig): PixelScript[] {
  const scripts: PixelScript[] = []

  if (pixels.google_analytics?.enabled && pixels.google_analytics.measurement_id) {
    const id = String(pixels.google_analytics.measurement_id).trim()
    if (id) {
      // Correct GA4 pattern: external gtag/js + inline config (dataLayer queue)
      scripts.push({
        id: 'ga-src',
        src: `https://www.googletagmanager.com/gtag/js?id=${id}`,
        strategy: 'afterInteractive',
      })
      scripts.push({
        id: 'ga-config',
        html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','${id}');`,
        strategy: 'afterInteractive',
      })
    }
  }

  if (pixels.google_tag_manager?.enabled && pixels.google_tag_manager.container_id) {
    const id = String(pixels.google_tag_manager.container_id).trim()
    if (id) {
      scripts.push({
        id: 'gtm-script',
        html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`,
        strategy: 'afterInteractive',
      })
      // gtm noscript is an HTML iframe, not a Script — handled via <noscript> in the injector if needed; skip here
    }
  }

  if (pixels.google_ads?.enabled && pixels.google_ads.conversion_id) {
    const id = String(pixels.google_ads.conversion_id).trim()
    if (id) {
      scripts.push({
        id: 'gads-src',
        src: `https://www.googletagmanager.com/gtag/js?id=${id}`,
        strategy: 'afterInteractive',
      })
      scripts.push({
        id: 'gads-config',
        html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','${id}');`,
        strategy: 'afterInteractive',
      })
    }
  }

  if (pixels.facebook_pixel?.enabled && pixels.facebook_pixel.pixel_id) {
    const id = String(pixels.facebook_pixel.pixel_id).trim()
    if (id) {
      scripts.push({
        id: 'fb-pixel',
        html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`,
        strategy: 'afterInteractive',
      })
    }
  }

  if (pixels.tiktok_pixel?.enabled && pixels.tiktok_pixel.pixel_id) {
    const id = String(pixels.tiktok_pixel.pixel_id).trim()
    if (id) {
      scripts.push({
        id: 'tt-pixel',
        html: `!function(w,d,e,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(i){var s=d.createElement('script');s.type='text/javascript';s.async=true;s.src='https://analytics.tiktok.com/i18n/pixel/sdk.js?sdkid='+i;var x=d.getElementsByTagName('script')[0];x.parentNode.insertBefore(s,x)};ttq.load('${id}');ttq.page();}(window,document,'script','ttq');`,
        strategy: 'afterInteractive',
      })
    }
  }

  if (pixels.custom_head?.enabled && pixels.custom_head.code) {
    scripts.push({
      id: 'custom-head',
      html: String(pixels.custom_head.code),
      strategy: 'beforeInteractive',
    })
  }

  if (pixels.custom_body?.enabled && pixels.custom_body.code) {
    scripts.push({
      id: 'custom-body',
      html: String(pixels.custom_body.code),
      strategy: 'afterInteractive',
    })
  }

  return scripts
}
