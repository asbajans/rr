import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/LegalLayout'

export const metadata: Metadata = {
  title: 'Kullanım Şartları — Rahatio',
  description: 'Rahatio hizmet kullanım şartları, abonelik, sorumluluk ve fikri mülkiyet hükümleri.',
}

const UPDATED = '27 Ağustos 2026'

export default function Page() {
  return (
    <LegalLayout
      title="Kullanım Şartları"
      description="rahatio.com.tr ve Rahatio hizmetlerini kullanarak aşağıdaki şartları kabul etmiş sayılırsınız."
      lastUpdated={UPDATED}
    >
      <h2>1. Taraflar ve Tanımlar</h2>
      <p>
        “Rahatio / Şirket” — rahatio.com.tr’yi ve SaaS hizmetlerini işleten taraf. “Kullanıcı / Satıcı” — hesap açan gerçek/tüzel kişi. “Hizmet” — panel, mağaza altyapısı, entegrasyon, AI Studio ve ek modüller.
      </p>

      <h2>2. Hesap ve Uygunluk</h2>
      <ul>
        <li>Hizmet 18 yaş ve üzeri ile tacir/esnaf içindir.</li>
        <li>Bilgileriniz doğru ve güncel olmalı; hesabınızın güvenliğinden siz sorumlusunuz.</li>
        <li>Yetkisiz erişimi derhâl bildirmelisiniz.</li>
      </ul>

      <h2>3. Abonelik, Ücret ve Ödeme</h2>
      <ul>
        <li>Planlar aylık/yıllık; fiyatlara KDV dâhil mi hariç mi plan kartında belirtilir.</li>
        <li>Ödeme Stripe (veya iyzico/PayTR) üzerinden alınır; kart verisi bizde tutulmaz.</li>
        <li>Yenileme otomatiktir; iptal etmezseniz bir sonraki dönem tahsil edilir. İptal panelden yapılır.</li>
        <li>Fiyat değişiklikleri bir sonraki yenilemede geçerlidir ve önceden duyurulur.</li>
      </ul>

      <h2>4. Hizmetin Kapsamı ve Değişiklik</h2>
      <p>
        AI çıktıları (başlık, açıklama, fiyat önerisi vb.) öneri niteliğindedir; doğruluk ve mevzuata uygunluktan kullanıcı sorumludur. Şirket, hizmeti geliştirmek için özellikleri ekleyebilir, değiştirebilir veya makul bildirimle sonlandırabilir.
      </p>

      <h2>5. Kullanıcı Yükümlülükleri</h2>
      <ul>
        <li>Mevzuata (KVKK, ETK, Tüketicinin Korunması, Fikri Mülkiyet) uygun içerik sağlamak,</li>
        <li>Üçüncü kişi haklarını ihlal etmemek, yanıltıcı beyan/ürün sunmamak,</li>
        <li>Sisteme zarar verecek tersine mühendislik, spam, saldırı yapmamak.</li>
      </ul>

      <h2>6. Fikri Mülkiyet</h2>
      <p>
        Platform, marka, arayüz ve kodların fikri hakları Şirkete aittir. Yüklediğiniz içerikte hak sahibi olduğunuzu beyan edersiniz; hizmeti sunmak için Şirkete dünya çapında, bedelsiz, alt lisanslanabilir kullanım hakkı verirsiniz.
      </p>

      <h2>7. Garanti Reddi ve Sorumluluk Sınırı</h2>
      <p>
        Hizmet “olduğu gibi” sunulur; kesintisizlik, hatasızlık garanti edilmez. Dolaylı zararlar (kâr kaybı, veri kaybı) için sorumluluk, ilgili dönem için ödediğiniz abonelik bedeliyle sınırlıdır. Zorunlu mevzuat hükümleri saklıdır.
      </p>

      <h2>8. Askıya Alma ve Fesih</h2>
      <p>
        Şart ihlali, mevzuata aykırılık, ödeme temerrüdü veya güvenlik riski halinde hesap askıya alınabilir / feshedilebilir. Siz de dilediğiniz an iptal edebilirsiniz; veriler talep üzerine mevzuata uygun silinir/aktarılır.
      </p>

      <h2>9. Uyuşmazlık ve Yetki</h2>
      <p>
        Türk hukuku uygulanır. Tüketici işlemlerinde Tüketici Hakem Heyeti / Mahkemeleri; tacir işlemlerinde İstanbul (Çağlayan) Mahkemeleri ve İcra Daireleri yetkilidir — şirket merkezinize göre güncelleyin.
      </p>

      <h2>10. Bildirim</h2>
      <p>Şirket bildirimleri hesabınızdaki e-postaya yapılır; siz de hello@rahatio.com.tr üzerinden ulaşabilirsiniz.</p>

      <h2>11. Değişiklik</h2>
      <p>Şartlar güncellenebilir; önemli değişiklikler e-posta/panel duyurusu ile bildirilir.</p>
    </LegalLayout>
  )
}
