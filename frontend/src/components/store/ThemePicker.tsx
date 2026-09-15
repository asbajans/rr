'use client'

import { useMemo, useState, useEffect } from 'react'
import { Search, Check, Palette, X } from 'lucide-react'
import { THEMES, THEME_CATEGORIES, COLOR_FAMILIES, type StorefrontTheme } from '@/themes/catalog'

const PAGE_SIZE = 20

export function ThemePicker({
  value,
  onChange,
  saving,
}: {
  value: string | null | undefined
  onChange: (id: string) => void
  saving?: boolean
}) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('Tümü')
  const [color, setColor] = useState<string>('Tümü')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return THEMES.filter((t) => {
      if (cat !== 'Tümü' && t.category !== cat) return false
      if (color !== 'Tümü' && t.colorFamily !== color) return false
      if (!query) return true
      return (
        t.id.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        t.colorFamily.toLowerCase().includes(query) ||
        t.preview.brand.toLowerCase().includes(query)
      )
    })
  }, [q, cat, color])

  // reset pagination when filters change
  useEffect(() => {
    setVisible(PAGE_SIZE)
  }, [q, cat, color])

  const paged = filtered.slice(0, visible)
  const hasMore = visible < filtered.length
  const activeFilters = (cat !== 'Tümü' ? 1 : 0) + (color !== 'Tümü' ? 1 : 0) + (q.trim() ? 1 : 0)

  // Ensure selected theme is visible even if outside current page/filters
  const selectedTheme = value ? THEMES.find((t) => t.id === value) : null
  const selectedOutside = selectedTheme && !paged.some((t) => t.id === value) && filtered.some((t) => t.id === value)

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-zinc-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-zinc-500" />
            <h3 className="text-sm font-semibold text-zinc-900">Hazır Temalar</h3>
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">{THEMES.length} tema</span>
            <span className="hidden text-xs text-zinc-500 sm:inline">— Rahatio</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="hidden sm:inline">{filtered.length} eşleşti</span>
            {activeFilters > 0 && (
              <button
                onClick={() => { setQ(''); setCat('Tümü'); setColor('Tümü') }}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                <X className="h-3 w-3" /> Filtreleri temizle
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ara: tema-001, amber, koyu..."
              className="w-full rounded-lg border border-zinc-300 pl-8 pr-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600">
              Tür
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm focus:border-zinc-900 focus:outline-none"
              >
                <option>Tümü</option>
                {THEME_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600">
              Renk
              <select
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm focus:border-zinc-900 focus:outline-none"
              >
                <option>Tümü</option>
                {COLOR_FAMILIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* color dots quick filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-500 mr-1">Hızlı renk:</span>
          {COLOR_FAMILIES.map((c) => {
            const active = color === c
            const dotColor =
              c === 'Siyah' ? '#111827' :
              c === 'Beyaz' ? '#ffffff' :
              c === 'Gri' ? '#9ca3af' :
              c === 'Kırmızı' ? '#ef4444' :
              c === 'Turuncu' ? '#f97316' :
              c === 'Sarı' ? '#eab308' :
              c === 'Yeşil' ? '#22c55e' :
              c === 'Turkuaz' ? '#06b6d4' :
              c === 'Mavi' ? '#3b82f6' :
              c === 'Mor' ? '#a855f7' :
              c === 'Pembe' ? '#ec4899' : '#d1d5db'
            return (
              <button
                key={c}
                onClick={() => setColor(active ? 'Tümü' : c)}
                title={c}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'}`}
              >
                <span className="h-3 w-3 rounded-full border" style={{ background: dotColor, borderColor: c === 'Beyaz' ? '#e5e7eb' : dotColor }} />
                {c}
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-4">
        {selectedOutside && selectedTheme && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-800">Seçili temanız filtre dışında — yine de aşağıda gösteriliyor.</p>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              <ThemeCard theme={selectedTheme} selected={value === selectedTheme.id} onSelect={() => onChange(selectedTheme.id)} saving={saving} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {paged.map((t) => (
            <ThemeCard key={t.id} theme={t} selected={value === t.id} onSelect={() => onChange(t.id)} saving={saving} />
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-500">Filtrelerle eşleşen tema bulunamadı. Filtreleri temizlemeyi deneyin.</p>
        )}

        {hasMore && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Daha fazla göster ({filtered.length - visible} kaldı)
            </button>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <span>{paged.length} / {filtered.length} gösteriliyor{filtered.length !== THEMES.length ? ` · toplam ${THEMES.length}` : ''}</span>
          <span>Seçim anında önizlenir — kaydet → <span className="font-medium">Yayınla</span> ile canlıya alınır.</span>
        </div>
      </div>
    </div>
  )
}

function ThemeCard({ theme, selected, onSelect, saving }: { theme: StorefrontTheme; selected: boolean; onSelect: () => void; saving?: boolean }) {
  const p = theme.preview
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!!saving}
      className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition ${
        selected ? 'border-zinc-900 ring-2 ring-zinc-900' : 'border-zinc-200 hover:border-zinc-300 hover:shadow-sm'
      } ${saving ? 'opacity-60' : ''}`}
      title={`${theme.id} — ${theme.name} (${theme.category} · ${theme.colorFamily})`}
    >
      <div className="relative h-20 w-full overflow-hidden" style={{ background: p.background }}>
        <div className="absolute inset-0 flex">
          <div className="w-1/2 p-2">
            <div className="h-3 w-10 rounded" style={{ background: p.brand }} />
            <div className="mt-2 h-2 w-16 rounded" style={{ background: p.foreground, opacity: 0.15 }} />
            <div className="mt-1.5 h-2 w-12 rounded" style={{ background: p.foreground, opacity: 0.08 }} />
          </div>
          <div className="flex w-1/2 flex-col gap-1.5 p-2">
            <div className="h-7 rounded-md border p-1.5" style={{ background: p.card || '#fff', borderColor: p.border, borderRadius: p.radius }}>
              <div className="h-1.5 w-10 rounded" style={{ background: p.brand }} />
            </div>
            <div className="flex gap-1">
              <span className="h-2 w-6 rounded-full" style={{ background: p.primary }} />
              <span className="h-2 w-6 rounded-full" style={{ background: p.secondary, border: `1px solid ${p.border}` }} />
              <span className="h-2 w-6 rounded-full" style={{ background: p.accent }} />
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 flex h-6 items-center gap-1 border-t bg-white/90 px-2 backdrop-blur" style={{ borderColor: p.border }}>
          <span className="h-2 w-8 rounded-full" style={{ background: p.brand }} />
          <span className="ml-auto h-1.5 w-8 rounded-full bg-zinc-200" />
        </div>
        {selected && (
          <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-white shadow">
            <Check className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 bg-white p-2.5">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-zinc-900">{theme.name}</span>
          <span className="truncate text-[10px] text-zinc-500">{theme.id}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">{theme.category}</span>
          <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium" style={{ background: theme.colorFamily === 'Siyah' ? '#111827' : theme.colorFamily === 'Beyaz' ? '#fff' : theme.colorFamily === 'Gri' ? '#f3f4f6' : p.brand, color: ['Siyah','Beyaz','Gri'].includes(theme.colorFamily) ? (theme.colorFamily==='Beyaz'?'#111827':'#fff') : '#fff', borderColor: p.border }}>{theme.colorFamily}</span>
          <span className="text-[10px] text-zinc-400" style={{ fontFamily: theme.fontStack || undefined }}>{theme.fontStack || 'Inter'}</span>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <span className="h-3 w-3 rounded-full border" style={{ background: p.brand, borderColor: p.border }} />
          <span className="h-3 w-3 rounded-full border" style={{ background: p.background, borderColor: p.border }} />
          <span className="h-3 w-3 rounded-full border" style={{ background: p.primary, borderColor: p.border }} />
          <span className="ml-auto text-[10px] text-zinc-400">{p.radius}</span>
        </div>
      </div>
    </button>
  )
}
