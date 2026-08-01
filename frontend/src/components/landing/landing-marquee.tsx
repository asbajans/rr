'use client'

import type { LandingContent } from '@/lib/landing-content'

export function LandingMarquee({ t }: { t: LandingContent }) {
  return (
    <div className="relative mx-auto max-w-6xl px-5 pb-14">
      <div className="relative space-y-3 overflow-hidden py-2">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent"></div>
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent"></div>

        <div className="flex w-max animate-marquee gap-3">
          {[...t.marquee[0], ...t.marquee[0]].map((item, i) => (
            <span
              key={`a-${i}`}
              className="whitespace-nowrap rounded-full border border-border bg-card/70 px-4 py-2 text-sm text-muted-foreground"
            >
              “{item}”
            </span>
          ))}
        </div>

        <div className="flex w-max animate-marquee-rev gap-3">
          {[...t.marquee[1], ...t.marquee[1]].map((item, i) => (
            <span
              key={`b-${i}`}
              className="whitespace-nowrap rounded-full border border-border bg-card/70 px-4 py-2 text-sm text-muted-foreground"
            >
              “{item}”
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
