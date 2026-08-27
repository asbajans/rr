import { Page } from '../../models/ContentModels.js';
import { StoreMenu } from '../../models/Menu.model.js';
import { logger } from '../../utils/logger.js';

type Template = {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  blocks: (store: { name: string; email: string; siteCode: string }) => any[];
};

function storeLine(store: { name: string; email: string }) {
  return `${store.name} — ${store.email}`;
}

function noticeBlock(): any {
  return {
    id: 'block_notice',
    type: 'text',
    content: {
      body: `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px 16px;margin-bottom:16px"><p style="font-size:13px;line-height:1.6;color:#92400e;margin:0"><strong>Not:</strong> Bu metin otomatik oluşturulmuş bir şablondur. Lütfen [köşeli parantezli] alanları kendi mağaza bilgilerinizle (unvan, adres, telefon, MERSİS, vergi no, KEP) güncelleyin ve bir hukuk danışmanına inceletin. Panel &gt; Sayfalar &gt; bu sayfayı düzenleyerek kolayca güncelleyebilirsiniz.</p></div>`,
    },
  };
}

function heroBlock(title: string, subtitle: string): any {
  return {
    id: `hero_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'text',
    content: {
      body: `<div style="text-align:center;padding:8px 0 4px"><h1 style="font-size:28px;font-weight:800;margin:0;color:#18181b">${title}</h1><p style="color:#71717a;font-size:14px;margin:8px 0 0">${subtitle}</p><p style="color:#a1a1aa;font-size:12px;margin:6px 0 0">Son güncelleme: ${new Date().toLocaleDateString('tr-TR')}</p></div>`,
    },
  };
}

function textBlock(html: string): any {
  return {
    id: `block_${Math.random().toString(36).slice(2, 9)}`,
    type: 'text',
    content: { body: html },
  };
}

export const STORE_LEGAL_TEMPLATES: Template[] = [
  {
    slug: 'gizlilik-politikasi',
    title: 'Gizlilik Politikası',
    metaTitle: 'Gizlilik Politikası',
    metaDescription: 'Kişisel verilerin nasıl toplandığı, işlendiği ve korunduğu hakkında bilgi.',
    blocks: (store) => [
      noticeBlock(),
      heroBlock('Gizlilik Politikası', `${storeLine(store)} olarak kişisel verilerinizi nasıl işlediğimiz.`),
      textBlock(`
<h2>1. Veri Sorumlusu</h2>
<p><strong>${store.name}</strong> (“Mağaza”, “biz”) — İletişim: ${store.email} — Mağaza: https://rahatio.com.tr/stores/${store.siteCode}</p>
<p>[Lütfen buraya şirket unvanı, adres, telefon, MERSİS / VKN ve KEP bilgilerinizi ekleyin. KVKK m.10 aydınlatma yükümlülüğü için zorunludur.]</p>

<h2>2. Topladığımız Veriler</h2>
<ul>
<li>Hesap ve iletişim: ad soyad, e-posta, telefon, adres.</li>
<li>Sipariş ve teslimat: teslimat adresi, sipariş notu, kargo takip.</li>
<li>Ödeme: fatura bilgileri (kart verisi bizde değil, ödeme kuruluşunda işlenir).</li>
<li>Teknik: IP, cihaz / tarayıcı, çerezler, log.</li>
</ul>

<h2>3. İşleme Amaçları</h2>
<ul>
<li>Siparişin alınması, hazırlanması, kargolanması ve iade süreçleri.</li>
<li>Müşteri hizmetleri, garanti ve mevzuattan doğan yükümlülükler.</li>
<li>Güvenlik, dolandırıcılık önleme ve hizmetin iyileştirilmesi.</li>
<li>Açık rızanız varsa kampanya ve ticari elektronik ileti.</li>
</ul>

<h2>4. Hukuki Sebepler (KVKK m.5)</h2>
<p>Sözleşmenin ifası, hukuki yükümlülük, meşru menfaat ve açık rıza. Özel nitelikli veri kural olarak işlenmez.</p>

<h2>5. Aktarımlar</h2>
<ul>
<li>Kargo / lojistik firmaları (teslimat için),</li>
<li>Ödeme kuruluşları (tahsilat için),</li>
<li>Altyapı sağlayıcılar (Rahatio, hosting, e-posta),</li>
<li>Yetkili kamu kurumları (talep halinde).</li>
</ul>
<p>Yurt dışına aktarım yalnızca KVKK m.9 şartlarıyla yapılır.</p>

<h2>6. Saklama</h2>
<p>Sipariş ve fatura kayıtları ilgili mevzuat (VUK, Tüketici mevzuatı) gereği en az 10 yıl saklanabilir; süre sonunda silinir / anonimleştirilir.</p>

<h2>7. Haklarınız (KVKK m.11)</h2>
<p>Öğrenme, erişme, düzeltme, silme/yok etme, itiraz ve zarar giderimi haklarınız için <strong>${store.email}</strong> üzerinden başvuru yapabilirsiniz. 30 gün içinde yanıtlanır.</p>

<h2>8. Çerezler</h2>
<p>Detay için <a href="/stores/${store.siteCode}/pages/cerez-politikasi">Çerez Politikası</a> sayfamıza bakın.</p>

<h2>9. İletişim</h2>
<p>E-posta: ${store.email} — Lütfen posta adresi ve telefonunuzu ekleyin.</p>
      `),
    ],
  },
  {
    slug: 'kvkk-aydinlatma-metni',
    title: 'KVKK Aydınlatma Metni',
    metaTitle: 'KVKK Aydınlatma Metni',
    metaDescription: '6698 sayılı Kanun kapsamında aydınlatma metni.',
    blocks: (store) => [
      noticeBlock(),
      heroBlock('KVKK Aydınlatma Metni', '6698 sayılı Kişisel Verilerin Korunması Kanunu m.10 uyarınca.'),
      textBlock(`
<h2>1. Veri Sorumlusu</h2>
<p>${store.name} — ${store.email} — https://rahatio.com.tr/stores/${store.siteCode}</p>
<p>[Unvan, adres, MERSİS, VKN, KEP bilgilerini ekleyin.]</p>

<h2>2. İşlenen Veri Kategorileri</h2>
<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;border-bottom:1px solid #e4e4e7;padding:6px">Kategori</th><th style="text-align:left;border-bottom:1px solid #e4e4e7;padding:6px">Örnek</th></tr></thead><tbody><tr><td style="padding:6px;border-bottom:1px solid #f4f4f5">Kimlik</td><td style="padding:6px;border-bottom:1px solid #f4f4f5">Ad soyad</td></tr><tr><td style="padding:6px;border-bottom:1px solid #f4f4f5">İletişim</td><td style="padding:6px;border-bottom:1px solid #f4f4f5">E-posta, telefon, adres</td></tr><tr><td style="padding:6px;border-bottom:1px solid #f4f4f5">Müşteri İşlem</td><td style="padding:6px;border-bottom:1px solid #f4f4f5">Sipariş, kargo, iade</td></tr><tr><td style="padding:6px;border-bottom:1px solid #f4f4f5">Finans</td><td style="padding:6px;border-bottom:1px solid #f4f4f5">Fatura bilgisi</td></tr><tr><td style="padding:6px">İşlem Güvenliği</td><td style="padding:6px">IP, log</td></tr></tbody></table>

<h2>3. İşleme Amaçları ve Hukuki Sebepler</h2>
<ul>
<li>Sözleşmenin kurulması/ifası (m.5/2-c),</li>
<li>Hukuki yükümlülük (m.5/2-ç),</li>
<li>Meşru menfaat (m.5/2-f),</li>
<li>Açık rıza (m.5/1) — ileti ve çerezlerde.</li>
</ul>

<h2>4. Toplama Yöntemi</h2>
<p>Web sitesi, üyelik formu, sipariş akışı, e-posta ve çerezler üzerinden elektronik ortamda.</p>

<h2>5. Aktarım</h2>
<p>Kargo, ödeme, altyapı (Rahatio) ve yetkili kurumlara m.8/m.9 şartlarıyla aktarılabilir.</p>

<h2>6. Haklarınız (m.11) ve Başvuru</h2>
<p>Haklarınız için ${store.email} adresine kimlik teyitli başvuru yapın. 30 gün içinde ücretsiz yanıtlanır. Kurul’a şikâyet hakkınız saklıdır.</p>
      `),
    ],
  },
  {
    slug: 'cerez-politikasi',
    title: 'Çerez Politikası',
    metaTitle: 'Çerez Politikası',
    metaDescription: 'Mağazamızda kullanılan çerez türleri ve tercih yönetimi.',
    blocks: (store) => [
      noticeBlock(),
      heroBlock('Çerez Politikası', 'Hangi çerezleri neden kullandığımız ve tercihleriniz.'),
      textBlock(`
<h2>1. Çerez Nedir?</h2>
<p>Tarayıcınıza kaydedilen küçük metin dosyalarıdır. Oturum çerezleri kapanınca silinir; kalıcılar süreleri dolana kadar kalır.</p>

<h2>2. Türler</h2>
<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;border-bottom:1px solid #e4e4e7;padding:6px">Tür</th><th style="text-align:left;border-bottom:1px solid #e4e4e7;padding:6px">Örnek</th><th style="text-align:left;border-bottom:1px solid #e4e4e7;padding:6px">Süre</th></tr></thead><tbody><tr><td style="padding:6px;border-bottom:1px solid #f4f4f5">Zorunlu</td><td style="padding:6px;border-bottom:1px solid #f4f4f5">Sepet, oturum</td><td style="padding:6px;border-bottom:1px solid #f4f4f5">Oturum / 30 gün</td></tr><tr><td style="padding:6px;border-bottom:1px solid #f4f4f5">İşlevsel</td><td style="padding:6px;border-bottom:1px solid #f4f4f5">Dil, tema</td><td style="padding:6px;border-bottom:1px solid #f4f4f5">1 yıl</td></tr><tr><td style="padding:6px;border-bottom:1px solid #f4f4f5">Analitik</td><td style="padding:6px;border-bottom:1px solid #f4f4f5">_ga, _gid (onaylı)</td><td style="padding:6px;border-bottom:1px solid #f4f4f5">13 ay</td></tr><tr><td style="padding:6px">Pazarlama</td><td style="padding:6px">Pixel (onaylı)</td><td style="padding:6px">180 gün</td></tr></tbody></table>

<h2>3. Yönetim</h2>
<ul>
<li>Tarayıcı ayarlarından silebilir / engelleyebilirsiniz; zorunlu çerezler engellenirse sepet ve giriş çalışmayabilir.</li>
<li>Analitik/pazarlama çerezleri için onayınızı her zaman geri çekebilirsiniz.</li>
</ul>
<p>İletişim: ${store.email}</p>
      `),
    ],
  },
  {
    slug: 'kullanim-sartlari',
    title: 'Kullanım Şartları',
    metaTitle: 'Kullanım Şartları',
    metaDescription: 'Mağaza kullanım şartları ve müşteri yükümlülükleri.',
    blocks: (store) => [
      noticeBlock(),
      heroBlock('Kullanım Şartları', `${store.name} mağazasını kullanarak bu şartları kabul edersiniz.`),
      textBlock(`
<h2>1. Taraflar</h2>
<p>Satıcı: <strong>${store.name}</strong> — ${store.email} — https://rahatio.com.tr/stores/${store.siteCode} — [Unvan, adres, telefon, MERSİS ekleyin]</p>
<p>Alıcı: Mağazadan alışveriş yapan gerçek/tüzel kişi.</p>

<h2>2. Hizmet</h2>
<p>Mağaza üzerinden ürün satışı ve teslimatı. Ürün bilgileri, fiyat ve stoklar sipariş anındaki gibidir; yazım hataları halinde sipariş iptal edilebilir.</p>

<h2>3. Hesap</h2>
<p>Bilgilerinizin doğruluğundan siz sorumlusunuz. Hesabınızın güvenliğini sağlayın.</p>

<h2>4. Fikri Mülkiyet</h2>
<p>Site içeriği ve görseller Mağaza’ya aittir; izinsiz kopyalanamaz.</p>

<h2>5. Sorumluluk</h2>
<p>Mağaza, ayıplı ürün ve mevzuattan doğan yükümlülükleri yerine getirir. Mücbir sebep halleri saklıdır.</p>

<h2>6. Uyuşmazlık</h2>
<p>Tüketici işlemlerinde Alıcının yerleşim yerindeki Tüketici Hakem Heyeti/Mahkemesi yetkilidir.</p>
      `),
    ],
  },
  {
    slug: 'mesafeli-satis-sozlesmesi',
    title: 'Mesafeli Satış Sözleşmesi',
    metaTitle: 'Mesafeli Satış Sözleşmesi',
    metaDescription: '6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği kapsamında sözleşme.',
    blocks: (store) => [
      noticeBlock(),
      heroBlock('Mesafeli Satış Sözleşmesi', '6502 sayılı Kanun ve Yönetmelik uyarınca.'),
      textBlock(`
<h2>1. Taraflar</h2>
<p><strong>Satıcı:</strong> ${store.name} — [Unvan, adres, telefon, e-posta, MERSİS, VKN, KEP ekleyin] — E-posta: ${store.email}</p>
<p><strong>Alıcı:</strong> Siparişteki ad soyad / unvan ve adres bilgisi.</p>
<p><strong>Platform:</strong> Rahatio altyapısı üzerinden yayın yapan mağaza.</p>

<h2>2. Konu</h2>
<p>Alıcının elektronik ortamda sipariş verdiği ürün/ürünlerin satışı ve teslimi.</p>

<h2>3. Ürün, Bedel ve Ödeme</h2>
<ul>
<li>Ürün adı, miktarı, fiyatı ve vergiler sipariş özetinde ve e-postada yer alır.</li>
<li>Ödeme: paneldeki yöntemlerle (kredi kartı, havale vb.) tahsil edilir.</li>
<li>Fatura Alıcı adına düzenlenir.</li>
</ul>

<h2>4. Teslimat</h2>
<p>Teslimat, Mesafeli Sözleşmeler Yönetmeliği’ndeki 30 günlük azami süreyi aşamaz. Kargo firması ve takip numarası Alıcıya bildirilir. Kargo ücreti aksi belirtilmedikçe Alıcıya aittir; kampanyada Satıcı karşılayabilir.</p>

<h2>5. Cayma Hakkı</h2>
<p>Alıcı (tüketici ise) teslimden itibaren <strong>14 gün</strong> içinde hiçbir gerekçe göstermeden cayabilir. Cayma bildirimi e-posta veya panel mesajıyla yapılabilir. İstisnalar (m.15): kişiye özel üretilen, çabuk bozulabilen, ambalajı açılmış hijyen/kozmetik, dijital içerik (ifa başladıysa) vb. ürünlerde cayma yoktur.</p>
<p>Cayma halinde ürün, tüm aksesuar ve faturayla birlikte Satıcıya gönderilir; bedel 14 gün içinde iade edilir. Kargo masrafı caymada Alıcıya aittir (ayıplı üründe Satıcıya aittir).</p>

<h2>6. Ayıplı Mal</h2>
<p>6502 sayılı Kanun m.8 vd. hükümleri uygulanır; Alıcı ücretsiz onarım, değişim, bedel iadesi veya ayıp oranında indirim isteyebilir.</p>

<h2>7. Uyuşmazlık</h2>
<p>Tüketici işlemlerinde Alıcının yerleşim yerindeki Tüketici Hakem Heyeti / Mahkemesi yetkilidir.</p>

<h2>8. Ön Bilgilendirme Onayı</h2>
<p>Alıcı, siparişi onaylayarak Ön Bilgilendirme Formu’nu okuduğunu beyan eder. Form ve sözleşme e-postaya gönderilir.</p>
      `),
    ],
  },
  {
    slug: 'on-bilgilendirme-formu',
    title: 'Ön Bilgilendirme Formu',
    metaTitle: 'Ön Bilgilendirme Formu',
    metaDescription: 'Mesafeli satış öncesi bilgilendirme formu.',
    blocks: (store) => [
      noticeBlock(),
      heroBlock('Ön Bilgilendirme Formu', 'Sipariş öncesi 6502 sayılı Kanun gereği bilgilendirme.'),
      textBlock(`
<h2>1. Satıcı Bilgileri</h2>
<p>${store.name} — ${store.email} — https://rahatio.com.tr/stores/${store.siteCode} — [Adres, telefon, MERSİS, VKN, KEP ekleyin]</p>

<h2>2. Ürün Bilgileri</h2>
<p>Ürünün temel nitelikleri, fiyatı, vergileri, kargo ücreti ödeme adımında ve sipariş özetinde sunulur.</p>

<h2>3. Ödeme ve Teslimat</h2>
<ul>
<li>Ödeme yöntemleri: panelde sunulan yöntemler.</li>
<li>Teslim süresi: en geç 30 gün; stokta yoksa Alıcı bilgilendirilir.</li>
<li>Kargo firması ve süresi ürün/kampanyaya göre değişir.</li>
</ul>

<h2>4. Cayma ve İade</h2>
<p>14 gün cayma hakkı ve istisnalar için Mesafeli Satış Sözleşmesi’ne bakın. İade adresi: [Satıcı iade adresini ekleyin].</p>

<h2>5. Şikayet ve Uyuşmazlık</h2>
<p>Destek: ${store.email} — Tüketici Hakem Heyetleri / Mahkemeleri yetkilidir. ALO 175.</p>

<p style="margin-top:16px;padding:12px;background:#f4f4f5;border-radius:8px;font-size:12px"><em>Alıcı bu formu okuyup onayladıktan sonra sipariş tamamlanır. Formun bir nüshası e-postanıza gönderilir.</em></p>
      `),
    ],
  },
  {
    slug: 'teslimat-ve-kargo',
    title: 'Teslimat ve Kargo',
    metaTitle: 'Teslimat ve Kargo Bilgileri',
    metaDescription: 'Kargo süreleri, ücretleri ve teslimat koşulları.',
    blocks: (store) => [
      noticeBlock(),
      heroBlock('Teslimat ve Kargo', 'Siparişiniz nasıl ve ne zaman teslim edilir.'),
      textBlock(`
<h2>1. Hazırlık Süresi</h2>
<p>Siparişler [1-3] iş günü içinde kargoya verilir. Stokta olmayan veya tedarik sürecinde olan ürünlerde süre uzayabilir; Alıcı bilgilendirilir.</p>

<h2>2. Kargo Firmaları</h2>
<p>[Anlaşmalı kargo firmalarını ekleyin: Yurtiçi, Aras, MNG, PTT vb.] — Takip numarası kargoya verildiğinde SMS/e-posta ile iletilir.</p>

<h2>3. Kargo Ücretleri</h2>
<ul>
<li>[X] TL ve üzeri siparişlerde kargo ücretsiz; altında [Y] TL kargo ücreti Alıcıya aittir — kendi tutarlarınızı yazın.</li>
<li>Kampanyalar ürün kartında belirtilir.</li>
</ul>

<h2>4. Teslimat</h2>
<p>Yönetmelik gereği en geç 30 gün içinde teslim edilir. Alıcı kargoyu teslim alırken kontrol etmeli; hasar varsa tutanak tutturmalıdır.</p>

<h2>5. Gecikme ve İptal</h2>
<p>30 günü aşan gecikmede Alıcı sözleşmeyi feshedebilir ve bedel iadesi isteyebilir.</p>

<p>İletişim: ${store.email}</p>
      `),
    ],
  },
  {
    slug: 'iade-ve-degisim',
    title: 'İade ve Değişim',
    metaTitle: 'İade ve Değişim Koşulları',
    metaDescription: '14 gün cayma, ayıplı ürün ve iade süreçleri.',
    blocks: (store) => [
      noticeBlock(),
      heroBlock('İade ve Değişim', 'Cayma hakkı, ayıplı mal ve iade adımları.'),
      textBlock(`
<h2>1. 14 Gün Cayma Hakkı</h2>
<p>Tüketici Alıcı, teslimden itibaren 14 gün içinde cayabilir. Ürün kullanılmamış, etiketleri üzerinde ve orijinal ambalajında Satıcıya gönderilmelidir. Cayma bildirimi ${store.email} üzerinden yazılı yapılabilir.</p>

<h2>2. Cayma İstisnaları (Yönetmelik m.15)</h2>
<ul>
<li>Kişiye özel üretilen ürünler,</li>
<li>Çabuk bozulabilen / son kullanma tarihli ürünler,</li>
<li>Ambalajı açılmış sağlık/hijyen ürünleri,</li>
<li>Dijital içerikler (ifa başladıysa) — bu ürünlerde cayma yoktur.</li>
</ul>

<h2>3. Ayıplı Üründe Haklar (TKHK m.11)</h2>
<p>Ücretsiz onarım, değişim, bedel iadesi veya ayıp oranında indirim isteyebilirsiniz. Ayıplı üründe kargo Satıcıya aittir.</p>

<h2>4. İade Adımları</h2>
<ol>
<li>${store.email} veya panel üzerinden iade talebi oluşturun.</li>
<li>Onay sonrası ürünleri faturası ve aksesuarlarıyla birlikte [İade adresinizi ekleyin] adresine gönderin.</li>
<li>Kontrol sonrası bedel, ödeme yönteminize 14 gün içinde iade edilir (banka süresi hariç).</li>
</ol>

<h2>5. Değişim</h2>
<p>Değişim talepleri stok durumuna göre karşılanır; mümkün değilse iade yapılır.</p>

<h2>6. İletişim</h2>
<p>${store.email} — [Telefon ve adres ekleyin]</p>
      `),
    ],
  },
];

export async function seedLegalPagesForStore(
  storeId: number,
  store: { name: string; email: string; siteCode: string },
): Promise<{ pagesCreated: number; menusCreated: number }> {
  const existingPages = await Page.findAll({ where: { storeId } });
  const existingSlugs = new Set(existingPages.map((p) => (p as any).slug as string));

  let pagesCreated = 0;
  const createdPageIdsBySlug = new Map<string, number>();

  // Existing ids by slug for menu linking (if page already existed, use its id)
  const pageIdBySlug = new Map<string, number>();
  for (const p of existingPages) pageIdBySlug.set((p as any).slug, (p as any).id as number);

  for (const tpl of STORE_LEGAL_TEMPLATES) {
    if (existingSlugs.has(tpl.slug)) continue;
    const blocks = tpl.blocks(store);
    const page = await Page.create({
      storeId,
      slug: tpl.slug,
      title: { tr: tpl.title } as any,
      content: blocks as any,
      meta: { title: tpl.metaTitle, description: tpl.metaDescription } as any,
      isActive: true,
    } as any);
    const id = (page as any).id as number;
    createdPageIdsBySlug.set(tpl.slug, id);
    pageIdBySlug.set(tpl.slug, id);
    pagesCreated++;
    logger.info(`Seeded legal page ${tpl.slug} for store ${storeId}`);
  }

  // Ensure footer menus exist; if none, create two-column footer menus
  const existingMenus = await StoreMenu.findAll({ where: { storeId, location: 'footer' } });
  if (existingMenus.length > 0) {
    return { pagesCreated, menusCreated: 0 };
  }

  function pageItem(slug: string, label: string): any {
    const pid = pageIdBySlug.get(slug);
    if (!pid) return null;
    return { id: `item_${slug}`, label, page_id: pid, children: [] };
  }

  const kurumsalItems = [
    pageItem('gizlilik-politikasi', 'Gizlilik Politikası'),
    pageItem('kvkk-aydinlatma-metni', 'KVKK Aydınlatma Metni'),
    pageItem('cerez-politikasi', 'Çerez Politikası'),
    pageItem('kullanim-sartlari', 'Kullanım Şartları'),
  ].filter(Boolean);

  const sozlesmeItems = [
    pageItem('mesafeli-satis-sozlesmesi', 'Mesafeli Satış Sözleşmesi'),
    pageItem('on-bilgilendirme-formu', 'Ön Bilgilendirme Formu'),
    pageItem('teslimat-ve-kargo', 'Teslimat ve Kargo'),
    pageItem('iade-ve-degisim', 'İade ve Değişim'),
  ].filter(Boolean);

  let menusCreated = 0;
  if (kurumsalItems.length) {
    await StoreMenu.create({
      storeId,
      name: 'Kurumsal',
      slug: 'footer-kurumsal',
      location: 'footer',
      items: kurumsalItems as any,
      isActive: true,
    } as any);
    menusCreated++;
  }
  if (sozlesmeItems.length) {
    await StoreMenu.create({
      storeId,
      name: 'Sözleşmeler & Kargo',
      slug: 'footer-sozlesmeler',
      location: 'footer',
      items: sozlesmeItems as any,
      isActive: true,
    } as any);
    menusCreated++;
  }
  if (menusCreated) logger.info(`Seeded ${menusCreated} footer menus for store ${storeId}`);

  return { pagesCreated, menusCreated };
}
