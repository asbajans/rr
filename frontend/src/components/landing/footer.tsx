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
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Şirket</h3>
            <ul className="mt-3 space-y-2">
              <li><span className="text-sm text-zinc-600">Hakkımızda</span></li>
              <li><span className="text-sm text-zinc-600">İletişim</span></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Yasal</h3>
            <ul className="mt-3 space-y-2">
              <li><span className="text-sm text-zinc-600">Gizlilik</span></li>
              <li><span className="text-sm text-zinc-600">Şartlar</span></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">İletişim</h3>
            <ul className="mt-3 space-y-2">
              <li><span className="text-sm text-zinc-600">hello@rahatio.com.tr</span></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-zinc-200 pt-8 text-center">
          <p className="text-sm text-zinc-500">&copy; {new Date().getFullYear()} Rahatio. Tüm hakları saklıdır.</p>
        </div>
      </div>
    </footer>
  )
}
