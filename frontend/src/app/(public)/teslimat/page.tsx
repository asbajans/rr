import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/LegalLayout'

export const metadata: Metadata = {
  title: 'Teslimat Bilgisi — Rahatio',
  description: 'Rahatio dijital hizmet teslimat ve ifa bilgisi: abonelik erişimi nasıl açılır, faturalar ve süreler.',
}

const UPDATED = '27 Ağustos 2026'

export default function Page() {
  return (
    <LegalLayout
      title="Teslimat ve İfa Bilgisi"
      description="Rahatio dijital abonelik hizmeti fiziksel kargo gerektirmez; erişim ve fatura süreçleri aşağıdadır. Mağazalarınızdaki ürün kargo süreçleri için mağaza sayfanızdaki Teslimat & Kargo bölümüne bakın."
      lastUpdated={UPDATED}
    >
      <h2>1. İfa Şekli</h2>
      <p>
        Siparişiniz ödeme sağlayıcı (Stripe / iyzico / PayTR) tarafından onaylanır onaylanmaz <strong>panel erişiminiz ve kredileriniz anında</strong> hesabınıza tanımlanır. Fiziksel ürün veya kargo yoktur.
      </p>

      <h2>2. Fatura</h2>
      <ul>
        <li>E-fatura / e-arşiv fatura, belirttiğiniz firma/bireysel bilgilere göre düzenlenip e-postanıza gönderilir.</li>
        <li>Fatura bilgilerinizi Panel &gt; Ayarlar &gt; Fatura bilgilerinden güncelleyebilirsiniz.</li>
      </ul>

      <h2>3. Süreler ve Yenileme</h2>
      <ul>
        <li>Aylık plan: 30 gün; yıllık plan: 12 ay geçerlidir.</li>
        <li>Yenileme otomatiktir; iptal etmezseniz dönem bitiminde aynı süre uzar.</li>
      </ul>

      <h2>4. Destek ve Erişim Sorunları</h2>
      <p>
        Erişim sorunu yaşarsanız hello@rahatio.com.tr veya panel &gt; Destek üzerinden bildirin. Kesinti halinde hizmet süresi orantılı uzatılabilir veya iade yapılabilir.
      </p>

      <h2>5. Mağaza Ürün Teslimatı (Bilgilendirme)</h2>
      <p>
        Rahatio üzerindeki mağazalarınızda sattığınız fiziksel ürünlerin teslimat ve kargo bilgileri mağazanızın kendi sayfasında (Teslimat ve Kargo / Mesafeli Satış Sözleşmesi) yer almalıdır. Alıcıya “siparişim kargoya verildi” bildirimi ve takip numarası entegrasyonlar üzerinden iletilir. Teslimat, Mesafeli Sözleşmeler Yönetmeliği’nde öngörülen 30 günlük azami süreyi aşamaz; aşılırsa Alıcı sözleşmeyi feshedebilir.
      </p>
    </LegalLayout>
  )
}
