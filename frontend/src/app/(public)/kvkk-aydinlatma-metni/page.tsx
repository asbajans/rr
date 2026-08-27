import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/LegalLayout'

export const metadata: Metadata = {
  title: 'KVKK Aydınlatma Metni — Rahatio',
  description: '6698 sayılı KVKK m.10 kapsamında Rahatio aydınlatma metni.',
}

const UPDATED = '27 Ağustos 2026'

export default function Page() {
  return (
    <LegalLayout
      title="KVKK Aydınlatma Metni"
      description="6698 sayılı Kişisel Verilerin Korunması Kanunu’nun 10. maddesi uyarınca veri sorumlusu sıfatıyla aydınlatma metnimizdir."
      lastUpdated={UPDATED}
    >
      <h2>1. Veri Sorumlusu</h2>
      <p>
        Rahatio Teknoloji Hizmetleri — hello@rahatio.com.tr — https://rahatio.com.tr<br />
        Unvan, MERSİS, VKN ve tebligat adresinizi ekleyin.
      </p>

      <h2>2. İşlenen Kişisel Veri Kategorileri</h2>
      <table>
        <thead>
          <tr>
            <th>Kategori</th>
            <th>Örnek Veriler</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Kimlik</td><td>Ad soyad</td></tr>
          <tr><td>İletişim</td><td>E-posta, telefon, adres</td></tr>
          <tr><td>Müşteri İşlem</td><td>Abonelik, sipariş geçmişi, destek kayıtları</td></tr>
          <tr><td>İşlem Güvenliği</td><td>IP, log, cihaz bilgisi</td></tr>
          <tr><td>Finans</td><td>Fatura bilgisi, ödeme durumu (kart verisi saklanmaz)</td></tr>
          <tr><td>Pazarlama</td><td>ETK onayı, çerez tercihleri</td></tr>
        </tbody>
      </table>

      <h2>3. İşleme Amaçları</h2>
      <ul>
        <li>Sözleşmenin kurulması ve ifası, hesap/mağaza yönetimi</li>
        <li>Abonelik ve tahsilat, fatura düzenleme</li>
        <li>Hizmetin sunumu, bakım, güvenlik ve iyileştirme</li>
        <li>Ticari elektronik ileti (açık rızaya dayalı)</li>
        <li>Hukuki uyuşmazlıklarda ispat ve mevzuata uyum</li>
      </ul>

      <h2>4. Hukuki Sebepler</h2>
      <p>KVKK m.5: sözleşmenin ifası (b), hukuki yükümlülük (ç), meşru menfaat (f) ve açık rıza (1). Özel nitelikli veri m.6’ya tabidir.</p>

      <h2>5. Toplama Yöntemleri</h2>
      <p>Web/mobil arayüz, e-posta, çerezler, API entegrasyonları ve müşteri hizmetleri kanalları üzerinden elektronik ortamda toplanır.</p>

      <h2>6. Aktarım</h2>
      <p>Yurt içi ve yurt dışındaki hizmet sağlayıcılara (hosting, e-posta, ödeme, AI sağlayıcı) KVKK m.8/m.9 şartlarıyla aktarılabilir. Yurt dışı aktarımda açık rıza veya Kurul’un yeterli karar/standart sözleşme şartları aranır.</p>

      <h2>7. Haklarınız (m.11)</h2>
      <ul>
        <li>Öğrenme, erişme, düzeltme, silme/yok etme, aktarımlara bildirim, itiraz, zarar giderimi</li>
      </ul>
      <p>
        Başvurularınızı kimlik teyitli şekilde hello@rahatio.com.tr adresine veya KEP/ıslak imzalı dilekçe ile yapabilirsiniz. 30 gün içinde ücretsiz yanıtlanır (maliyet halinde Kurul tarifesi uygulanabilir).
      </p>

      <h2>8. Saklama ve İmha</h2>
      <p>Saklama Politikası ve Yönetmelik’e göre periyodik imha yapılır; süreler dolan veriler silinir, yok edilir veya anonimleştirilir.</p>

      <h2>9. Veri Sorumlusuna Başvuru Usulü</h2>
      <p>
        Tebliğ’e uygun başvuru zorunludur. Form için KEP/e-posta konu başlığına “KVKK Başvurusu” yazınız. Yanıtı aynı kanaldan alırsınız; 30 gün içinde sonuçlanmazsa Kurul’a şikâyet edebilirsiniz.
      </p>
    </LegalLayout>
  )
}
