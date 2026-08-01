'use client'

import { useState, type ComponentType } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  ArrowRight,
  Bot,
  Earth,
  ShoppingBag,
  Handshake,
  Truck,
  ChartLine,
  Boxes,
  PackageCheck,
  ShieldCheck,
  Camera,
  ScrollText,
  Store,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { LANDING_CONTENT, LANDING_LANGS, type Lang, type LandingContent } from '@/lib/landing-content'
import { LandingAiDemo } from '@/components/landing/landing-ai-demo'
import { LandingMarquee } from '@/components/landing/landing-marquee'

type IconProps = { className?: string }
const ICONS: Record<string, ComponentType<IconProps>> = {
  bot: Bot,
  earth: Earth,
  'shopping-bag': ShoppingBag,
  handshake: Handshake,
  truck: Truck,
  'chart-line': ChartLine,
  boxes: Boxes,
  'package-check': PackageCheck,
  'shield-check': ShieldCheck,
  camera: Camera,
  'scroll-text': ScrollText,
  store: Store,
}

const HERO_BUTTON =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-gradient-to-r from-primary to-primary-glow px-8 text-sm font-medium text-primary-foreground shadow-glow transition-all hover:opacity-90'
const OUTLINE_BUTTON =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-border bg-card/60 text-foreground backdrop-blur transition-all hover:border-primary/60 hover:text-primary'

