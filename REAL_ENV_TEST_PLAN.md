# Rahatio Gerçek Ortam Test Planı

Bu doküman, staging veya production ortamında testlerin hangi sırayla ve hangi kontrollerle yapılacağını tanımlar. Testler tamamlanmadan canlı kullanıcı trafiği artırılmamalıdır.

## 1. Test kuralları

- Production testleri yalnızca test mağazası, test kullanıcıları ve test ürünleriyle yapılır.
- Gerçek müşteri, gerçek kart, gerçek sipariş ve gerçek kişisel veri kullanılmaz.
- Stripe, iyzico, PayTR ve pazaryeri sandbox hesapları tercih edilir.
- Test başlamadan önce veritabanı yedeği, deployment sürümü, migration sürümü ve rollback planı kaydedilir.
- Her test için tarih, kullanıcı, mağaza, ürün/sipariş ID’si, beklenen sonuç, gerçek sonuç ve ekran görüntüsü/log kaydı tutulur.
- Ödeme, stok, sipariş, marketplace listing ve AI kredisi testleri aynı test verisiyle karıştırılmaz; her senaryo ayrı veri kullanır.
- Secret, API key, access token, refresh token, kart numarası ve webhook imzası rapora yazılmaz.
- Başarısız testte aynı işlemi tekrar tekrar çalıştırmadan önce idempotency ve veri durumunu kontrol edin.

## 2. Test ortamı ön koşulları

- [ ] Sağlık endpoint’i 200 döner.
- [ ] PostgreSQL bağlantısı ve migration durumu kontrol edilir.
- [ ] Redis bağlantısı `PONG` döner.
- [ ] Core API, AI service ve integration service loglarında sürekli restart yoktur.
- [ ] Seed işlemi tekrar çalıştırıldığında duplicate kayıt üretmez.
- [ ] Test mağazası aktif bir plana ve yeterli ürün/AI kredisine sahiptir.
- [ ] Test kullanıcısı owner, admin ve staff yetkileriyle ayrı ayrı hazırlanır.
- [ ] Web alan adı, mobil API URL’i ve CORS ayarları doğrulanır.
- [ ] Vercel kullanılıyorsa `VERCEL_TOKEN` ve takım/project erişimi kontrol edilir; token rapora yazılmaz.
- [ ] Marketplace sandbox/deneme entegrasyonları bağlıdır.
- [ ] Stripe/iyzico/PayTR webhook URL’leri erişilebilir ve imza secret’ları doğru secret manager’dan gelir.

## 3. Kimlik doğrulama ve tenant izolasyonu

### Web ve mobil

- [ ] Kayıt, giriş, çıkış ve refresh token akışı çalışır.
- [ ] Süresi dolmuş access token ile API 401 döner ve kullanıcı güvenli şekilde girişe yönlenir.
- [ ] Başka mağazanın ID’si, ürün ID’si, sipariş ID’si veya draft ID’si kullanıldığında 404/403 döner.
- [ ] Owner/admin/staff yetkileri doğru ayrılır.
- [ ] Staff kullanıcı plan, billing, API key ve super admin ekranlarına erişemez.
- [ ] Mobil cold-start sonrası `/me` yanıtı doğru user/store/plan zarfıyla açılır.
- [ ] Dil seçimi web ve mobilde korunur; Türkçe karakterlerde bozulma olmaz.

### Rate limit ve güvenlik

- [ ] Login, register, checkout ve payment initiate rate limit’i tetiklenir.
- [ ] Honeypot alanı dolu checkout/register isteği reddedilir.
- [ ] CORS yalnızca izin verilen origin’lere açıktır.
- [ ] Yanlış API key, HMAC signature veya timestamp isteği reddedilir.
- [ ] API hata yanıtları secret, SQL, dosya yolu veya stack trace sızdırmaz.

## 4. Ürün, kategori ve varyasyon

