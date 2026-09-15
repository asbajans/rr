// Rahatio font loader — Google Fonts, dış marka yok
// YNS temalarındaki fontStack'i Google Fonts'a dönüştürür ve <link> enjekte eder.

const GOOGLE_FONT_MAP: Record<string, { family: string; url: string }> = {
  Inter: { family: 'Inter', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' },
  Oswald: { family: 'Oswald', url: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&display=swap' },
  'Playfair Display': { family: 'Playfair Display', url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap' },
  Playfair: { family: 'Playfair Display', url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap' },
  Poppins: { family: 'Poppins', url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap' },
  Montserrat: { family: 'Montserrat', url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap' },
  'Bebas Neue': { family: 'Bebas Neue', url: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap' },
  Bebas: { family: 'Bebas Neue', url: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap' },
  'Source Sans 3': { family: 'Source Sans 3', url: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600&display=swap' },
  Fraunces: { family: 'Fraunces', url: 'https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&display=swap' },
  Josefin: { family: 'Josefin Sans', url: 'https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@400;600&display=swap' },
  Prompt: { family: 'Prompt', url: 'https://fonts.googleapis.com/css2?family=Prompt:wght@400;600&display=swap' },
  Roboto: { family: 'Roboto', url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap' },
  'Open Sans': { family: 'Open Sans', url: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&display=swap' },
  Lora: { family: 'Lora', url: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;600&display=swap' },
  Geist: { family: 'Geist', url: '' }, // Vercel font, fallback to Inter
}

// Normalize fontStack "Oswald,Geist" -> ["Oswald","Geist"]
export function parseFontStack(stack: string | null | undefined): string[] {
  if (!stack) return []
  return stack.split(',').map((s) => s.trim()).filter(Boolean)
}

export function resolveThemeFonts(fontStack: string | null | undefined, overrideFamily: string | null | undefined): { body: string; heading: string; families: string[] } {
  if (overrideFamily && overrideFamily.trim()) {
    // Kullanıcı site-builder'dan font seçtiyse o baskın
    const f = overrideFamily.trim()
    return { body: f, heading: f, families: [f] }
  }
  const parts = parseFontStack(fontStack)
  if (parts.length === 0) return { body: 'Inter', heading: 'Inter', families: ['Inter'] }
  // YNS pattern: first = heading or body depending on theme. Basit kural:
  // - 1 font: hem heading hem body o
  // - 2 font: ilk heading, ikinci body (Geist -> Inter fallback)
  const rawHeading = parts[0] || 'Inter'
  const rawBody = parts[1] || parts[0] || 'Inter'
  const heading = rawHeading === 'Geist' ? 'Inter' : rawHeading
  const body = rawBody === 'Geist' ? 'Inter' : rawBody
  // Map Playfair -> Playfair Display
  const norm = (n: string) => (n === 'Playfair' ? 'Playfair Display' : n)
  return { body: norm(body), heading: norm(heading), families: [norm(heading), norm(body)].filter((v, i, a) => a.indexOf(v) === i) }
}

export function ensureGoogleFonts(families: string[]) {
  if (typeof document === 'undefined') return
  for (const fam of families) {
    const entry = GOOGLE_FONT_MAP[fam]
    if (!entry || !entry.url) continue
    const id = `gf-${fam.replace(/\s+/g, '-').toLowerCase()}`
    if (document.getElementById(id)) continue
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = entry.url
    document.head.appendChild(link)
  }
}

// For site-builder preview: preload both
export function ensureFontsForTheme(fontStack: string | null | undefined, override?: string | null) {
  const { families } = resolveThemeFonts(fontStack, override || null)
  ensureGoogleFonts(families)
}
