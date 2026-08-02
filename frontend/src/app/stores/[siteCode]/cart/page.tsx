'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trash2, Minus, Plus, ArrowLeft } from 'lucide-react'
import { useCart } from '@/lib/cart'

export default function CartPage() {
  const { siteCode } = useParams<{ siteCode: string }>()
  const router = useRouter()
  const { items, removeItem, updateQuantity, totalPrice } = useCart()

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-zinc-900">Sepet</h1>
        <p className="mt-4 text-sm text-zinc-500">Sepetinde ürün bulunmuyor.</p>
        <Link href={`/store/${siteCode}`} className="mt-4 inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900">
          <ArrowLeft className="h-4 w-4" /> Alışverişe Başla
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-zinc-900">Sepet</h1>

      <div className="mt-8 space-y-4">
        {items.map((item) => (
          <div key={item.sku} className="flex items-center gap-4 rounded-xl border border-zinc-200 p-4">
            {item.image && (
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-zinc-900 truncate">{item.name}</h3>
              <p className="text-xs text-zinc-400">SKU: {item.sku}</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">
                {item.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
              </p>
            </div>
            <div className="flex items-center rounded-lg border border-zinc-300">
              <button onClick={() => updateQuantity(item.sku, item.quantity - 1)} className="p-1.5 text-zinc-500 hover:text-zinc-900">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
              <button onClick={() => updateQuantity(item.sku, item.quantity + 1)} className="p-1.5 text-zinc-500 hover:text-zinc-900">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="w-24 text-right text-sm font-semibold text-zinc-900">
              {(item.price * item.quantity).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
            </p>
            <button onClick={() => removeItem(item.sku)} className="p-2 text-zinc-400 hover:text-red-500">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 border-t border-zinc-200 pt-6">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-zinc-900">Toplam</p>
          <p className="text-2xl font-bold text-zinc-900">
            {totalPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
          </p>
        </div>
        <button
          onClick={() => router.push(`/store/${siteCode}/checkout`)}
          className="mt-6 w-full rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Ödemeye Geç
        </button>
      </div>
    </div>
  )
}