- [ ] Ürün oluşturma, düzenleme, silme ve listeleme webde çalışır.
- [ ] Aynı işlemler mobilde çalışır.
- [ ] SKU benzersizliği ve zorunlu alan validasyonu çalışır.
- [ ] Görsel yükleme yalnızca izin verilen image MIME türleri ve boyutlarında kabul edilir.
- [ ] Kategori ağacı, alt kategori ve marketplace category mapping görüntülenir.
- [ ] Varyasyon, seçenek ve varyant stok/fiyat güncellemesi doğru ürüne yansır.
- [ ] Ürün araması SKU ve başlıkta çalışır.
- [ ] Ürün limiti dolduğunda yeni ürün, AI publish ve marketplace import işlemleri engellenir.
- [ ] B2B klon ürünler kendi ürünlerinden ayrı filtrelenir.
- [ ] SKU merge öncesi varyant, listing, B2B ve stok bilgilerinin birleşme sonucu kontrol edilir.

## 5. AI Product Studio

### Fotoğraf ve analiz

- [ ] Mobil kamera ile fotoğraf çekilir.
- [ ] Mobil galeriden fotoğraf seçilir.
- [ ] Web dosya yükleme çalışır.
- [ ] Büyük dosya, yanlış MIME ve bozuk dosya reddedilir.
- [ ] AI session `uploaded → analyzing → review` durumlarından geçer.
- [ ] Kuyruk gecikmesinde mobil/web polling sonsuz döngüye girmez.
- [ ] AI provider hatasında session `failed` olur ve kullanıcıya çözüm önerisi gösterilir.
- [ ] AI kredisi yetersizse kredi düşmez ve işlem başarılı görünmez.

### Taslak düzenleme

- [ ] Başlık, kısa açıklama, açıklama, kategori yolu, SKU, fiyat, stok, keyword, tag ve attributes düzenlenir.
- [ ] `alan: değer` formatındaki attributes doğru kaydedilir.
- [ ] Negatif fiyat, negatif stok, kesirli stok ve boş zorunlu alanlar engellenir.
- [ ] Taslak kaydı sonrası `userEditedFields` güncellenir.
- [ ] `converted` veya `publishing` taslak düzenlenemez.
- [ ] Onay yalnızca geçerli draft state’inde yapılır.

### Kanal doğrulama ve yayın

- [ ] Entegrasyon bağlı değilse kanal `integration-not-connected` döner.
- [ ] Kategori mapping yoksa `category-mapping-needed` döner.
- [ ] Eksik title/description/price/quantity/brand alanları listelenir.
- [ ] Her hata için kullanıcıya uygulanabilir çözüm önerisi gösterilir.
- [ ] Validation API yapılmadan doğrudan publish isteği gönderilse bile API işlemi engeller.
- [ ] Approved draft publish edildiğinde tek Product ve kanal başına tek Listing oluşur.
- [ ] Her kanal ayrı queue işi alır; bir kanal hatası diğer kanalları durdurmaz.
- [ ] Listing durumları `publishing`, `active`, `failed` ve retry sonrası tekrar izlenir.
- [ ] Retry yalnızca failed listing’leri yeniden kuyruğa alır.
- [ ] Aynı publish/retry isteği duplicate Product/Listing oluşturmaz.

## 6. Pazaryeri entegrasyonları

Her bağlı pazaryeri için aynı sıra uygulanır: Trendyol, Hepsiburada, Pazarama, N11, Amazon ve Etsy.

- [ ] Kategori ve marka eşlemesi yapılır.
- [ ] Ürün import edilir; görsel, SKU, fiyat, stok ve varyantlar kontrol edilir.
- [ ] Yeni ürün oluşturma/push çalışır.
- [ ] Mevcut ürün update edilir; ikinci push duplicate ürün oluşturmaz.
- [ ] Pazaryeri siparişi import edilir ve local order ile eşleşir.
- [ ] Sipariş durumu pazaryerinden local sisteme ve local sistemden pazaryerine senkronlanır.
- [ ] Stok/fiyat değişikliği doğru listing’e yansır.
- [ ] Kargo/tracking bilgisi gönderilir.
- [ ] Fatura/invoice URL veya desteklenen belge bilgisi kontrol edilir.
- [ ] İade/refund akışı kontrol edilir.
- [ ] API timeout, 401, rate limit ve geçersiz payload durumları loglanır ve retry davranışı kontrol edilir.
- [ ] Integration loglarında secret veya tam credential görünmez.

