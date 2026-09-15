// Lite preset map for storefront — Rahatio markalı, dış marka yok.
// Generated from yns-registry-final.json -> presets-lite.json
import lite from './presets-lite.json'

export type PresetLite = {
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
}

const MAP: Record<string, PresetLite> = {}
for (const p of lite as PresetLite[]) {
  // sanitize var() fallbacks already resolved in lite generation
  MAP[p.id] = p
}

export function getPresetLite(id: string | null | undefined): PresetLite | null {
  if (!id) return null
  return MAP[id] || null
}

export const PRESET_IDS = Object.keys(MAP)
