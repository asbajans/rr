import { ShoppingBag, Sparkles, Globe, BarChart3, Shield, Smartphone } from 'lucide-react'

const features = [
  { icon: ShoppingBag, title: 'Multi-Tenant Mağaza', desc: 'Her müşteri kendi domaininde mağaza açar. Shopify benzeri altyapı, tam kontrol.' },
  { icon: Sparkles, title: 'AI Görsel İşleme', desc: 'Arka plan temizleme, ComfyUI workflow, AI ile ürün görseli düzenleme. Tek tıkla profesyonel görseller.' },
  { icon: Globe, title: 'Pazaryeri Entegrasyonu', desc: 'Trendyol, Hepsiburada ve daha fazlasına tek tıkla ürün gönder. Siparişler otomatik senkronize olsun.' },
  { icon: BarChart3, title: 'Gelişmiş Dashboard', desc: 'Satış raporları, stok takibi, AI kredisi kullanımı. Tüm veriler tek panelde.' },
  { icon: Shield, title: 'Kendi Sunucunda Host', desc: 'Slave yazılımımız ile kendi sunucunda yayın yap. Tüm veriler API üzerinden senkronize.' },
  { icon: Smartphone, title: 'Mobil Uygulama', desc: 'iOS ve Android için mobil uygulama ile mağazanı cebinden yönet.' },
]

export default function FeaturesPage() {
  return (
    <div className="py-24">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Özellikler</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">Rahatio ile e-ticaret işini bir adım öteye taşı.</p>
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-zinc-200 p-8 text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-zinc-900">{f.title}</h3>
              <p className="mt-2 text-sm text-zinc-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
