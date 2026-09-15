'use client'

import { useEffect, useRef } from 'react'
import { api } from '@/lib/api-client'
import { getPresetLite } from '@/themes/presets'
import { buildThemeCss, resolveThemeTokens } from '@/themes/apply'
import { ensureFontsForTheme } from '@/themes/fonts'

/**
 * Storefront tema enjeksiyonu — Rahatio markalı.
 * Store.theme içindeki `templateId` (theme-001..theme-149) preset'i taban alır,
 * mağazanın primary_color / custom_css gibi alanları preset'i ezer.
 * Dış marka (YNS vb.) enjekte edilmez; CSS yorumunda sadece Rahatio geçer.
 */
export default function StoreThemeInjector({ siteCode }: { siteCode: string }) {
  const injected = useRef<string | null>(null)

  useEffect(() => {
    if (!siteCode || injected.current === siteCode) return
    injected.current = siteCode

    api.getStoreFront(siteCode)
      .then((r: any) => {
        const theme = (r?.store?.theme ?? {}) as Record<string, any>
        const templateId: string | null = theme.templateId || theme.template_id || theme.themeId || null
        const lite = getPresetLite(templateId)
        // Bridge lite -> StorefrontTheme preview shape expected by resolveThemeTokens
        const presetBridge: any = lite
          ? { id: lite.id, preview: { brand: lite.brand, background: lite.bg, foreground: lite.fg, primary: lite.primary, secondary: lite.secondary, accent: lite.accent, border: lite.border, radius: lite.radius, card: lite.card }, fontStack: lite.fontStack, layoutHint: lite.layoutHint }
          : null
        const tokens = resolveThemeTokens(presetBridge, theme)
        // font yükle (preset + override)
        ensureFontsForTheme(presetBridge?.fontStack || null, (tokens as any).fontFamily || null)
        const css = buildThemeCss(tokens, templateId)

        const root = document.documentElement
        // Hızlı setProperty + tam CSS text (fallbacks korunur)
        root.style.setProperty('--sf-primary', tokens.brand)
        root.style.setProperty('--sf-secondary', tokens.primary)
        root.style.setProperty('--sf-accent', tokens.accent)
        root.style.setProperty('--sf-bg', tokens.bg)
        root.style.setProperty('--sf-fg', tokens.fg)
        root.style.setProperty('--sf-border', tokens.border)
        root.style.setProperty('--sf-radius', tokens.radius)
        if (tokens.fontFamily) root.style.setProperty('--sf-font', tokens.fontFamily)
        if (templateId) root.setAttribute('data-theme', templateId)
        else root.removeAttribute('data-theme')

        const styleId = 'store-theme-css'
        let styleEl = document.getElementById(styleId) as HTMLStyleElement | null
        if (!styleEl) {
          styleEl = document.createElement('style')
          styleEl.id = styleId
          document.head.appendChild(styleEl)
        }
        styleEl.textContent = css

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
