'use client'

import { useEffect } from 'react'
import { ShoppingCart, Search, Star } from 'lucide-react'
import { getThemeById } from '@/themes/catalog'
import { buildThemeCss, resolveThemeTokens } from '@/themes/apply'
import { ensureFontsForTheme } from '@/themes/fonts'
import type { StoreTheme, StoreHomepage } from '@/lib/types'

export function ThemeLivePreview({ theme, homepage, storeName }: { theme: StoreTheme; homepage: StoreHomepage | null | undefined; storeName: string }) {
  const preset = getThemeById((theme as any).templateId || (theme as any).template_id || null)
  const tokens = (() => {
    try { return resolveThemeTokens(preset, theme) } catch { return null }
  })()
  const css = tokens ? buildThemeCss(tokens, preset?.id || null) : null

  useEffect(() => {
    ensureFontsForTheme(preset?.fontStack || null, theme.font_family || null)
  }, [preset?.fontStack, theme.font_family])

  if (!tokens || !css) return null

  const heading = homepage?.heading || storeName || 'Mağazam'
  const subtitle = homepage?.subtitle || 'Özenle seçilmiş ürünler — hızlı kargo, güvenli ödeme'
  const buttonText = homepage?.button_text || 'Alışverişe Başla'

  return (
    <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2">
        <span className="text-xs font-medium text-zinc-600">Canlı Önizleme — {preset ? `${preset.id} · ${preset.name}` : 'Varsayılan'} · Rahatio</span>
        <span className="text-[11px] text-zinc-400">Kaydetmeden önce görünümü kontrol et</span>
      </div>
      {/* Scoped style */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div data-storefront className="min-h-[520px] bg-white">
        {/* Mock header */}
        <header className="flex h-14 items-center justify-between border-b px-4" style={{ borderColor: tokens.border, background: tokens.bg }}>
          <div className="flex items-center gap-2">
            {theme.logo_url ? (
              <img src={theme.logo_url} alt={storeName} className="h-7 w-auto object-contain" />
            ) : (
              <span className="sf-heading text-sm font-bold tracking-tight" style={{ color: tokens.fg }}>{storeName || 'Rahatio Mağaza'}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs sm:inline" style={{ color: tokens.fg, opacity: 0.6 }}>Blog</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: tokens.border, background: tokens.card }}>
              <Search className="h-4 w-4" style={{ color: tokens.fg }} />
            </span>
            <span className="flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium text-white sf-btn-primary">
              <ShoppingCart className="h-3.5 w-3.5" /> Sepet
            </span>
          </div>
        </header>

        {/* Hero */}
        {homepage?.enabled !== false ? (
          homepage?.type === 'youtube' && homepage?.youtube_url ? (
            <div className="flex flex-col items-center px-4 py-8 text-center" style={{ background: tokens.bg }}>
              <div className="w-full max-w-2xl overflow-hidden rounded-2xl border bg-zinc-900" style={{ borderColor: tokens.border, borderRadius: tokens.radius }}>
                <div className="aspect-video bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">YouTube: {homepage.youtube_url.slice(0, 32)}…</div>
              </div>
              <h1 className="sf-heading mt-4 text-2xl font-bold" style={{ color: tokens.fg }}>{heading}</h1>
              <p className="mt-2 text-sm" style={{ color: tokens.fg, opacity: 0.7 }}>{subtitle}</p>
              {buttonText && <span className="sf-btn-primary mt-4 inline-flex rounded-full px-6 py-2 text-xs font-semibold text-white">{buttonText}</span>}
            </div>
          ) : homepage?.image_url ? (
            <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden px-4 py-10 text-center" style={{ borderRadius: 0 }}>
              <img src={homepage.image_url} alt={heading} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${(homepage.overlay_opacity ?? 40) / 100})` }} />
              <div className="relative max-w-xl">
                <h1 className="sf-heading text-2xl font-bold text-white sm:text-3xl">{heading}</h1>
                <p className="mt-2 text-sm text-white/80">{subtitle}</p>
                {buttonText && <span className="sf-btn-primary mt-4 inline-block rounded-full px-6 py-2 text-xs font-semibold text-white">{buttonText}</span>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center px-4 py-10 text-center" style={{ background: tokens.bg }}>
              <h1 className="sf-heading text-2xl font-bold" style={{ color: tokens.fg }}>{heading}</h1>
              <p className="mt-2 text-sm" style={{ color: tokens.fg, opacity: 0.7 }}>{subtitle}</p>
              {buttonText && <span className="sf-btn-primary mt-4 inline-flex rounded-full px-6 py-2 text-xs font-semibold text-white">{buttonText}</span>}
            </div>
          )
        ) : (
          <div className="border-b px-4 py-3 text-xs" style={{ borderColor: tokens.border, color: tokens.fg, opacity: 0.5, background: tokens.bg }}>Hero gizli</div>
        )}

        {/* Search mock */}
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center gap-2 rounded-full border px-3 py-2" style={{ borderColor: tokens.border, background: tokens.card, borderRadius: tokens.radius }}>
            <Search className="h-4 w-4" style={{ color: tokens.fg, opacity: 0.4 }} />
            <span className="text-xs" style={{ color: tokens.fg, opacity: 0.5 }}>Ürün ara...</span>
            <span className="ml-auto rounded-full px-3 py-1 text-[11px] font-medium text-white sf-btn-primary">Ara</span>
          </div>
        </div>

        {/* Product grid mock */}
        <div className="mx-auto max-w-5xl px-4 pb-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="sf-heading text-sm font-semibold" style={{ color: tokens.fg }}>{storeName || 'Öne Çıkan Ürünler'}</h2>
            <span className="text-[11px]" style={{ color: tokens.fg, opacity: 0.5 }}>12 ürün</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="sf-card group overflow-hidden border p-2 transition hover:shadow-sm" style={{ borderColor: tokens.border, background: tokens.card, borderRadius: tokens.radius }}>
                <div className="aspect-square overflow-hidden bg-zinc-100" style={{ borderRadius: tokens.radius, background: tokens.muted }}>
                  <div className="flex h-full items-center justify-center text-[10px]" style={{ color: tokens.fg, opacity: 0.3 }}>Görsel {i}</div>
                </div>
                <h3 className="mt-2 truncate text-xs font-medium" style={{ color: tokens.fg }}>Örnek Ürün {i}</h3>
                <p className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: tokens.fg, opacity: 0.6 }}>
                  <Star className="h-3 w-3" style={{ color: tokens.brand }} /> 4.{8 - i} · 12 yorum
                </p>
                <p className="mt-1 text-xs font-semibold" style={{ color: tokens.brand }}>1.299,00 TRY</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <span className="rounded-full border px-4 py-1.5 text-xs" style={{ borderColor: tokens.border, color: tokens.fg, opacity: 0.7 }}>Daha fazla yükle</span>
          </div>
        </div>

        <footer className="border-t px-4 py-4 text-center text-[11px]" style={{ borderColor: tokens.border, background: tokens.card, color: tokens.fg, opacity: 0.6 }}>
          © {new Date().getFullYear()} {storeName || 'Rahatio'} — Tüm hakları saklıdır · <span style={{ color: tokens.brand }}>rahatio.com.tr</span>
        </footer>
      </div>
    </div>
  )
}
