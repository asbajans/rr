import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/LegalLayout'

export const metadata: Metadata = {
  title: 'Gizlilik Politikası — Rahatio',
  description: 'Rahatio gizlilik politikası: toplanan veriler, işleme amaçları, hukuki sebepler, saklama ve haklarınız.',
}

const UPDATED = '27 Ağustos 2026'

export default function Page() {
  return (
    <LegalLayout
      title="Gizlilik Politikası"
      description="Rahatio (“Şirket”, “biz”) olarak hizmetlerimizi sunarken hangi kişisel verileri neden işlediğimizi, nasıl koruduğumuzu ve haklarınızı bu politikada açıklıyoruz."
      lastUpdated={UPDATED}
    >
      <h2>1. Veri Sorumlusu</h2>
      <p>
        <strong>Rahatio Teknoloji Hizmetleri</strong> — hello@rahatio.com.tr — https://rahatio.com.tr<br />
        Adres / MERSİS / VKN bilgilerinizi buraya ekleyin. KVKK m.10 aydınlatma yükümlülüğü kapsamında veri sorumlusuyuz.
      </p>

      <h2>2. Topladığımız Veriler</h2>
      <ul>
        <li><strong>Hesap &amp; İletişim:</strong> ad soyad, e-posta, telefon, mağaza adı, site kodu.</li>
        <li><strong>Ödeme &amp; Faturalama:</strong> fatura unvanı, vergi no, adres, ödeme sağlayıcı referansları (kart verisi bizde saklanmaz; Stripe vb. sağlayıcıda işlenir).</li>
        <li><strong>Kullanım &amp; Teknik:</strong> IP, cihaz / tarayıcı bilgisi, log kayıtları, çerezler (bkz. Çerez Politikası), özellik kullanım istatistikleri.</li>
        <li><strong>İçerik:</strong> Yüklediğiniz ürün görselleri, açıklamalar, destek talepleri ve AI Studio çıktıları.</li>
        <li><strong>Pazaryeri Bağlantıları:</strong> Entegrasyon için verdiğiniz API anahtarları / tokenlar (şifreli saklanır).</li>
      </ul>

      <h2>3. İşleme Amaçları</h2>
      <ul>
        <li>Hesap oluşturma, kimlik doğrulama ve sözleşmenin ifası (6563 ve TBK).</li>
        <li>Abonelik, faturalama ve ödeme süreçlerinin yürütülmesi.</li>
        <li>Ürün / AI Studio / mağaza / B2B / entegrasyon hizmetlerinin sunulması ve iyileştirilmesi.</li>
        <li>Güvenlik, dolandırıcılık önleme, hata ayıklama ve audit.</li>
        <li>Mevzuattan doğan saklama ve bildirim yükümlülükleri.</li>
        <li>Açık rızanız varsa ticari elektronik ileti ve pazarlama.</li>
      </ul>

      <h2>4. Hukuki Sebepler (KVKK m.5)</h2>
      <p>
        Sözleşmenin kurulması/ifası, hukuki yükümlülük, meşru menfaat ve açık rıza. Özel nitelikli veri kural olarak işlenmez; siz paylaşırsanız yalnızca hizmet için ve açık rızayla işlenir.
      </p>

      <h2>5. Aktarımlar</h2>
      <p>Veriler, hizmet için gerekli ölçüde aşağıdaki alıcılara aktarılabilir:</p>
      <ul>
        <li>Altyapı sağlayıcılar (hosting, veritabanı, e-posta, log).</li>
        <li>Ödeme kuruluşları (Stripe, iyzico/PayTR vb.) — ödeme için.</li>
        <li>Pazaryerleri ve kargo/lojistik entegrasyonları — sizin talimatınızla.</li>
        <li>Hukuken yetkili kurumlar — talep halinde.</li>
      </ul>
      <p>Yurt dışına aktarım yalnızca KVKK m.9 şartları ve açık rıza / Yeterlilik Kararı / Standart Sözleşme ile yapılır. AI sağlayıcıları (OpenAI, Google vb.) seçtiğiniz modele göre yurt dışında işleme yapabilir.</p>

      <h2>6. Saklama Süreleri</h2>
      <p>
        Hesap verileri abonelik boyunca ve sonrasında mevzuattaki zamanaşımı (genelde 10 yıl) boyunca; loglar 2 yıl; faturalama kayıtları VUK gereği 10 yıl saklanır. Süre sonunda silinir / anonimleştirilir.
      </p>

      <h2>7. Haklarınız (KVKK m.11)</h2>
      <ul>
        <li>İşlenip işlenmediğini öğrenme, bilgi talep etme, amacına uygunluğunu öğrenme,</li>
        <li>Eksik/yanlışsa düzeltme, silme/yok etme isteme, aktarılanlara bildirilmesini isteme,</li>
        <li>Otomatik analize itiraz ve zararın giderilmesini talep etme haklarınız vardır.</li>
      </ul>
      <p>Başvuru: <strong>hello@rahatio.com.tr</strong> — kimlik doğrulama sonrası 30 gün içinde yanıtlanır. AyrıcaKVKK Kurulu’na şikâyet hakkınız saklıdır.</p>

      <h2>8. Güvenlik</h2>
      <p>
        Veriler transit (TLS) ve at-rest şifreli tutulur, erişim yetkilidir, loglanır. API anahtarları hash/şifreli saklanır. İhlal halinde 72 saat içinde Kurul’a ve ilgili kişilere bildirim yapılır.
      </p>

      <h2>9. Çocuklar</h2>
      <p>Hizmet 18 yaş altına yönelik değildir; bilerek veri toplamayız.</p>

      <h2>10. Değişiklikler</h2>
      <p>Politika güncellenirse bu sayfada ilan edilir ve önemli değişikliklerde e-posta ile bildirilir.</p>

      <h2>11. İletişim</h2>
      <p>
        Rahatio — hello@rahatio.com.tr<br />
        Lütfen posta adresi, KEP ve DPO/KVKK iletişim kişisini ekleyin.
      </p>
    </LegalLayout>
  )
}
