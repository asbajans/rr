import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/LegalLayout'

export const metadata: Metadata = {
  title: 'Çerez Politikası — Rahatio',
  description: 'Rahatio çerez politikası: zorunlu, işlevsel, analitik ve pazarlama çerezleri hakkında bilgi.',
}

const UPDATED = '27 Ağustos 2026'

export default function Page() {
  return (
    <LegalLayout
      title="Çerez Politikası"
      description="rahatio.com.tr ve panelde kullanılan çerezler, amaçları ve tercihlerinizi nasıl yöneteceğiniz."
      lastUpdated={UPDATED}
    >
      <h2>1. Çerez Nedir?</h2>
      <p>
        Çerezler, ziyaretinizde cihazınıza kaydedilen küçük metin dosyalarıdır. Oturum çerezleri tarayıcı kapanınca silinir; kalıcı çerezler süreleri dolana kadar kalır.
      </p>

      <h2>2. Kullandığımız Çerez Türleri</h2>
      <table>
        <thead>
          <tr>
            <th>Tür</th>
            <th>Örnek</th>
            <th>Hukuki Sebep</th>
            <th>Süre</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Zorunlu</td>
            <td>Oturum, CSRF, auth_token</td>
            <td>Meşru menfaat + sözleşme</td>
            <td>Oturum / 30 gün</td>
          </tr>
          <tr>
            <td>İşlevsel</td>
            <td>Dil (app_locale), tema</td>
            <td>Meşru menfaat</td>
            <td>1 yıl</td>
          </tr>
          <tr>
            <td>Analitik</td>
            <td>_ga, _gid (Google Analytics — tercihinize bağlı)</td>
            <td>Açık rıza</td>
            <td>13 ay</td>
          </tr>
          <tr>
            <td>Pazarlama</td>
            <td>Facebook Pixel, TikTok Pixel (piksel ayarınız açıksa)</td>
            <td>Açık rıza</td>
            <td>180 gün</td>
          </tr>
        </tbody>
      </table>

      <h2>3. Üçüncü Taraf Çerezleri</h2>
      <p>
        Analytics ve piksel sağlayıcıları (Google, Meta, TikTok) kendi çerezlerini yerleştirebilir. Bu sağlayıcıların kendi politikaları geçerlidir. Yurt dışına aktarım söz konusu olabilir; açık rızanızla işlenir.
      </p>

      <h2>4. Çerez Tercihlerinizi Yönetme</h2>
      <ul>
        <li>Panel &gt; Piksel &amp; Takip sayfasından pazarlama piksellerini kapatabilirsiniz.</li>
        <li>Tarayıcı ayarlarından çerezleri silebilir / engelleyebilirsiniz. Zorunlu çerezler engellenirse giriş ve ödeme akışları çalışmayabilir.</li>
        <li>Google için <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noreferrer">opt-out eklentisi</a>ni kullanabilirsiniz.</li>
      </ul>

      <h2>5. Çerez Banner’ı ve Rıza</h2>
      <p>
        İlk ziyarette banner ile bilgilendirilir, analitik/pazarlama için rıza alınır. Reddederseniz yalnızca zorunlu ve işlevsel çerezler kullanılır. Rızanızı aynı banner veya tarayıcı ayarlarından her zaman geri çekebilirsiniz.
      </p>

      <h2>6. Güncellemeler</h2>
      <p>Politika değişirse bu sayfada ilan edilir. Tarihçe için “Son güncelleme” alanına bakın.</p>

      <h2>7. İletişim</h2>
      <p>hello@rahatio.com.tr</p>
    </LegalLayout>
  )
}
