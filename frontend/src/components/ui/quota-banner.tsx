'use client'
import Link from 'next/link'
import { AlertTriangle, Coins, Package, ArrowUpRight, X } from 'lucide-react'
import type { QuotaStatus } from '@/lib/types'

function severityClasses(sev: string) {
  if (sev === 'exhausted') return 'border-red-300 bg-red-50 text-red-800'
  if (sev === 'critical') return 'border-amber-300 bg-amber-50 text-amber-800'
  if (sev === 'warning') return 'border-amber-200 bg-amber-50/70 text-amber-800'
  return 'hidden'
}

export default function QuotaBanner({ quota, onDismiss }: { quota: QuotaStatus | null | undefined; onDismiss?: () => void }) {
  if (!quota) return null
  const items: Array<{ key: string; kind: 'product' | 'credits' | 'marketplace'; severity: string; title: string; body: string; cta: { label: string; href: string } }> = []

  const p = quota.product
  if (p.severity !== 'ok') {
    if (p.severity === 'exhausted') {
      items.push({
        key: 'product-exhausted',
        kind: 'product',
        severity: p.severity,
        title: 'Ürün limitiniz doldu',
        body: `Yeni ürün ekleyemezsiniz (${p.current}/${p.limit}). Limit dolduğu için ekleme engellendi.`,
        cta: { label: 'Planı Yükselt', href: '/billing?reason=product_limit#plans' },
      })
    } else if (p.severity === 'critical') {
      items.push({
        key: 'product-critical',
        kind: 'product',
        severity: p.severity,
        title: 'Ürün limitiniz dolmak üzere',
        body: `%${p.percentUsed} dolu (${p.current}/${p.limit}). Yakında yeni ürün ekleyemezsiniz.`,
        cta: { label: 'Planı Yükselt', href: '/billing?reason=product_limit#plans' },
      })
    } else {
      items.push({
        key: 'product-warning',
        kind: 'product',
        severity: p.severity,
        title: 'Ürün limitine yaklaşıyorsunuz',
        body: `%${p.percentUsed} dolu (${p.current}/${p.limit}). Planınızı gözden geçirin.`,
        cta: { label: 'Planları Gör', href: '/billing?reason=product_limit#plans' },
      })
    }
  }

  const mp = (quota as any).marketplace as QuotaStatus['marketplace'] | undefined
  if (mp && mp.severity !== 'ok' && mp.limit > 0) {
    if (mp.severity === 'exhausted') {
      items.push({
        key: 'marketplace-exhausted',
        kind: 'marketplace',
        severity: mp.severity,
        title: 'Pazaryeri limitiniz doldu',
        body: `Yeni pazaryeri bağlayamazsınız (${mp.current}/${mp.limit}). Kendi Siteniz bu limite dahil değildir.`,
        cta: { label: 'Planı Yükselt', href: '/billing?reason=product_limit#plans' },
      })
    } else if (mp.severity === 'critical') {
      items.push({
        key: 'marketplace-critical',
        kind: 'marketplace',
        severity: mp.severity,
        title: 'Pazaryeri limitiniz dolmak üzere',
        body: `%${mp.percentUsed} dolu (${mp.current}/${mp.limit}). Yakında yeni entegrasyon ekleyemezsiniz.`,
        cta: { label: 'Planı Yükselt', href: '/billing?reason=product_limit#plans' },
      })
    } else {
      items.push({
        key: 'marketplace-warning',
        kind: 'marketplace',
        severity: mp.severity,
        title: 'Pazaryeri limitine yaklaşıyorsunuz',
        body: `%${mp.percentUsed} dolu (${mp.current}/${mp.limit}).`,
        cta: { label: 'Planları Gör', href: '/billing?reason=product_limit#plans' },
      })
    }
  }

  const c = quota.credits
  if (c.severity !== 'ok') {
    if (c.severity === 'exhausted') {
      items.push({
        key: 'credits-exhausted',
        kind: 'credits',
        severity: c.severity,
        title: 'AI krediniz bitti',
        body: `AI özellikleri durdu (${c.remaining}/${c.allowance}). Kredi alın veya üst pakete geçin.`,
        cta: { label: 'Kredi Al', href: '/billing?reason=credits#credits' },
      })
    } else if (c.severity === 'critical') {
      items.push({
        key: 'credits-critical',
        kind: 'credits',
        severity: c.severity,
        title: 'AI krediniz kritik',
        body: `${c.remaining} kredi kaldı (%${c.percentRemaining} kalan). Yakında AI duracak.`,
        cta: { label: 'Kredi Al', href: '/billing?reason=credits#credits' },
      })
    } else {
      items.push({
        key: 'credits-warning',
        kind: 'credits',
        severity: c.severity,
        title: 'AI krediniz azalıyor',
        body: `${c.remaining}/${c.allowance} kaldı (%${c.percentRemaining} kalan).`,
        cta: { label: 'Kredi Al', href: '/billing?reason=credits#credits' },
      })
    }
  }

  if (items.length === 0) return null

  // Show most severe first: exhausted > critical > warning, product before credits if tie
  const order: Record<string, number> = { exhausted: 0, critical: 1, warning: 2 }
  items.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))

  return (
    <div className="space-y-2">
      {items.map((it) => {
        const Icon = it.kind === 'product' ? Package : it.kind === 'marketplace' ? Package : Coins
        return (
          <div key={it.key} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${severityClasses(it.severity)}`}>
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{it.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed opacity-90">
                {it.body}
                {it.severity === 'exhausted' && it.kind === 'product' && ' Neden engellendi: plan kotası doldu.'}
                {it.severity === 'exhausted' && it.kind === 'marketplace' && ' Neden engellendi: pazaryeri kotası doldu (mağaza limiti değil).'}
                {it.severity === 'exhausted' && it.kind === 'credits' && ' Neden AI çalışmıyor: kredi bitti.'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link href={it.cta.href} className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800">
                {it.cta.label} <ArrowUpRight className="h-3 w-3" />
              </Link>
              {onDismiss && (
                <button onClick={onDismiss} className="rounded-lg p-1 hover:bg-black/5">
                  <X className="h-4 w-4 opacity-60" />
                </button>
              )}
            </div>
          </div>
        )
      })}
      {quota.nextPlan && items.some((i) => i.severity === 'exhausted') && (
        <p className="px-1 text-xs text-zinc-500">
          Öneri: <span className="font-medium text-zinc-700">{quota.nextPlan.name}</span> — {quota.nextPlan.productLimit} ürün / {quota.nextPlan.aiCredits} kredi · {quota.nextPlan.price} ₺/ay
        </p>
      )}
    </div>
  )
}
