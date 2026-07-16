import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { tr } from './locales/tr'
import { en } from './locales/en'
import { ar } from './locales/ar'
import { ru } from './locales/ru'
import { es } from './locales/es'

export type Locale = 'tr' | 'en' | 'ar' | 'ru' | 'es'

const TRANSLATIONS: Record<Locale, Record<string, string>> = { tr, en, ar, ru, es }

export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'ru', label: 'Русский' },
  { code: 'es', label: 'Español' },
]

const STORAGE_KEY = 'app_locale'
const DEFAULT_LOCALE: Locale = 'tr'

type I18nContextType = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v && TRANSLATIONS[v as Locale]) setLocaleState(v as Locale)
    })
  }, [])

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    AsyncStorage.setItem(STORAGE_KEY, l)
  }

  const t = (key: string): string => {
    return TRANSLATIONS[locale][key] ?? TRANSLATIONS[DEFAULT_LOCALE][key] ?? key
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
