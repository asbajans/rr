'use client'
import Link from 'next/link'

export function LegalLayout({
  title,
  description,
  lastUpdated,
  children,
}: {
  title: string
  description?: string
  lastUpdated?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <nav className="mb-6 flex items-center gap-2 text-xs text-zinc-500">
          <Link href="/" className="hover:text-zinc-900 hover:underline">Ana Sayfa</Link>
          <span>/</span>
          <span className="text-zinc-900">{title}</span>
        </nav>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          <strong>Yasal Uyarı:</strong> Bu metin genel bilgilendirme amaçlı bir şablondur. 6698 sayılı KVKK, 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun, Mesafeli Sözleşmeler Yönetmeliği ve ilgili mevzuata uyum için bir hukuk danışmanına inceletmeniz önerilir. Şirket bilgilerinizle (unvan, adres, MERSİS, iletişim) güncel tutunuz.
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
        {description && <p className="mt-3 text-sm leading-relaxed text-zinc-600">{description}</p>}
        {lastUpdated && <p className="mt-2 text-xs text-zinc-400">Son güncelleme: {lastUpdated}</p>}

        <div className="prose prose-zinc mt-8 max-w-none prose-headings:font-semibold prose-h2:mt-10 prose-h2:text-xl prose-h3:mt-6 prose-h3:text-base prose-p:text-sm prose-p:leading-relaxed prose-li:text-sm prose-a:text-indigo-600 prose-a:underline-offset-4 hover:prose-a:text-indigo-700">
          {children}
        </div>

        <div className="mt-10 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <p className="text-xs text-zinc-500">
            Sorularınız için: <a href="mailto:hello@rahatio.com.tr" className="font-medium text-indigo-600 hover:text-indigo-700">hello@rahatio.com.tr</a> — Rahatio Teknoloji Hizmetleri, https://rahatio.com.tr
          </p>
        </div>
      </div>
    </div>
  )
}
