import Link from 'next/link'

const plans = [
  { name: 'Başlangıç', price: 'Ücretsiz', features: ['1 mağaza', '10 AI kredisi', '10 ürün', 'Temel API'], cta: 'Başla' },
  { name: 'Basic', price: '₺299/ay', features: ['1 mağaza', '100 AI kredisi', '100 ürün', 'Pazaryeri entegrasyonu', 'API anahtarı'], cta: 'Seç', popular: true },
  { name: 'Pro', price: '₺799/ay', features: ['3 mağaza', '500 AI kredisi', '1.000 ürün', 'Pazaryeri entegrasyonu', 'Öncelikli destek', 'Slave yazılım'], cta: 'Seç' },
  { name: 'Kurumsal', price: 'Özel', features: ['Sınırsız mağaza', 'Özel AI kredisi', 'Sınırsız ürün', 'Özel entegrasyon', '7/24 destek', 'Özel sunucu'], cta: 'İletişim' },
]

export default function PricingPage() {
  return (
    <div className="py-24">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Fiyatlandırma</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">İhtiyacına uygun planı seç, hemen başla.</p>
        <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.name} className={`relative rounded-2xl border p-8 text-left ${plan.popular ? 'border-indigo-600 ring-2 ring-indigo-600' : 'border-zinc-200'}`}>
              {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">Popüler</span>}
              <h3 className="text-lg font-semibold text-zinc-900">{plan.name}</h3>
              <p className="mt-4 text-3xl font-bold text-zinc-900">{plan.price}</p>
              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-zinc-600">✓ {f}</li>
                ))}
              </ul>
              <Link href="/register"
                className={`mt-8 block rounded-lg px-4 py-2 text-center text-sm font-semibold ${plan.popular ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'border border-zinc-300 text-zinc-900 hover:bg-zinc-50'}`}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
