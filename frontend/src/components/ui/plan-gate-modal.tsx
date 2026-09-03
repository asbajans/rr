'use client'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Coins, Package, ArrowUpRight, X } from 'lucide-react'

type GateType = 'product' | 'credits'

export default function PlanGateModal({
  open,
  type,
  current,
  limit,
  remaining,
  allowance,
  required,
  onClose,
}: {
  open: boolean
  type: GateType
  current?: number
  limit?: number
  remaining?: number
  allowance?: number
  required?: number
  onClose: () => void
}) {
  const router = useRouter()
  if (!open) return null

  const isProduct = type === 'product'
  const title = isProduct ? 'Ürün Limitiniz Doldu' : 'AI Krediniz Yetersiz'
  const Icon = isProduct ? Package : Coins

  const productDesc =
    current !== undefined && limit !== undefined
      ? `Mağazanızdaki ürün sayısı limitinize ulaştı (${current}/${limit}). Bu planda daha fazla ürün ekleyemezsiniz, B2B klon yapamazsınız ve pazaryeri import’u engellenir.`
      : 'Ürün limitiniz doldu. Yeni ürün eklemek için planınızı yükseltmeniz gerekiyor.'

  const creditsDesc =
    remaining !== undefined && allowance !== undefined
      ? `AI krediniz tükendi (${remaining}/${allowance}). AI ile ürün oluşturma, görsel düzenleme/üretme ve blog üretimi durdu.`
      : required
        ? `Bu işlem için ${required} kredi gerekiyor ancak yeterli krediniz yok.`
        : 'AI krediniz yetersiz. Devam etmek için kredi almanız veya üst pakete geçmeniz gerekiyor.'

  const goBilling = (reason: string) => {
    onClose()
    router.push(`/billing?reason=${reason}`)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isProduct ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{isProduct ? productDesc : creditsDesc}</p>
            {!isProduct && required !== undefined && (
              <p className="mt-2 text-xs text-zinc-500">Gereken: {required} kredi · Kalan: {remaining ?? 0}</p>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            {isProduct ? 'Neden engellendi?' : 'Neden AI çalışmıyor?'}
          </span>
          <span className="ml-1">
            {isProduct
              ? 'Planınızın ürün kotası dolduğu için ekleme engellendi.'
              : 'AI krediniz bittiği için tüm AI özellikleri durdu.'}
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button onClick={onClose} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            Kapat
          </button>
          {isProduct ? (
            <button
              onClick={() => goBilling('product_limit')}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Planları Gör <ArrowUpRight className="h-4 w-4" />
            </button>
          ) : (
            <>
              <button
                onClick={() => goBilling('credits')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Kredi Al <Coins className="h-4 w-4" />
              </button>
              <button
                onClick={() => goBilling('product_limit')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Üst Pakete Geç <ArrowUpRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
