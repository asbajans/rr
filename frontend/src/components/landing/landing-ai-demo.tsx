'use client'

import { useEffect, useState } from 'react'
import { Camera, Sparkles, Tags, Store, MonitorSmartphone } from 'lucide-react'
import type { LandingContent } from '@/lib/landing-content'

const STEP_ICONS = [Camera, Sparkles, Tags, Store]

const MARKETPLACE_CHIPS: { name: string; tone: 'primary' | 'accent' }[] = [
  { name: 'Amazon', tone: 'primary' },
  { name: 'Trendyol', tone: 'accent' },
  { name: 'N11', tone: 'primary' },
  { name: 'Pazarama', tone: 'accent' },
  { name: 'eBay', tone: 'primary' },
  { name: 'Etsy', tone: 'accent' },
]

export function LandingAiDemo({ t }: { t: LandingContent }) {
  const steps = t.scan.steps
  const [n, setN] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setN((v) => (v + 1) % steps.length), 2600)
    return () => clearInterval(id)
  }, [steps.length])

  const done = n === steps.length - 1

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="pointer-events-none absolute -inset-10 rounded-full bg-primary/10 blur-3xl"></div>

      <div className="relative grid gap-5">
        {/* Phone mockup */}
        <div className="relative mx-auto w-[264px] animate-float rounded-[2.4rem] border border-border bg-card p-3 shadow-glow">
          <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-muted"></div>
          <div className="relative aspect-[9/16] overflow-hidden rounded-[1.7rem] bg-secondary grid-lines">
            {/* Product render */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="absolute -inset-8 rounded-full bg-primary/20 blur-2xl"></div>
                <div className="relative h-32 w-32 rotate-6 rounded-2xl bg-gradient-to-br from-accent/80 to-primary/70 shadow-card"></div>
                <div className="absolute -bottom-3 left-1/2 h-4 w-28 -translate-x-1/2 rounded-full bg-background/60 blur-md"></div>
              </div>
            </div>

            {/* Focus frame */}
            <div className="absolute inset-6 rounded-xl border border-primary/50">
              <span className="absolute -left-px -top-px h-6 w-6 rounded-tl-xl border-l-2 border-t-2 border-primary"></span>
              <span className="absolute -right-px -top-px h-6 w-6 rounded-tr-xl border-r-2 border-t-2 border-primary"></span>
              <span className="absolute -bottom-px -left-px h-6 w-6 rounded-bl-xl border-b-2 border-l-2 border-primary"></span>
              <span className="absolute -bottom-px -right-px h-6 w-6 rounded-br-xl border-b-2 border-r-2 border-primary"></span>
            </div>

            {/* Scanline */}
            <div className="absolute inset-x-0 top-[4%] h-px animate-scanline bg-gradient-to-r from-transparent via-primary to-transparent"></div>

            {/* Detection chips */}
            <div className="absolute left-3 top-3 flex flex-col gap-1.5">
              {t.scan.chips.map((chip, i) => (
                <span
                  key={chip}
                  className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-medium text-primary backdrop-blur"
                  style={{ animation: `fade-in 0.4s ease ${i * 0.15}s both` }}
                >
                  {chip}
                </span>
              ))}
            </div>

            {/* Live badge */}
            {done && (
              <div className="absolute inset-x-3 bottom-3 rounded-xl border border-primary/40 bg-background/85 p-3 backdrop-blur">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <MonitorSmartphone className="h-4 w-4" /> {t.scan.live}
                </div>
              </div>
            )}

            {/* Capture button */}
            {n === 0 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/50"></span>
                <span className="relative block h-11 w-11 rounded-full border-4 border-primary bg-background/70"></span>
              </div>
            )}
          </div>
        </div>

        {/* Progress card */}
        <div className="rounded-2xl border border-border bg-card/70 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            {steps.map((step, i) => {
              const Icon = STEP_ICONS[i]
              return (
                <div
                  key={step.label}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all duration-500 ${
                    i === n
                      ? 'border-primary bg-primary/15 text-primary'
                      : i < n
                        ? 'border-border bg-secondary text-muted-foreground'
                        : 'border-border text-muted-foreground/70'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {step.label}
                </div>
              )
            })}
          </div>

          <p className="mt-3 text-sm text-muted-foreground">{steps[n].caption}</p>

          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-700"
              style={{ width: `${((n + 1) / steps.length) * 100}%` }}
            ></div>
          </div>

          {/* Terminal log */}
          <div className="relative mt-4 h-24 overflow-hidden rounded-xl border border-border bg-background/60 p-3">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-background to-transparent"></div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-background to-transparent"></div>
            <div className="animate-ticker-y">
              <ul className="space-y-1.5 font-mono text-[11px] text-muted-foreground">
                {[...t.scan.prompts, ...t.scan.prompts].map((prompt, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary">›</span>
                    {prompt}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Marketplace chips */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {MARKETPLACE_CHIPS.map((c, i) => (
              <div
                key={c.name}
                className={`rounded-lg border px-2 py-2 text-center text-[11px] font-semibold transition-all duration-500 ${
                  done
                    ? c.tone === 'primary'
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-accent/50 bg-accent/10 text-accent'
                    : 'border-border bg-secondary/50 text-muted-foreground/60'
                }`}
                style={{ transitionDelay: `${i * 70}ms` }}
              >
                {c.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
