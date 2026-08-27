import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/LegalLayout'

export const metadata: Metadata = {
  title: 'İptal & İade Politikası — Rahatio',
  description: 'Rahatio abonelik iptali, cayma hakkı ve iade koşulları.',
}

const UPDATED = '27 Ağustos 2026'

export default function Page() {
  return (
    <LegalLayout
      title="İptal, İade ve Cayma Politikası"
      description="Abonelik/Hizmet satışlarında iptal, cayma (14 gün) ve iade süreçleri. Mağazalarınızdaki ürün satışları kendi mağaza politikalarınıza tabidir."
      lastUpdated={UPDATED}
    >
      <h2>1. Aboneliği İptal Etme</h2>
      <p>
        Panel &gt; Faturalama / Aboneliğim &gt; İptal et adımından her zaman iptal edebilirsiniz. İptal, <strong>dönem sonuna kadar</strong> kullanımınızı etkilemez; bir sonraki yenilemede tahsilat yapılmaz.
      </p>

      <h2>2. Cayma Hakkı</h2>
      <ul>
        <li>Dijital hizmetlerde ifa, Alıcının açık onayı ile derhâl başlar. Yönetmelik m.15/1-ğ uyarınca, ifanın tamamı elektronik ortamda anında sunulan hizmetlerde cayma istisnası doğabilir.</li>
        <li>Rahatio, ifaya başlamadan önce onayınızı ayrıca alır. 14 gün içinde caymak isterseniz hello@rahatio.com.tr üzerinden başvurun; kullanılmayan kısım iade edilir, orantılı kullanım ve işlem masrafları düşülebilir.</li>
        <li>Tüketici olmayan (tacir/esnaf) Alıcılar için cayma hakkı mevzuat gereği doğmayabilir.</li>
      </ul>

      <h2>3. İadeler</h2>
      <ul>
        <li>İade talebi onaylanırsa tutar, ödemenin yapıldığı yönteme 14 gün içinde iade edilir (banka süreçleri hariç).</li>
        <li>Kısmi kullanım varsa gün esaslı orantılı iade yapılır.</li>
        <li>Yanlışlıkla çift tahsilat, hatalı tahsilat gibi durumlarda tam iade yapılır.</li>
      </ul>

      <h2>4. İstisnalar ve Red Halleri</h2>
      <ul>
        <li>AI kredileri kullanıldıktan sonra ilgili kullanıma karşılık gelen kısım iadeye konu edilmez.</li>
        <li>Kampanya/hediye krediler nakde çevrilemez.</li>
        <li>Hileli kullanım, şart ihlali veya chargeback kötüye kullanımında iade yapılmayabilir.</li>
      </ul>

      <h2>5. Fesih</h2>
      <p>
        Şirket, şart ihlali veya mevzuata aykırı kullanımda hesabı askıya alabilir/sonlandırabilir. Bu durumda kullanılmayan döneme ilişkin ücret iade edilmez; hukuki haklar saklıdır.
      </p>

      <h2>6. Başvuru</h2>
      <p>
        İptal/İade talepleriniz için: Panel &gt; Destek veya <a href="mailto:hello@rahatio.com.tr">hello@rahatio.com.tr</a> — 3 iş günü içinde yanıtlanır.
      </p>

      <h2>7. Uyuşmazlık</h2>
      <p>Tüketici işlemlerinde Tüketici Hakem Heyetleri / Mahkemeleri yetkilidir. Bilgi için Ticaret Bakanlığı Tüketici Danışma Hattı: ALO 175.</p>
    </LegalLayout>
  )
}