### Pazarama özel

- [ ] Yeni ürün batch işlemi başlatılır.
- [ ] Batch status polling tamamlanır.
- [ ] Ürün sonucu başarısızsa hata nedeni listing’e yazılır.
- [ ] Sipariş invoice/tracking/return işlemleri denenir.

### Etsy özel

- [ ] OAuth connect/callback çalışır.
- [ ] Listing create/update yapılır.
- [ ] Stok ve fiyat sync edilir.
- [ ] Shipment/tracking gönderilir.
- [ ] Etsy’nin etiket API’si desteklenmiyorsa kullanıcıya açıkça manuel işlem gerektiği gösterilir.

## 7. Storefront, checkout ve ödeme

- [ ] Mağaza yayınlanmamışken public ürün/checkout erişimi engellenir.
- [ ] Owner preview erişimi çalışır; normal ziyaretçi preview göremez.
- [ ] Tema, logo, favicon, renk, font ve custom CSS storefront’ta görünür.
- [ ] Ürün detay, sepet, checkout ve checkout sonucu mobil/webde çalışır.
- [ ] Checkout fiyatı istemciden alınmaz; server yeniden hesaplar.
- [ ] Stok rezervasyonu transaction ve row lock ile yapılır.
- [ ] Yetersiz stokta sipariş oluşmaz.
- [ ] Aynı order token tekrar kullanımı kontrol edilir.
- [ ] Anonim adres ekleme/listeleme/silme owner token ile sınırlandırılır.
- [ ] Stripe sandbox checkout tamamlanır.
- [ ] iyzico sandbox payment initialize/callback tamamlanır.
- [ ] PayTR sandbox token/callback tamamlanır.
- [ ] Başarılı ödeme stok düşer, rezervasyon bırakılır, order confirmed olur.
- [ ] Başarısız/iptal ödeme stok rezervasyonu cleanup ile bırakılır.
- [ ] Aynı webhook/event ikinci kez geldiğinde stok ve sipariş ikinci kez değişmez.
- [ ] Refund sonrası order/payment state ve stok iadesi doğru olur.
- [ ] Webhook imzası, ödeme tutarı ve currency yanlışsa işlem reddedilir.

## 8. B2B, dropshipping ve hakediş

- [ ] Tedarikçi profili oluşturulur ve güncellenir.
- [ ] B2B discover, request, approve/reject ve clone akışları çalışır.
- [ ] Klon üründe originalProductId/originalStoreId doğru tutulur.
- [ ] Original ürün fiyat/stok sync’i klona doğru uygulanır.
- [ ] Supplier order kabul, red ve ship state’leri doğru ilerler.
- [ ] Red durumunda klon stok rezervasyonu iade edilir.
- [ ] Ship durumunda tracking parent order’a yayılır.
- [ ] Parent order vendor sub-order’lara doğru bölünür.
- [ ] Komisyon, supplier earnings ve net settlement tutarları hesaplanır.
- [ ] Aynı dönem için duplicate settlement oluşmaz.
- [ ] İade sonrası stok, parent order ve settlement tutarları güncellenir.

## 9. Site yayınlama, Vercel ve slave

### Rahatio hosting

- [ ] Publish/unpublish/rollback webden çalışır.
- [ ] Deployment geçmişinde version, status, theme snapshot ve note görünür.
- [ ] Rollback doğru snapshot’ı geri yükler.

### Vercel managed deploy

- [ ] Plan hosting tipi Vercel olarak seçilir.
- [ ] Managed deploy project oluşturur veya mevcut project’i kullanır.
- [ ] Deployment `pending → ready` ilerler.
- [ ] Vercel URL’si panelde görünür.
- [ ] Vercel hata durumunda deployment `failed/error` olur ve hata kaydedilir.
- [ ] Aynı store için tekrar deploy yeni project üretmez.
- [ ] Custom domain eklenir.
- [ ] Vercel’in istediği DNS/TXT kayıtları panelde gösterilir.
- [ ] DNS doğrulanmadan domain aktif görünmez.
- [ ] DNS doğrulandıktan sonra provider URL ve domain bilgisi güncellenir.
- [ ] Cloudflare DNS üzerinde kayıtlar manuel girilerek doğrulama tamamlanır.

