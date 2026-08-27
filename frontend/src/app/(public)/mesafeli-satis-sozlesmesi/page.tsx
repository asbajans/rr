import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/LegalLayout'

export const metadata: Metadata = {
  title: 'Mesafeli Satış Sözleşmesi — Rahatio',
  description: 'Rahatio abonelik hizmetine ilişkin 6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği kapsamındaki sözleşme metni.',
}

const UPDATED = '27 Ağustos 2026'

export default function Page() {
  return (
    <LegalLayout
      title="Mesafeli Satış Sözleşmesi"
      description="6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca abonelik/Hizmet satışına ilişkin sözleşmedir. Bu metin SaaS aboneliği içindir; mağazalarınızdaki fiziksel ürün satışları için kendi mağaza sözleşmenizi kullanın."
      lastUpdated={UPDATED}
    >
      <h2>1. Taraflar</h2>
      <p>
        <strong>Satıcı (Hizmet Sağlayıcı):</strong> Rahatio Teknoloji Hizmetleri — [Unvan, adres, telefon, e-posta, MERSİS, VKN, KEP ekleyin] — hello@rahatio.com.tr<br />
        <strong>Alıcı (Abone):</strong> Panel üzerinden abonelik satın alan gerçek/tüzel kişi (sipariş/üyelik bilgilerindeki kişi).
      </p>

      <h2>2. Konu</h2>
      <p>
        Alıcının elektronik ortamda sipariş verdiği abonelik planı (Free / Starter / Growth / Enterprise) kapsamında Rahatio SaaS hizmetinin bedeli, ifa şekli, cayma ve fesih koşullarının düzenlenmesidir.
      </p>

      <h2>3. Hizmetin Özellikleri ve Süresi</h2>
      <ul>
        <li>Hizmet dijital aboneliktir; seçilen planın ürün limiti, AI kredisi, modülleri plan kartında yazar.</li>
        <li>Süre: aylık veya yıllık; yenileme otomatiktir.</li>
        <li>Teslim / İfa: ödeme onayıyla derhâl elektronik ortamda (panel erişimi açılır). Fiziksel teslim yoktur.</li>
      </ul>

      <h2>4. Bedel, Vergi ve Ödeme</h2>
      <p>
        Bedel sipariş anındaki tutardır; KDV durumu plan kartında belirtilir. Ödeme Stripe / iyzico / PayTR altyapısıyla anında tahsil edilir. Fatura Alıcı adına elektronik olarak düzenlenir.
      </p>

      <h2>5. Cayma Hakkı (Yönetmelik m.15 İstisnaları)</h2>
      <p>
        Dijital hizmetlerde, Alıcının <strong>onayı ile ifaya başlanmış</strong> ve hizmetin tamamı/tamamına yakını elektronik ortamda derhâl sunulmuşsa cayma hakkı istisna kapsamındadır. Alıcı, siparişi onaylarken “aboneliğin hemen başlatılmasına ve cayma hakkını bu ölçüde kaybedeceğine” dair açık onayı verir. Buna rağmen Alıcı ilk 14 gün içinde aboneliği iptal edebilir; kullanılmayan dönemin bedeli — kullanım ve masraflar düşülerek — iade edilir. Enterprise/özel tekliflerde cayma sözleşmeyle ayrıca düzenlenebilir.
      </p>
      <p className="text-xs text-zinc-500">
        Not: Tüketici olmayan (tacir) Alıcılar için cayma hükümleri uygulanmayabilir; TBK genel hükümleri geçerlidir.
      </p>

      <h2>6. İptal ve Yenileme</h2>
      <ul>
        <li>İptal panel &gt; Faturalama / Aboneliğim üzerinden yapılır; dönem sonuna kadar kullanım devam eder.</li>
        <li>Yenileme ücreti, yenileme tarihindeki liste fiyatıdır; fiyat değişirse önceden bildirilir.</li>
      </ul>

      <h2>7. Garanti ve Sorumluluk</h2>
      <p>
        Hizmet ayıp hükümlerine tabidir; kesinti/hata halinde Şirket makul sürede düzeltir. Dolaylı zararlarda sorumluluk ilgili dönem bedeliyle sınırlıdır.
      </p>

      <h2>8. Uyuşmazlık Çözümü</h2>
      <p>
        Tüketici işlemlerinde Alıcının yerleşim yerindeki Tüketici Hakem Heyeti / Mahkemeleri; tacir işlemlerinde İstanbul Mahkemeleri yetkilidir. Parasal sınırlar her yıl Ticaret Bakanlığı’nca güncellenir.
      </p>

      <h2>9. Ön Bilgilendirme Onayı</h2>
      <p>
        Alıcı, siparişi onaylayarak Ön Bilgilendirme Formu ve bu sözleşmeyi okuduğunu, elektronik ortamda onayladığını ve bir nüshasının e-posta ile gönderileceğini kabul eder.
      </p>

      <h2>Ek — Sipariş Özeti Şablonu</h2>
      <pre className="whitespace-pre-wrap rounded-xl bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-100">
{`Plan: [ör. Growth - Aylık]
Süre: [1 ay / 12 ay]
Tutar: [₺X + KDV]
Yenileme: [otomatik]
Fatura unvanı: [Alıcı unvanı / ad soyad]
Tarih: [sipariş tarihi]`}
      </pre>
    </LegalLayout>
  )
}
