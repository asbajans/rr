'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'

interface CategoryOption {
  id: number | string
  name: string
  slug?: string
  isDefault?: boolean
}

interface Props {
  categories: CategoryOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function SearchableCategorySelect({ categories, value, onChange, placeholder = 'Kategori ara...' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) => c.name.toLowerCase().includes(q) || (c.slug || '').toLowerCase().includes(q))
  }, [categories, query])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={open ? query : value}
          onFocus={() => { setOpen(true); setQuery(value) }}
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
          placeholder={placeholder}
          className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-zinc-500">Sonuç yok</div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange(c.name)
                setQuery(c.name)
                setOpen(false)
              }}
              className="block w-full truncate px-3 py-2 text-left text-sm text-white hover:bg-zinc-800"
            >
              {c.name}{c.isDefault ? ' ★' : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}