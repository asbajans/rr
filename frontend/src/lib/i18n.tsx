'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { tr } from './locales/tr'
import { en } from './locales/en'
import { ar } from './locales/ar'
import { ru } from './locales/ru'
import { es } from './locales/es'

export const LOCALES = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'ru', label: 'Русский' },
  { code: 'es', label: 'Español' },
]

const DICTIONARIES: Record<string, Record<string, string>> = { tr, en, ar, ru, es }
export const DEFAULT_LOCALE = 'tr'

const STORAGE_KEY = 'app_locale'

interface I18nContextValue {
  locale: string
  setLocale: (locale: string) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
})

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<string>(DEFAULT_LOCALE)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved && DICTIONARIES[saved]) setLocaleState(saved)
  }, [])

  const setLocale = useCallback((next: string) => {
    if (!DICTIONARIES[next]) return
    setLocaleState(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next)
    }
  }, [])

  const t = useCallback(
    (key: string) => {
      const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE]
      return dict[key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key
    },
    [locale],
  )

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

export function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const { locale, setLocale } = useI18n()
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value)}
      className={`rounded-lg border px-2 py-1 text-xs font-medium focus:outline-none ${
        dark
          ? 'border-zinc-700 bg-zinc-800 text-zinc-300'
          : 'border-zinc-200 bg-white text-zinc-600'
      }`}
      aria-label="Language"
    >
      {LOCALES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  )
}