### Slave artifact

- [ ] Vercel artifact indirilebilir.
- [ ] ZIP içinde package.json, vercel.json ve API entrypoint bulunur.
- [ ] Artifact secret’ları loglara yazılmaz.
- [ ] PHP/Vercel slave ürün listeleyebilir.
- [ ] Slave ürün sync yapabilir.
- [ ] Slave sipariş alabilir.
- [ ] HMAC signature, timestamp ve idempotency kontrolleri çalışır.
- [ ] Eski API key revoke edildiğinde beklenen şekilde erişim kesilir.

## 10. Mobil uygulama

- [ ] Login/register/cold-start çalışır.
- [ ] Ürün, sipariş, B2B, supplier ve AI sekmeleri plan yetkilerine göre görünür.
- [ ] Kapatılmış modül placeholder tab oluşturmaz.
- [ ] Kamera, galeri, upload ve AI polling çalışır.
- [ ] Sipariş detay, tracking, invoice ve refund yetkileri doğru görünür.
- [ ] Mobilde Türkçe, İngilizce, Arapça, Rusça ve İspanyolca metinlerde bozuk karakter yoktur.
- [ ] Expo preview APK gerçek API URL’iyle açılır.
- [ ] Uygulama arka plana alınıp geri getirildiğinde auth/session bozulmaz.

## 11. Gözlemleme, rollback ve raporlama

- [ ] Core, AI ve integration loglarında correlation/store/order ID bulunur.
- [ ] Hata oranı, queue backlog, payment failure, marketplace failure ve AI failure metrikleri izlenir.
- [ ] Sentry/log alarmı test hatasını yakalar.
- [ ] Production migration dry-run yapılır.
- [ ] Son başarılı deployment’a rollback provası yapılır.
- [ ] Rollback sonrası health, login, storefront, checkout ve queue kontrolleri tekrarlanır.
- [ ] Her başarısız test için issue açılır; severity ve yeniden üretim adımları yazılır.
- [ ] Tüm kritik testler geçmeden release candidate onaylanmaz.

## 12. Müşteri hesabı ve ticari özellikler (Faz 10)

- Mağaza hesabı ile merchant paneli hesabının ayrı token kullandığını ve müşteri token'ının panel API'lerine erişemediğini doğrula.
- Aynı e-posta iki farklı mağazada kullanılabilmeli; aynı mağazada ikinci kayıt reddedilmeli.
- Kayıt, giriş, şifre sıfırlama, müşteri adresi, sipariş geçmişi ve misafir `orderToken` takibini kontrol et.
- Favori ekleme/silme, yorumun önce `pending`, onay sonrası storefront'ta görünmesi ve mağaza izolasyonunu doğrula.
- Kupon için tarih, minimum sepet, kullanım limiti, yüzde/sabit tutar ve maksimum indirim senaryolarını dene; toplamı backend hesaplamalıdır.
- Bildirim okunma durumu ve KVKK/marketing consent kayıtlarında sürüm, IP ve zaman alanlarını kontrol et.
- Fatura/kargo provider endpoint'lerinde bilinmeyen provider güvenli hata vermeli; gerçek provider sandbox testi ayrıca yapılmalıdır.

## 13. Test raporu şablonu

```text
Test ID:
Tarih/Saat:
Ortam ve deployment:
Test kullanıcısı/mağazası:
Ön koşullar:
Uygulanan adımlar:
Beklenen sonuç:
Gerçek sonuç:
İlgili ID'ler (store/order/product/listing/session):
Log veya ekran görüntüsü yolu:
Sonuç: PASS / FAIL / BLOCKED
Hata nedeni:
Rollback gerekli mi:
```
