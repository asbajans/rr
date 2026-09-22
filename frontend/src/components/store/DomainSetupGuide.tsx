'use client'

import { useState } from 'react'
import { Copy, Check, ExternalLink, Info, Globe } from 'lucide-react'

type Props = {
  cloudflare?: { configured: boolean; fallbackOrigin: string; cnameTarget: string; zoneName: string } | null
  domain?: string | null
  compact?: boolean
}

function CopyBtn({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
      title={label || 'Kopyala'}
      className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? 'Kopyalandı' : label || 'Kopyala'}
    </button>
  )
}

export default function DomainSetupGuide({ cloudflare, domain, compact }: Props) {
  const apexHint = domain?.replace(/^www\./, '') || 'magazaniz.com'
  const ns1 = 'lily.ns.cloudflare.com'
  const ns2 = 'ricardo.ns.cloudflare.com'
  return (
    <div className={`rounded-xl border ${compact ? 'border-zinc-200 bg-zinc-50' : 'border-indigo-200 bg-indigo-50/40'} p-5`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${compact ? 'bg-white border border-zinc-200' : 'bg-indigo-600'}`}>
          <Globe className={`h-5 w-5 ${compact ? 'text-indigo-600' : 'text-white'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900">Kendi domaininizi nasıl bağlarsınız?</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600">
            Mağazanızı <span className="font-medium text-zinc-900">{apexHint}</span> gibi kendi alan adınızda yayınlamak için domaininizin NS kayıtlarını Cloudflare’e yönlendirin. Sonra tüm DNS’i panelden yönetebilirsiniz.
          </p>

          <div className="mt-4 space-y-4">
            {/* Step 1 */}
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">1</span>
                Panelden domain ekle
              </div>
              <p className="mt-2 text-xs text-zinc-600">Site Yayın → Özel Domain → <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px]">{apexHint}</code> yaz → Domaini Ekle.</p>
            </div>

            {/* Step 2 */}
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">2</span>
                Domain sağlayıcınızda NS değiştir
              </div>
              <p className="mt-2 text-xs text-zinc-600">Domaini aldığınız yer (Natro, GoDaddy, İsimtescil, vb.) → NS / Nameserver yönetimi → aşağıdaki NS’leri girin:</p>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[460px] text-left text-xs">
                  <thead className="text-zinc-500">
                    <tr><th className="py-1.5 pr-3 font-medium">Tür</th><th className="py-1.5 pr-3 font-medium">Değer</th><th /></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    <tr>
                      <td className="py-2 font-mono">NS</td>
                      <td className="py-2 font-mono break-all">{ns1}</td>
                      <td className="py-2"><CopyBtn value={ns1} /></td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">NS</td>
                      <td className="py-2 font-mono break-all">{ns2}</td>
                      <td className="py-2"><CopyBtn value={ns2} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-[11px] leading-relaxed text-zinc-600">
                <Info className="h-4 w-4 shrink-0 text-zinc-400" />
                <span>
                  Eski NS’leri silip bu ikisini ekleyin. Değişiklik sonrası DNS yayılması genelde 5-30 dk, en fazla 24 saat sürer. Bu sürede siteniz eski NS üzerinden çalışmaya devam eder.
                </span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">3</span>
                Doğrulayın
              </div>
              <p className="mt-2 text-xs text-zinc-600">NS değişikliğinden sonra panelde <b>Doğrula</b> butonuna basın. Doğrulandıktan sonra <code className="font-mono text-[11px]">https://{apexHint}</code> ve <code className="font-mono text-[11px]">https://www.{apexHint}</code> doğrudan mağazanızı açar. Sonra mail ve diğer kayıtları paneldeki <b>DNS Yönetimi</b>’nden ekleyebilirsiniz.</p>
            </div>

            {/* Verify helper */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
              <span>Kontrol:</span>
              <a href={`https://dnschecker.org/#NS/${apexHint}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                dnschecker.org <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
