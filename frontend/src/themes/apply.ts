import type { StorefrontTheme } from './catalog'

export type AppliedTokens = {
  bg: string
  fg: string
  primary: string
  secondary: string
  accent: string
  border: string
  brand: string
  radius: string
  card: string
  muted: string
}

/**
 * Preset + mağaza override'larını birleştirip CSS custom properties'e dönüştürür.
 * Store.theme içindeki alanlar preset'i ezer:
 *  - theme.templateId -> Rahatio hazır tema preset'i (theme-001..theme-149)
 *  - theme.primary_color / secondary_color / accent_color -> override
 *  - theme.custom_css -> en sonda eklenir
 */
export function resolveThemeTokens(
  preset: { preview: { brand: string; background: string; foreground: string; primary: string; secondary: string; accent: string; border: string; radius: string; card?: string } } | StorefrontTheme | null,
  storeTheme: Record<string, any> | null | undefined
): AppliedTokens & { customCss: string; fontFamily: string | null } {
  const p: any = (preset as any)?.preview || (preset as any) || null
  const t = (storeTheme || {}) as Record<string, any>

  // preset varsayılan, mağaza özelleştirmesi ezer
  const brand = t.primary_color || t.brand_color || p?.brand || '#4f46e5'
  const bg = t.background_color || p?.background || '#ffffff'
  const fg = t.foreground_color || p?.foreground || '#1a1a1a'
  const primary = t.primary_color || p?.primary || brand
  const secondary = t.secondary_color || p?.secondary || '#f5f5f5'
  const accent = t.accent_color || p?.accent || brand
  const border = t.border_color || p?.border || '#e5e5e5'
  const radius = t.radius || p?.radius || '0.5rem'
  const card = (p as any)?.card || p?.background || '#ffffff'
  const muted = p?.secondary || '#f5f5f5'

  return {
    bg,
    fg,
    primary,
    secondary,
    accent,
    border,
    brand,
    radius,
    card,
    muted,
    customCss: t.custom_css || '',
    fontFamily: t.font_family || null,
  }
}

export function buildThemeCss(tokens: AppliedTokens & { customCss: string; fontFamily: string | null }, templateId: string | null): string {
  const { bg, fg, primary, secondary, accent, border, brand, radius, card, muted, customCss, fontFamily } = tokens
  // Tailwind/shadcn uyumlu değişkenler + Rahatio storefront --sf-* değişkenleri
  // Tüm değerler Rahatio markalı, dış marka yok.
  return `
:root {
  --background: ${bg};
  --foreground: ${fg};
  --card: ${card};
  --card-foreground: ${fg};
  --primary: ${primary};
  --primary-foreground: ${bg};
  --secondary: ${secondary};
  --secondary-foreground: ${fg};
  --muted: ${muted};
  --muted-foreground: ${fg};
  --accent: ${accent};
  --accent-foreground: ${fg};
  --border: ${border};
  --input: ${border};
  --ring: ${brand};
  --radius: ${radius};
  --brand: ${brand};
  --brand-foreground: ${bg};
  --sf-primary: ${brand};
  --sf-secondary: ${primary};
  --sf-accent: ${accent};
  --sf-bg: ${bg};
  --sf-fg: ${fg};
  --sf-border: ${border};
  --sf-radius: ${radius};
  ${fontFamily ? `--sf-font: '${fontFamily}', system-ui, sans-serif;` : ''}
}
${fontFamily ? `[data-storefront] { font-family: '${fontFamily}', system-ui, sans-serif; }` : ''}
[data-storefront] { background-color: ${bg}; color: ${fg}; }
[data-storefront] .sf-btn-primary { background-color: ${brand}; border-color: ${brand}; color: ${bg === '#ffffff' ? '#fff' : bg}; }
[data-storefront] .sf-btn-primary:hover { opacity: 0.92; }
[data-storefront] .sf-text-primary { color: ${brand}; }
[data-storefront] .sf-accent { color: ${accent}; }
[data-storefront] .sf-card { background: ${card}; border-color: ${border}; border-radius: ${radius}; }
${templateId ? `/* template: ${templateId} — Rahatio */` : ''}
${customCss || ''}
`.trim()
}
