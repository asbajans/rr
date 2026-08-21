'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'

interface Option {
  id: string | number
  name: string
}

interface Props {
  options: Option[]
  value: string | number | null | undefined
  onChange: (id: string | null, option: Option | null) => void
  placeholder?: string
  disabled?: boolean
  emptyText?: string
}

export default function SearchableMarketplaceSelect({ options, value, onChange, placeholder = 'Ara...', disabled, emptyText = 'Sonuç yok' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = useMemo(() => options.find((o) => String(o.id) === String(value)), [options, value])
  const selectedName = selected?.name ?? ''

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options.slice(0, 200)
    return options.filter((o) => o.name.toLowerCase().includes(q)).slice(0, 200)
  }, [options, query])

  useEffect(() => {
    if (!open) setQuery(selectedName)
  }, [selectedName, open])

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
          disabled={disabled}
          value={open ? query : selectedName}
          onFocus={() => {
            setOpen(true)
            setQuery(selectedName)
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            if (e.target.value === '') onChange(null, null)
          }}
          placeholder={disabled ? placeholder : placeholder}
          className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none disabled:opacity-40"
        />
      </div>
      {open && !disabled && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
          {filtered.length === 0 && <div className="px-3 py-2 text-sm text-zinc-500">{emptyText}</div>}
          {filtered.map((o) => (
            <button
              key={String(o.id)}
              type="button"
              onClick={() => {
                onChange(String(o.id), o)
                setQuery(o.name)
                setOpen(false)
              }}
              className={`block w-full truncate px-3 py-2 text-left text-sm hover:bg-zinc-800 ${String(o.id) === String(value) ? 'bg-zinc-800 text-violet-300' : 'text-white'}`}
            >
              {o.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
