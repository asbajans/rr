import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Ürün</h3>
            <ul className="mt-3 space-y-2">
              <li><Link href="/features" className="text-sm text-zinc-600 hover:text-zinc-900">Özellikler</Link></li>
              <li><Link href="/pricing" className="text-sm text-zinc-600 hover:text-zinc-900">Fiyatlandırma</Link></li>
              <li><Link href="/blog" className="text-sm text-zinc-600 hover:text-zinc-900">Blog</Link></li>
              <li><Link href="/#how" className="text-sm text-zinc-600 hover:text-zinc-900">Nasıl Çalışır</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Yasal</h3>
            <ul className="mt-3 space-y-2">
              <li><Link href="/gizlilik-politikasi" className="text-sm text-zinc-600 hover:text-zinc-900">Gizlilik Politikası</Link></li>
              <li><Link href="/kvkk-aydinlatma-metni" className="text-sm text-zinc-600 hover:text-zinc-900">KVKK Aydınlatma Metni</Link></li>
              <li><Link href="/cerez-politikasi" className="text-sm text-zinc-600 hover:text-zinc-900">Çerez Politikası</Link></li>
              <li><Link href="/kullanim-sartlari" className="text-sm text-zinc-600 hover:text-zinc-900">Kullanım Şartları</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Sözleşmeler</h3>
            <ul className="mt-3 space-y-2">
              <li><Link href="/mesafeli-satis-sozlesmesi" className="text-sm text-zinc-600 hover:text-zinc-900">Mesafeli Satış Sözleşmesi</Link></li>
              <li><Link href="/iptal-iade" className="text-sm text-zinc-600 hover:text-zinc-900">İptal &amp; İade</Link></li>
              <li><Link href="/teslimat" className="text-sm text-zinc-600 hover:text-zinc-900">Teslimat Bilgisi</Link></li>
              <li><Link href="/deletemyaccount" className="text-sm text-red-600 hover:text-red-700">Hesabımı Sil</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">İletişim</h3>
            <ul className="mt-3 space-y-2">
              <li><a href="mailto:hello@rahatio.com.tr" className="text-sm text-zinc-600 hover:text-zinc-900">hello@rahatio.com.tr</a></li>
              <li><Link href="/teslimat" className="text-sm text-zinc-600 hover:text-zinc-900">Destek</Link></li>
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-zinc-400">
              Rahatio — AI ürün yönetimi ve pazaryeri entegrasyonu platformu.<br />
              Yasal metinler şablondur; hukuk danışmanına inceletin.
            </p>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-zinc-200 pt-6 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2">
            <img src="/logo.jpeg" alt="Rahatio" className="h-7 w-7 rounded-md object-cover" width={28} height={28} />
            <span className="text-sm font-semibold text-zinc-900">Rahatio</span>
            <span className="text-xs text-zinc-400">© {new Date().getFullYear()} Tüm hakları saklıdır.</span>
          </div>
          <p className="text-xs text-zinc-400">
            <Link href="/gizlilik-politikasi" className="hover:text-zinc-600 hover:underline">Gizlilik</Link>
            <span className="mx-2">·</span>
            <Link href="/kullanim-sartlari" className="hover:text-zinc-600 hover:underline">Şartlar</Link>
            <span className="mx-2">·</span>
            <Link href="/cerez-politikasi" className="hover:text-zinc-600 hover:underline">Çerezler</Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