function LangSwitcher({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex items-center rounded-full border border-border bg-card/70 p-0.5">
      {LANDING_LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
            lang === l.code ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}

function Header({ t, lang, setLang }: { t: LandingContent; lang: Lang; setLang: (l: Lang) => void }) {
  const { user, loading } = useAuth()
  const nav = [
    { label: t.nav.how, href: '#how' },
    { label: t.nav.marketplaces, href: '#marketplaces' },
    { label: t.nav.solutions, href: '#solutions' },
    { label: t.nav.pricing, href: '#pricing' },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.jpeg" alt="Rahatio logo" className="h-9 w-9 rounded-lg object-cover" width={36} height={36} />
          <span className="font-display text-lg font-bold tracking-tight">Rahatio</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LangSwitcher lang={lang} setLang={setLang} />
          {loading ? null : user ? (
            <Link
              href={user.is_admin ? '/stores' : '/dashboard'}
              className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-gradient-to-r from-primary to-primary-glow px-3 text-xs font-medium text-primary-foreground shadow-glow transition-all hover:opacity-90"
            >
              {t.cta.panel}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden h-8 items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:inline-flex"
              >
                {t.cta.signIn}
              </Link>
              <Link
                href="/register"
                className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-gradient-to-r from-primary to-primary-glow px-3 text-xs font-medium text-primary-foreground shadow-glow transition-all hover:opacity-90"
              >
                {t.cta.startFree}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function Hero({ t }: { t: LandingContent }) {
  return (
    <section className="relative overflow-hidden bg-hero-glow">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-[0.35]"></div>
      <div className="relative mx-auto grid max-w-6xl gap-14 px-5 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> {t.hero.badge}
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
            {t.hero.title1}
            <br />
            <span className="text-gradient">{t.hero.title2}</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">{t.hero.body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className={`${HERO_BUTTON} h-10`}>
              {t.cta.startTrial}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="#demo" className={`${OUTLINE_BUTTON} h-10`}>
              {t.cta.watch}
            </Link>
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {t.stats.map((s) => (
              <div key={s.label}>
                <dt className="font-display text-2xl font-bold text-foreground">{s.value}</dt>
                <dd className="text-xs text-muted-foreground">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div id="demo" className="scroll-mt-24">
          <LandingAiDemo t={t} />
        </div>
      </div>
    </section>
  )
}

function HowSection({ t }: { t: LandingContent }) {
  const icons = [Camera, Sparkles, ScrollText, Store]
  return (
    <section id="how" className="scroll-mt-16 border-y border-border/60 bg-surface/40 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">{t.how.heading}</h2>
        <p className="mt-3 max-w-xl text-muted-foreground">{t.how.body}</p>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {t.how.steps.map((step, i) => {
            const Icon = icons[i]
            return (
              <div
                key={step.title}
                className="group relative rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:border-primary/50"
              >
                <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                <Icon className="mt-3 h-6 w-6 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function FeaturesSection({ t }: { t: LandingContent }) {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">{t.features.heading}</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {t.features.items.map((item) => {
            const Icon = ICONS[item.icon] ?? Sparkles
            return (
              <div
                key={item.title}
                className="rounded-2xl border border-border bg-card/70 p-6 transition-all hover:border-primary/50 hover:shadow-glow"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function MarketsSection({ t }: { t: LandingContent }) {
  return (
    <section id="marketplaces" className="scroll-mt-16 border-y border-border/60 bg-surface/40 py-20">
      <div className="mx-auto max-w-6xl px-5 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">{t.markets.heading}</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{t.markets.body}</p>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-7">
          {t.markets.names.map((name) => (
            <div
              key={name}
              className="rounded-xl border border-border bg-card px-3 py-4 text-sm font-semibold text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SolutionsSection({ t }: { t: LandingContent }) {
  return (
    <section id="solutions" className="scroll-mt-16 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid gap-4 lg:grid-cols-3">
          {t.solutions.map((s) => {
            const Icon = ICONS[s.icon] ?? Sparkles
            return (
              <div key={s.tag} className="flex flex-col rounded-2xl border border-border bg-card p-7 shadow-card">
                <span className="w-fit rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
                  {s.tag}
                </span>
                <Icon className="mt-5 h-6 w-6 text-primary" />
                <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function PricingSection({ t }: { t: LandingContent }) {
  const { user } = useAuth()
  return (
    <section id="pricing" className="scroll-mt-16 border-y border-border/60 bg-surface/40 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">{t.pricing.heading}</h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">{t.pricing.body}</p>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {t.pricing.plans.map((plan, i) => {
            const isPopular = i === 1
            const showPerMonth = /\d/.test(plan.price)
            const href =
              plan.cta === 'startFree' ? (user ? '/billing' : '/register') : 'mailto:hello@rahatio.com.tr'
            return (
              <div
                key={plan.name}
                className={`flex flex-col rounded-2xl border p-7 ${
                  isPopular ? 'border-primary/60 bg-card shadow-glow lg:-translate-y-3' : 'border-border bg-card/60'
                }`}
              >
                {isPopular && (
                  <span className="w-fit rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary">
                    {t.pricing.popular}
                  </span>
                )}
                <h3 className="mt-3 text-lg font-semibold">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.body}</p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="font-display text-4xl font-bold">{plan.price}</span>
                  {showPerMonth && <span className="pb-1 text-sm text-muted-foreground">{t.pricing.perMonth}</span>}
                </div>
                <ul className="mt-6 flex-1 space-y-2 text-sm text-muted-foreground">
                  {plan.points.map((p) => (
                    <li key={p} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                      {p}
                    </li>
                  ))}
                </ul>
                <Link
                  href={href}
                  className={`${isPopular ? HERO_BUTTON : OUTLINE_BUTTON} mt-7 h-10 w-full`}
                >
                  {plan.cta === 'startFree' ? t.cta.startFree : t.cta.talkSales}
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function FinalCta({ t }: { t: LandingContent }) {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="pointer-events-none absolute inset-0 bg-hero-glow"></div>
      <div className="relative mx-auto max-w-3xl px-5 text-center">
        <h2 className="text-3xl font-bold sm:text-5xl">
          {t.final.title1} <span className="text-gradient">{t.final.title2}</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{t.final.body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/register" className={`${HERO_BUTTON} h-10`}>
            {t.cta.startTrial}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/register" className={`${OUTLINE_BUTTON} h-10`}>
            {t.cta.demo}
          </Link>
        </div>
      </div>
    </section>
  )
}

function Footer({ t }: { t: LandingContent }) {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <img src="/logo.jpeg" alt="Rahatio logo" className="h-7 w-7 rounded-md object-cover" width={28} height={28} />
          <span className="font-display font-semibold text-foreground">Rahatio</span>
        </div>
        <p>
          © {new Date().getFullYear()} {t.footer}
        </p>
      </div>
    </footer>
  )
}

export function LandingPage() {
  const [lang, setLang] = useState<Lang>('en')
  const t = LANDING_CONTENT[lang]

  return (
    <div className="landing min-h-screen bg-background">
      <Header t={t} lang={lang} setLang={setLang} />
      <main>
        <Hero t={t} />
        <LandingMarquee t={t} />
        <HowSection t={t} />
        <FeaturesSection t={t} />
        <MarketsSection t={t} />
        <SolutionsSection t={t} />
        <PricingSection t={t} />
        <FinalCta t={t} />
      </main>
      <Footer t={t} />
    </div>
  )
}
