import Link from 'next/link'
import { Sparkles, ShoppingBag, Globe, BarChart3 } from 'lucide-react'

const features = [
  { icon: ShoppingBag, title: 'E-Ticaret Altyapısı', desc: 'Shopify benzeri multi-tenant mağaza yönetimi. Kendi domaininizle hemen başlayın.' },
  { icon: Sparkles, title: 'AI Ürün Görseli', desc: 'Yapay zeka ile arka plan silme, ürün görseli düzenleme ve ComfyUI workflow desteği.' },
  { icon: Globe, title: 'Pazaryeri Entegrasyonu', desc: 'Trendyol, Hepsiburada gibi pazaryerlerine tek tıkla ürün gönderimi ve sipariş senkronizasyonu.' },
  { icon: BarChart3, title: 'Akıllı Dashboard', desc: 'Satış raporları, stok takibi, AI kredisi kullanımı — hepsi tek panelde.' },
]

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-6xl">
              AI Destekli
              <span className="text-indigo-600"> E-Ticaret</span> Platformu
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
              Shopify benzeri altyapı, yapay zeka ile ürün yönetimi ve tüm pazaryerlerine entegrasyon.
              Tek platformda hayalinizdeki mağazayı kurun.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link
                href="/register"
                className="rounded-lg bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                Ücretsiz Başla
              </Link>
              <Link
                href="/features"
                className="rounded-lg border border-zinc-300 bg-white px-6 py-3 text-base font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Özellikleri İncele
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-zinc-50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-900">
            Her Şey Tek Platformda
          </h2>
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="relative rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-zinc-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
            Altyapıyı Biz Hallederiz
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">
            İster bizim sunucumuzda host edin, ister kendi sunucunuzda slave yazılımımızla çalıştırın.
            İkisinde de API ve AI gücü cebinizde.
          </p>
          <Link
            href="/pricing"
            className="mt-8 inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Fiyatlandırmayı Gör <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </section>
    </>
  )
}
