'use client'

import { useMemo, useState } from 'react'
import { Search, Check, Palette } from 'lucide-react'
import { YNS_THEMES, THEME_CATEGORIES, type StorefrontTheme } from '@/themes/catalog'

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

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return YNS_THEMES.filter((t) => {
      if (cat !== 'Tümü' && t.category !== cat) return false
      if (!query) return true
      return (
        t.id.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        t.preview.brand.toLowerCase().includes(query)
      )
    })
  }, [q, cat])

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-900">Hazır Temalar</h3>
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">{YNS_THEMES.length} tema</span>
          <span className="hidden text-xs text-zinc-500 sm:inline">— Rahatio markalı, dış marka içermez</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ara: tema-001, koyu, minimal..."
              className="w-56 rounded-lg border border-zinc-300 pl-8 pr-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
            />
          </div>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm focus:border-zinc-900 focus:outline-none"
          >
            <option>Tümü</option>
            {THEME_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((t) => (
            <ThemeCard key={t.id} theme={t} selected={value === t.id} onSelect={() => onChange(t.id)} saving={saving} />
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-500">Aramayla eşleşen tema bulunamadı.</p>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          Seçim anında önizlenir. Kaydetmediğiniz sürece mağaza yayındaki temanız değişmez — kaydettiğinizde <span className="font-medium">Site Yayını → Yayınla</span> ile canlıya alınır.
        </p>
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
      title={`${theme.id} — ${theme.name} (${theme.category})`}
    >
      {/* Preview header: brand + bg */}
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
        {/* nav mock */}
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
        <div className="flex items-center gap-1">
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">{theme.category}</span>
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
