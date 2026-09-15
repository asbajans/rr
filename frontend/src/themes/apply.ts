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
  preset: { preview: { brand: string; background: string; foreground: string; primary: string; secondary: string; accent: string; border: string; radius: string; card?: string }; fontStack?: string } | StorefrontTheme | null,
  storeTheme: Record<string, any> | null | undefined
): AppliedTokens & { customCss: string; fontFamily: string | null; fontHeading: string | null; fontStack: string | null } {
  const p: any = (preset as any)?.preview || (preset as any) || null
  const presetFontStack: string | null = (preset as any)?.fontStack || (preset as any)?.font_stack || null
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

  // font: override varsa o, yoksa preset fontStack'i kullan
  const fontFamily: string | null = t.font_family || null
  const fontHeading: string | null = null
  let fontStack: string | null = presetFontStack
  if (!fontFamily && presetFontStack) {
    fontStack = presetFontStack
  }

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
    fontFamily,
    fontHeading,
    fontStack,
  }
}

export function buildThemeCss(tokens: AppliedTokens & { customCss: string; fontFamily: string | null; fontHeading?: string | null; fontStack?: string | null }, templateId: string | null): string {
  // fontStack preset'ten geliyorsa onu kullan, override varsa theme font'u baskın
  let bodyFont = tokens.fontFamily
  let headingFont: string | null = (tokens as any).fontHeading || null
  const stack = (tokens as any).fontStack as string | null
  if (!bodyFont && stack) {
    // basit ayrışım: "Oswald,Geist" -> heading Oswald, body Inter
    const parts = stack.split(',').map((s) => s.trim()).filter(Boolean)
    const rawHeading = parts[0] || 'Inter'
    const rawBody = parts[1] || parts[0] || 'Inter'
    const norm = (n: string) => (n === 'Playfair' ? 'Playfair Display' : n === 'Geist' ? 'Inter' : n)
    headingFont = norm(rawHeading)
    bodyFont = norm(rawBody)
  }
  if (bodyFont && bodyFont === 'Geist') bodyFont = 'Inter'
  if (headingFont && headingFont === 'Geist') headingFont = 'Inter'

  const { bg, fg, primary, secondary, accent, border, brand, radius, card, muted, customCss } = tokens
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
  ${bodyFont ? `--sf-font: '${bodyFont}', system-ui, sans-serif;` : ''}
  ${headingFont ? `--sf-font-heading: '${headingFont}', system-ui, sans-serif;` : bodyFont ? `--sf-font-heading: '${bodyFont}', system-ui, sans-serif;` : ''}
}
${bodyFont ? `[data-storefront] { font-family: '${bodyFont}', system-ui, sans-serif; }` : ''}
${headingFont ? `[data-storefront] h1, [data-storefront] h2, [data-storefront] h3, [data-storefront] .sf-heading { font-family: '${headingFont}', system-ui, sans-serif; letter-spacing: -0.02em; }` : ''}
[data-storefront] { background-color: ${bg}; color: ${fg}; }
[data-storefront] .sf-btn-primary { background-color: ${brand}; border-color: ${brand}; color: ${bg === '#ffffff' ? '#fff' : bg}; border-radius: ${radius}; }
[data-storefront] .sf-btn-primary:hover { opacity: 0.92; }
[data-storefront] .sf-text-primary { color: ${brand}; }
[data-storefront] .sf-accent { color: ${accent}; }
[data-storefront] .sf-card { background: ${card}; border-color: ${border}; border-radius: ${radius}; }
[data-storefront] input, [data-storefront] select { border-radius: ${radius}; }
${templateId ? `/* template: ${templateId} — Rahatio */` : ''}
${customCss || ''}
`.trim()
}
