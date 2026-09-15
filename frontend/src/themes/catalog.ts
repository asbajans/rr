// Rahatio hazır temalar — 149 tema
// Source: presets-lite.json — lite for bundle size
import liteRaw from './presets-lite.json'

export type YnsThemeRaw = {
  id: string
  brand: string
  bg: string
  fg: string
  primary: string
  secondary: string
  accent: string
  border: string
  radius: string
  card: string
  muted: string
  fontStack: string
  layoutHint: string
  brandFg?: string | null
  fontHeading?: string | null
  sections?: { promo: boolean; deal: boolean; trust: boolean; blog: boolean; sidebar: boolean }
  resolved?: {
    primary: string | null
    secondary: string | null
    background: string | null
    foreground: string | null
    card: string | null
    muted: string | null
    accent: string | null
    border: string | null
    brand: string | null
    radius: string | null
  }
}

export type StorefrontTheme = {
  id: string
  name: string
  category: string
  preview: {
    brand: string
    background: string
    foreground: string
    primary: string
    secondary: string
    accent: string
    border: string
    radius: string
    card: string
  }
  fontStack: string
  layoutHint: string
  raw: YnsThemeRaw
}

function guessCategory(r: YnsThemeRaw): string {
  const p = (r.primary || '').toLowerCase()
  const bg = (r.bg || '').toLowerCase()
  const brand = (r.brand || '').toLowerCase()
  if (bg.includes('oklch(0.06') || bg === '#000000' || bg === '#0f0e12' || bg.includes('oklch(0.12') || bg.includes('oklch(0.13')) return 'Koyu'
  if (brand.includes('oklch(0.65 0.25 330)') || brand.includes('#d946c4') || brand.includes('oklch(0.52 0.22 295)')) return 'Moda'
  if (brand.includes('#0e4f3f') || brand.includes('#0f5132') || brand.includes('oklch(0.42 0.06 120)') || brand.includes('oklch(0.52 0.14 145)')) return 'Doğal'
  if (brand.includes('#f5b800') || brand.includes('#FF5F38') || brand.includes('oklch(0.7 0.21 45)') || brand.includes('#e94e1b')) return 'Enerjik'
  if (p.includes('#efe7d0') || bg.includes('#fdf6e3') || bg.includes('#f5e6dc') || bg.includes('#f5e6d3')) return 'Sıcak'
  if (brand.includes('oklch(0.89 0.18 115)') || brand.includes('#108474') || p.includes('#2b2118')) return 'Minimal'
  if (r.layoutHint === 'full') return 'Öne Çıkan'
  return 'Genel'
}

const NAMES: Record<string, string> = {
  'theme-001': 'Amber Onyx',
  'theme-002': 'Teal Clean',
  'theme-003': 'Desert Ink',
  'theme-004': 'Artisan Honey',
  'theme-014': 'Walnut Cream',
  'theme-021': 'Midnight Neon',
  'theme-027': 'Forest Fresh',
  'theme-035': 'Ink Inverse',
  'theme-039': 'Deep Green',
  'theme-052': 'Pure Dark',
  'theme-069': 'Mono Night',
  'theme-079': 'Graphite Soft',
}

function displayName(id: string, _r: YnsThemeRaw): string {
  if (NAMES[id]) return NAMES[id]
  const n = Number(id.split('-')[1])
  return `Tema ${String(n).padStart(3, '0')}`
}

function sanitizeColor(c: string | null | undefined): string {
  if (!c || c.startsWith('var(')) return '#4f46e5'
  return c
}

export const THEMES: StorefrontTheme[] = (liteRaw as YnsThemeRaw[]).map((r) => {
  const brand = sanitizeColor(r.brand || r.primary)
  const bg = sanitizeColor(r.bg || '#ffffff')
  const fg = sanitizeColor(r.fg || '#1a1a1a')
  const primary = sanitizeColor(r.primary || '#1a1a1a')
  const secondary = sanitizeColor(r.secondary || '#f5f5f5')
  const accent = sanitizeColor(r.accent || brand)
  const border = sanitizeColor(r.border || '#e5e5e5')
  const radius = r.radius || '0.5rem'
  const card = sanitizeColor((r as any).card || bg)
  return {
    id: r.id,
    name: displayName(r.id, r),
    category: guessCategory(r),
    preview: {
      brand,
      background: bg,
      foreground: fg,
      primary,
      secondary,
      accent,
      border,
      radius,
      card,
    },
    fontStack: r.fontStack,
    layoutHint: r.layoutHint,
    raw: r,
  }
})

// Backwards compat aliases — dış marka adları kod içinde kalabilir ama UI'da gösterilmez
export const YNS_THEMES = THEMES
export const RAHATIO_THEMES = THEMES

export const THEME_CATEGORIES = Array.from(new Set(THEMES.map((t) => t.category))).sort()

export function getThemeById(id: string | null | undefined): StorefrontTheme | null {
  if (!id) return null
  return THEMES.find((t) => t.id === id) || null
}

export const THEME_COUNT = THEMES.length
