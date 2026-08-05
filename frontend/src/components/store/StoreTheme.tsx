'use client'

import { useEffect, useRef } from 'react'
import { api } from '@/lib/api-client'

/**
 * Fetches the store's theme once and injects it as CSS custom properties on
 * <html> plus an inline <style> for custom_css / font-family, and sets the
 * favicon. Storefront components consume --sf-* variables with zinc fallbacks.
 */
export default function StoreThemeInjector({ siteCode }: { siteCode: string }) {
  const injected = useRef<string | null>(null)

  useEffect(() => {
    if (!siteCode || injected.current === siteCode) return
    injected.current = siteCode

    api.getStoreFront(siteCode)
      .then((r: any) => {
        const theme = r?.store?.theme ?? {}
        const primary = theme.primary_color || '#4f46e5'
        const secondary = theme.secondary_color || '#18181b'
        const accent = theme.accent_color || '#f59e0b'
        const font = theme.font_family || ''

        const root = document.documentElement
        root.style.setProperty('--sf-primary', primary)
        root.style.setProperty('--sf-secondary', secondary)
        root.style.setProperty('--sf-accent', accent)
        root.style.setProperty('--sf-font', font)

        const styleId = 'store-theme-css'
        let styleEl = document.getElementById(styleId) as HTMLStyleElement | null
        if (!styleEl) {
          styleEl = document.createElement('style')
          styleEl.id = styleId
          document.head.appendChild(styleEl)
        }
        styleEl.textContent = `
          :root {
            --sf-primary: ${primary};
            --sf-secondary: ${secondary};
            --sf-accent: ${accent};
            ${font ? `--sf-font: '${font}', system-ui, sans-serif;` : ''}
          }
          ${font ? `[data-storefront] { font-family: '${font}', system-ui, sans-serif; }` : ''}
          [data-storefront] .sf-btn-primary { background-color: ${primary}; border-color: ${primary}; }
          [data-storefront] .sf-btn-primary:hover { opacity: 0.92; }
          [data-storefront] .sf-text-primary { color: ${primary}; }
          [data-storefront] .sf-accent { color: ${accent}; }
          ${theme.custom_css || ''}
        `

        const favicon = theme.favicon_url
        if (favicon) {
          let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
          if (!link) {
            link = document.createElement('link')
            link.rel = 'icon'
            document.head.appendChild(link)
          }
          link.href = favicon
        }
      })
      .catch(() => {})
  }, [siteCode])

  return null
}
