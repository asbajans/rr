'use client'

import Link from 'next/link'
import type { StoreHomepage } from '@/lib/types'

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/)
  return m ? m[1] : null
}

export default function StoreHero({ homepage, siteCode }: { homepage: StoreHomepage | null | undefined; siteCode: string }) {
  if (!homepage || homepage.enabled === false) return null

  const heading = homepage.heading || ''
  const subtitle = homepage.subtitle || ''
  const buttonText = homepage.button_text || ''
  const buttonUrl = homepage.button_url || `#`
  const minHeight = homepage.min_height || 'min-h-[420px]'
  const overlay = typeof homepage.overlay_opacity === 'number' ? homepage.overlay_opacity : 40

  const overlayStyle = {
    backgroundImage: `linear-gradient(rgba(0,0,0,${overlay / 100}), rgba(0,0,0,${overlay / 100}))`,
  }

  return (
    <section className="relative w-full overflow-hidden bg-zinc-950">
      {homepage.type === 'youtube' && youtubeId(homepage.youtube_url || '') ? (
        <div className="relative flex flex-col items-center justify-center px-4 py-12 text-center">
          <div className="mb-6 aspect-video w-full max-w-4xl overflow-hidden rounded-2xl shadow-2xl">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId(homepage.youtube_url || '')}`}
              title={heading || 'Tanıtım videosu'}
              className="h-full w-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          {heading && <h1 className="max-w-3xl text-3xl font-bold text-white sm:text-5xl">{heading}</h1>}
          {subtitle && <p className="mt-4 max-w-2xl text-base text-zinc-300 sm:text-lg">{subtitle}</p>}
          {buttonText && (
            <Link href={buttonUrl} className="sf-btn-primary mt-6 rounded-xl px-8 py-3 text-sm font-semibold text-white shadow-lg">
              {buttonText}
            </Link>
          )}
        </div>
      ) : homepage.image_url ? (
        <div className={`relative flex flex-col items-center justify-center px-4 py-16 text-center ${minHeight}`} style={overlayStyle}>
          <img src={homepage.image_url} alt={heading || 'Mağaza'} className="absolute inset-0 h-full w-full object-cover" />
          <div className="relative z-10 max-w-3xl">
            {heading && <h1 className="text-3xl font-bold text-white sm:text-5xl">{heading}</h1>}
            {subtitle && <p className="mt-4 text-base text-zinc-200 sm:text-lg">{subtitle}</p>}
            {buttonText && (
              <Link href={buttonUrl} className="sf-btn-primary mt-6 inline-block rounded-xl px-8 py-3 text-sm font-semibold text-white shadow-lg">
                {buttonText}
              </Link>
            )}
          </div>
        </div>
      ) : heading || subtitle || buttonText ? (
        <div className={`flex flex-col items-center justify-center px-4 py-16 text-center ${minHeight}`}>
          {heading && <h1 className="max-w-3xl text-3xl font-bold text-zinc-900 sm:text-5xl">{heading}</h1>}
          {subtitle && <p className="mt-4 max-w-2xl text-base text-zinc-600 sm:text-lg">{subtitle}</p>}
          {buttonText && (
            <Link href={buttonUrl} className="sf-btn-primary mt-6 rounded-xl px-8 py-3 text-sm font-semibold text-white shadow-lg">
              {buttonText}
            </Link>
          )}
        </div>
      ) : null}
    </section>
  )
}