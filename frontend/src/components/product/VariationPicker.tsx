'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import type { Variation } from '@/lib/types'

export type VariationSelection = Record<string, string[]>

interface Props {
  value: VariationSelection
  onChange: (next: VariationSelection) => void
  dark?: boolean
}

export default function VariationPicker({ value, onChange, dark }: Props) {
  const [variations, setVariations] = useState<Variation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .getVariations()
      .then((res) => {
        if (!cancelled) setVariations(res ?? [])
      })
      .catch((e: any) => {
        if (!cancelled) setLoadError(e?.message || 'Varyasyonlar yüklenemedi')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function toggleVariation(name: string) {
    if (value[name]) {
      const next = { ...value }
      delete next[name]
      onChange(next)
    } else {
      onChange({ ...value, [name]: [] })
    }
  }

  function toggleOption(name: string, option: string) {
    const current = value[name] ?? []
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option]
    onChange({ ...value, [name]: next })
  }

  const selectedCount = Object.keys(value).length
  const comboCount = Object.values(value).reduce((acc, opts) => acc * Math.max(opts.length, 1), 1)
  const hasEmpty = Object.values(value).some((opts) => opts.length === 0)

  if (loading) return <p className={`text-xs ${dark ? 'text-zinc-500' : 'text-gray-400'}`}>Varyasyonlar yükleniyor…</p>
  if (loadError) return <p className="text-xs text-red-600">{loadError}</p>
  if (variations.length === 0) {
    return (
      <p className={`text-xs ${dark ? 'text-zinc-400' : 'text-gray-500'}`}>
        Henüz varyasyon tanımı yok.{' '}
        <Link href="/variations" className="text-indigo-600 hover:underline">
          Varyasyonlar sayfasından
        </Link>{' '}
        önce varyasyon + seçenek ekleyin.
      </p>
    )
  }

  const boxCls = dark ? 'border-zinc-700 bg-zinc-800/60' : 'border-gray-200 bg-white'
  const nameCls = dark ? 'text-zinc-300' : 'text-gray-700'
  const hintCls = dark ? 'text-zinc-500' : 'text-gray-500'
  const chipOff = dark
    ? 'bg-zinc-800 text-zinc-300 border-zinc-600'
    : 'bg-white text-gray-600 border-gray-300'
  const optOff = dark
    ? 'bg-zinc-800 text-zinc-300 border-zinc-600'
    : 'bg-zinc-50 text-zinc-600 border-zinc-300'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {variations.map((v) => {
          const active = !!value[v.name]
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => toggleVariation(v.name)}
              className={`px-2.5 py-1 rounded-full text-xs border ${
                active ? 'bg-indigo-600 text-white border-indigo-600' : chipOff
              }`}
              title={`${v.options?.length ?? 0} seçenek`}
            >
              {v.name}
            </button>
          )
        })}
      </div>

      {Object.keys(value).map((name) => {
        const def = variations.find((v) => v.name === name)
        const opts = def?.options ?? []
        return (
          <div key={name} className={`border rounded p-2 ${boxCls}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-xs font-medium ${nameCls}`}>{name}</span>
              <button
                type="button"
                onClick={() => toggleVariation(name)}
                className="text-[11px] text-red-600 hover:underline"
              >
                Kaldır
              </button>
            </div>
            {opts.length === 0 ? (
              <p className="text-[11px] text-amber-600">
                Bu varyasyonun seçeneği yok —{' '}
                <Link href="/variations" className="underline">
                  Varyasyonlar sayfasında
                </Link>{' '}
                seçenek ekleyin.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {opts.map((o) => {
                  const on = (value[name] ?? []).includes(o.value)
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggleOption(name, o.value)}
                      className={`px-2.5 py-1 rounded-full text-xs border ${
                        on ? 'bg-zinc-900 text-white border-zinc-900' : optOff
                      }`}
                    >
                      {o.value}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {selectedCount > 0 && (
        <p className={`text-[11px] ${hintCls}`}>
          {selectedCount} varyasyon seçili
          {hasEmpty ? (
            <span className="text-amber-600"> — seçenek seçilmemiş varyasyon var, kombinasyon üretilmez.</span>
          ) : (
            <span> — {comboCount} kombinasyon otomatik üretilecek (SKU + stok + fiyat üründen alınır).</span>
          )}
        </p>
      )}
    </div>
  )
}
