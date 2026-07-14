# Rahatio Monorepo - AGENTS.md

## Genel Bilgi

Monorepo: `rr` (Rahatio)
GitHub: `https://github.com/asbajans/rr`
Portainer Stack: `rahatio-stack` (ID: 66)
Portainer API: `https://cont.asb.web.tr` (Endpoint 2, X-API-Key auth)
Portainer Webhook: `d6050fb9-2679-4422-902f-916da4785ca6`
Domain: `rahatio.com.tr` → Cloudflare proxied → Portainer sunucu

## Proje Tanımı

Rahatio, **AI destekli e-ticaret SaaS platformu**. Shopify benzeri ama:
- AI ile ürün görseli düzenleme (background removal, ComfyUI)
- AI ile ürün açıklaması/metin oluşturma (LLM pipeline)
- Pazaryeri entegrasyonu (Trendyol, Hepsiburada)
- Multi-tenant: her müşteri kendi domain'inde mağaza açar
- İki deployment modeli: Hosted (SaaS) veya Self-hosted (Slave)

## Mimari

```
rahatio.com.tr            → Landing page (SEO) + Admin panel (Next.js)
api.rahatio.com.tr        → Backend API (Laravel + Aimeos headless)
*.customer.com            → Müşteri mağazaları (Next.js SSG veya Slave)
```

### Servisler

| Dizin | Teknoloji | Görev | Port |
|-------|-----------|-------|------|
| `core-engine/` | Laravel 10 + Aimeos 2023.10 | Backend API, multi-tenant, auth, AI gateway | 3680 |
| `ai-service/` | Node.js + Express + Socket.io | AI görsel işleme, ComfyUI, LLM pipeline | 3630 |
| `integration-service/` | Node.js + BullMQ + Redis | Trendyol/HB entegrasyonu, FCM push | 3631 |
| `frontend/` | Next.js 16.2.10 (React) | Landing page + Admin panel (store owner + super admin) | 3690 |
| `slave/` | PHP + Node.js | Self-hosted store node (PHP shared hosting / Vercel serverless) | — |
| `mobile-app/` | React Native (planlanan) | Mobil store management | — |

## Önemli Değerler

- **Seeded API Key:** `rahatio-api-key` (SHA256 hash ile DB'de saklanır)
- **Webhook URL:** `https://cont.asb.web.tr/api/webhooks/d6050fb9-2679-4422-902f-916da4785ca6`
- **Seeded Store site_code:** `platform` (domain: rahatio.com.tr) ve `default`
- **GitHub Secret** `PORTAINER_WEBHOOK_URL` yeni webhook ile güncellendi

## Veritabanı

### Mevcut Tablolar (Laravel)
- `stores` — id, name, site_code, domain, email, is_active
- `api_keys` — id, store_id, key (sha256), name, allowed_ips, expires_at, last_used_at
- `users` — id, store_id, name, email, password, ai_credits, fcm_token
- `dropshipping_orders` — marketplace, vendor_id, items, totals

### Aimeos Tabloları (~100 tablo)
- `mshop_product`, `mshop_product_list`, `mshop_price`, `mshop_stock`
- `mshop_order`, `mshop_order_base`, `mshop_order_product`
- `mshop_customer`, `mshop_customer_list`
- `mshop_coupon`, `mshop_discount`, `mshop_tax`
- `mshop_locale`, `mshop_site`, `mshop_text`
- `mshop_media`, `mshop_attribute`, vb.

### Eklenecek Tablolar
- `plans` — Abonelik paketleri (Free, Basic, Pro, Enterprise)
- `subscriptions` — Store → Plan eşleşmesi, billing döngüsü
- `store_settings` — Tema, para birimi, vergi, kargo ayarları
- `media` — CDN'deki dosyaların referansı
- `slave_nodes` — Self-hosted slave kayıtları, son heartbeat
- `product_b2b_settings` — Ürün B2B ayarları (is_b2b_enabled, b2b_discount, b2b_price)
- `b2b_requests` — B2B talep yönetimi (from_store, to_store, product_id, status)
- `b2b_listed_products` — B2B ile klonlanmış ürünler (store, original_store, product_id, original_product_id)
- `categories` — Evrensel kategori ağacı (parent_id, slug, name, translations, sort_order)
- `marketplace_category_mappings` — Kategori → pazar yeri eşleme (category_id, marketplace, marketplace_category_id)
- `variations` — Varyasyon tanımları (store_id, name, type)
- `variation_options` — Varyasyon seçenekleri (variation_id, value, sort_order)
- `product_variants` — Ürün varyantları (product_id, sku, price, stock, attributes)
- `external_feeds` — XML/CSV/XLSX/JSON dış kaynak feed (URL, auth, mapping, pricing, autoSync)
- `feed_sync_logs` — Feed senkron log (feed_id, store_id, status, summary)

## Docker Port Haritası

| Container | Internal | External |
|-----------|----------|----------|
| rahatio-mysql | 3306 | 3606 |
| rahatio-redis | 6379 | 3679 |
| rahatio-minio | 9000/9001 | 3701 (console) |
| rahatio-core (nginx) | 80 | 3680 (`NGINX_PORT`) |
| rahatio-ai | 3000 | 3630 |
| rahatio-integration | 3001 | 3631 |
| rahatio-frontend (Next.js) | 3000 | 3690 (`FRONTEND_PORT`) |

### Docker Compose Volumes
- `mysql_data` → `/var/lib/mysql` (persistent) — Portainer'da stack prefix ile `rahatio-stack_mysql_data`
- `minio_data` → `/data` (MinIO S3 depolama)

## Geliştirme Fazları

### Phase 0 — Acil Düzeltmeler ✅ **TAMAM**
- [x] docker-compose.yml hostname/port fix (`rahat-integration` → `rahatio-integration`)
- [x] Integration service PORT env düzeltildi (3001)
- [x] config/mail.php + config/queue.php oluşturuldu
- [x] display_errors Off (php.ini + www.conf)
- [x] stores seed: `rahatio.com.tr` domain'li platform kaydı
- [x] entrypoint'e `db:seed` eklendi
- [x] CORS whitelist (config/cors.php) — platform domain'leri
- [x] ValidatePostSize kaldırıldı (Laravel 10'da yok)
- [x] Aimeos route override — shop.routes.home/default false
- [x] web.php RouteServiceProvider — web middleware grubu
- [x] TrustHosts — rahatio.com.tr host allowlist + APP_URL
- [x] API catch-all fix — api.php web.php'den önce yüklenir
- [x] fix-orders komutu — null invoiceno → NOT NULL
- [x] Portainer env fix — Integration/AI URL, Redis password, vs.

### Phase 1 — SaaS Frontend (Next.js) ✅ **TAMAM**
#### ✅ Tamamlananlar
- [x] frontend/ projesi oluşturuldu (Next.js 16.2.10 + TypeScript + Tailwind CSS)
- [x] Landing page: `/`, `/pricing`, `/features`, `/blog` (statik)
- [x] Auth pages: `/login`, `/register` (useAuth hook hazır)
- [x] Dashboard layout (sidebar nav, auth guard, logout)
- [x] Super admin layout (dark sidebar, auth guard)
- [x] Store admin sayfaları: dashboard, products, orders, ai, settings (statik)
- [x] Super admin sayfaları: stores, users, plans (statik)
- [x] Dockerfile (multi-stage, Next.js standalone)
- [x] Docker Compose frontend servisi (port 3690)
- [x] CI/CD frontend build job
- [x] Production deploy (6 container ayakta)

#### ✅ Tamamlananlar
- [x] Auth API entegrasyonu (api-client.ts + auth.tsx fix, auth/me is_admin)
- [x] Products page — Admin ProductController + UI (Aimeos JSON API)
- [x] Orders page — Admin OrderController + UI (Aimeos order list)
- [x] AI page — görsel yükleme + AI işleme (AiGatewayController)
- [x] Settings page — mağaza ayarları CRUD
- [x] Super admin: Stores CRUD (Admin StoreController)
- [x] Super admin: Users CRUD (Admin UserController)
- [x] Super admin: Plans CRUD (Admin PlanController)

### Phase 2 — Store Frontend + CDN ✅ **TAMAM**
- [x] Public store API endpoint (`/api/store/{siteCode}`)
- [x] Store frontend page (`/store/[siteCode]` catalog + product detail)
- [x] MinIO entegrasyonu (S3 depolama, API proxy ile serve)
- [x] Nginx `client_max_body_size` fix
- [x] Product CRUD with image upload (Aimeos media linking)
- [x] Multi-tenant domain routing (Next.js proxy.ts → `/api/resolve-domain`)

### Phase 3 — Billing + Subscription ✅ **TAMAM**
- [x] Subscriptions migration (store_id, plan_id, stripe_id, status, trial/ends/renews dates)
- [x] Subscription model (isActive, isOnTrial, isExpired, isCanceled helper methods)
- [x] Store model update (subscription, subscriptions, productCount, canCreateProduct relationships)
- [x] stripe/stripe-php installed
- [x] SubscriptionController: index, checkout (Stripe session or free), portal, cancel, webhook
- [x] Plan limit check in ProductController::store (product count limit)
- [x] Frontend billing page (`/billing`) with plan grid, current plan info, cancel/portal buttons
- [x] Billing link in dashboard sidebar
- [x] Seeder: free subscription for default store, owner test user
- [x] Aimeos JSON API prefix fixed (api → jsonapi, routing conflict resolved)

### Phase 4 — Slave Node ✅ **TAMAM**
- [x] **PHP Slave** (`slave/php/slave.php`): tek dosya, sıfır bağımlılık, HMAC auth, JSON cache, tüm REST endpoint'ler
- [x] **Vercel Slave** (`slave/vercel/`): Node.js serverless, vercel.json, aynı endpoint'ler
- [x] Her iki slave'de config panelden indirirken otomatik doldurulur (API key, HMAC secret, store code)
- [x] **Core download endpoint**: `GET /api/admin/slave/download-php` + `GET /api/admin/slave/download-vercel` (ZIP)
- [x] **SlaveDownloadController**: `injectConfig()` — PHP (`$_RAHATIO_CONFIG = [...]`) / JS (`const CONFIG = {...}`) otomatik tespit
- [x] `var_export` kullanılır PHP için (geçersiz `json_encode` `{}` syntax yerine geçerli PHP `[]` array)
- [x] `ensureSlaveApiKey()` her indirişte yeni `slv-xxx` key üretir, `plain_text` her zaman mevcut
- [x] Template'ler Docker build context'te: `core-engine/resources/templates/slave/{php,vercel}/`
- [x] **Frontend** settings sayfasında slave indirme UI'ı (PHP + Vercel butonları)
- [x] AuthenticateWithApiKey HMAC doğrulama desteği
- [x] **Doğrulama**: PHP download 200 + geçerli PHP config, Vercel ZIP 200 + 4750 bytes

### Phase 7A — Kayıtta Otomatik Store Oluşturma ✅ **TAMAM**
- [x] `AuthController::register()` — otomatik Store oluşturma, varsayılan plan ata, store_id set
- [x] `AuthController::me()` — store bilgisi döndür
- [x] Frontend Register: store_name alanı eklendi
- [x] Frontend api-client: register store_name parametresi
- [x] Frontend auth.tsx: register store_name parametresi
- [x] Mobile Register: store_name alanı eklendi
- [x] Mobile api-client: register store_name parametresi
- [x] Mobile auth.tsx: register store_name parametresi
- [x] Types: AuthResponse store alanı eklendi (web + mobile)
- [x] AGENTS.md: Phase 7A planı eklendi

### Phase 8 — Ürün Yönetimi (Products) Geliştirmeleri ✅ **TAMAM**
- [x] **Sayfalama + per-page**: `ProductController::index` server-side `page`/`per_page` (per_page=`all` desteklenir) → `{data,total,page,per_page,last_page}`. Frontend sayfa + adet seçici (10/25/50/100/500/Tümü).
- [x] **Toplu silme**: `POST /api/admin/products/bulk-delete` (corresponding route + `deleteAdminProductsBulk` api-client). Frontend çoklu seçim (checkbox + tümünü seç) + "Seçilenleri Sil".
- [x] **Toplu AI üretimi**: Modal ile sırayla (queue) açıklama/başlık/tüm içerik üretimi. `generateProductDescription({field:'description'|'title'})`. 3 seçenek: **Açıklama**, **Başlık**, **Tüm içeriği oluştur** (her ikisini de yazar).
- [x] **Sabit/kırpılmış kolonlar**: ID, Kod, Görsel, Başlık, Fiyat, Stok, Pazaryerleri, Marka, Kategori, Durum (badge), İşlemler. Dikey kaydırma, başlık sabit.
- [x] **Durum (status) düzeltmesi**: Liste badge'i ve filtre artık ürünün global `status` alanını kullanır (eski hatalı `marketplace_data.status` yerine). `activeCount` de `status`'a göre.
- [x] **Pazaryeri başına kategori/marka**: Modal'da her pazaryeri için ayrı kategori + marka alanı. "Kendi Sitem" → evrensel `/api/admin/categories/flat`; diğerleri → `GET /api/admin/integrations/marketplace-trees` (özyinelemeli ağaç, `marketplace_category_id` ile seçim). `saveMarketplaceData` artık `category_id` + `status` saklar.
- [x] **Çoklu görsel editörü (modal)**: En az 6 URL alanı (otomatik 6'ya tamamlanır, eklendikçe büyür). Tüm pazaryeri görselleri (`product.images`) listelenir, canlı önizleme + "Sil".
- [x] **Bilgisayardan görsel yükleme**: Modalda "Bilgisayardan yükle" (çoklu dosya). `POST /api/admin/upload` → MinIO'ya `stores/{store_id}/products/{uuid}.ext` yoluna kaydeder; dönen relative URL `API_BASE` ile mutlak yapılır (`api.uploadImage` wrapper). Görsel URL'leri `product.images`'e eklenir.
- [x] **Görsel başına AI düzenleme**: Her görsel satırında "AI Düzenle" → talimat prompt'u → `editProductImage({image_urls:[url],prompt,category})` → `getAiStatus` poll → `getAiOutputUrl` → `uploadImage` ile yeniden yükle → ilgili görseli değiştir.
- [x] **Sağlam import (AimeosProductImporter)**: `label`≤255, `code`≤64 truncate; fiyat/medya/metin/stok için `clearLists`/`clearProperties` ile dedup; alan başına `try/catch`; başarısız ürünler job'u düşürmez. Hata mesajları entegrasyon sayfasında gösterilir.
- [x] **Görsel cap**: `media_urls` yazma sınırı 6 → **12** yükseltildi (validasyon `max:12` ile uyumlu).
- [x] Backend `ProductController::productDetails` tüm media listesini `images[]` olarak döndürür (tüm pazaryeri görselleri).
- [x] `MediaController::upload` zaten per-store MinIO'ya yazar; `/api/media/{path}` public serve route'u mevcut (storefront `<img>` için cross-origin çalışır).
- [x] Test token: `64|Mu0KQpeVoy81EiNc3bF4EcvlSppCTkOE79bPeVwNc139b1e5` (owner@test.com). Deploy: Portainer stack 66 `PUT /api/stacks/66?endpointId=2` (git redeploy).
- [x] AGENTS.md: Phase 8 planı eklendi

### Phase 6H — AI Özellikleri Geliştirme ✅ **TAMAM**
- [x] AI service: `/ai/search` — semantic product search (Ollama ile doğal dil arama)
- [x] AI service: `/ai/recommend` — AI product recommendations (benzer/trending)
- [x] AI service: `/ai/chat` — AI customer support chat (Ollama LLM)
- [x] Core-engine: `AiGatewayController` search/recommend/chat/getStatus proxy methods
- [x] Routes: 4 yeni AI endpoint + status endpoint
- [x] Frontend: Store catalog sayfası → AI semantic search bar
- [x] Frontend: Store product detail → AI recommendations (Benzer Ürünler)
- [x] Frontend: AI Chat widget (store layout, floating button + chat window)
- [x] Frontend: Admin AI sayfası fix (response type)
- [x] AGENTS.md: Phase 6H planı eklendi

### Phase 6D — Harita & Konum ✅ **TAMAM**
- [x] Migration: `store_locations` (store_id, name, lat/lng, address, city, phone, working_hours, is_primary)
- [x] Model: `StoreLocation` (store relation, casts)
- [x] Controller: `StoreLocationController` (CRUD + public endpoint)
- [x] Routes: 4 admin location endpoint + 1 public endpoint
- [x] Frontend: Admin konum yönetimi (harita ile işaretleme, adres/çalışma saatleri formu, liste)
- [x] Frontend: Store mağazalar sayfası (Leaflet harita, marker, konum detayları)
- [x] Frontend: Sidebar'da Konumlar linki
- [x] AGENTS.md: Phase 6D planı eklendi

### Phase 6G — Sipariş Yönetimi ✅ **TAMAM**
- [x] Migration: `order_status_histories` + tracking fields on dropshipping_orders
- [x] Model: `DropshippingOrder` status workflow (pending→processing→shipped→delivered, cancelled, returned), transition validation
- [x] Model: `OrderStatusHistory` (order_id, from_status, to_status, note, user_id)
- [x] Controller: `OrderController` dropshipping CRUD, status update, tracking, history, stats
- [x] Routes: 6 order management endpoints
- [x] Frontend: Sipariş listesi (stat card filtreleme, durum badge, pazaryeri kolonu)
- [x] Frontend: Sipariş detay sayfası (durum güncelleme, kargo takibi, durum geçmişi timeline, müşteri/teslimat/ödeme bilgisi)
- [x] AGENTS.md: Phase 6G planı eklendi

### Phase 6F — Express Checkout ✅ **TAMAM**
- [x] Migration: `customer_addresses` (store_id, user_id, full_name, phone, country, city, district, zip, address_line, is_default)
- [x] Model: `CustomerAddress` (store relation, scopeForUser)
- [x] Controller: `CheckoutController` (address CRUD, checkout, paymentMethods)
- [x] Routes: 5 checkout/store endpoint (api.php)
- [x] Frontend: Cart context + localStorage persistence (lib/cart.tsx)
- [x] Frontend: Store product detail → Sepete Ekle + Hemen Al
- [x] Frontend: Store layout → sepet badge + header link
- [x] Frontend: Cart page (sepet görüntüleme, miktar değiştirme, silme)
- [x] Frontend: Checkout page (adres seç/ekle, ödeme yöntemi, not, sipariş özeti, onay)
- [x] AGENTS.md: Phase 6F planı eklendi

### Phase 6C.2 — Amazon TR / N11 / Pazarama Entegrasyonları ✅ **TAMAM**
- [x] `factory.createIntegration()` 'e 3 yeni sağlayıcı eklendi (pazarama, n11, amazon)
- [x] **Pazarama**: OAuth2 client_credentials + REST `/product` (Trendyol-uyumlu alanlar)
- [x] **N11**: REST API (`appkey`/`appsecret` header). `GET /ms/product-query` (import, sayfalı), `POST /ms/product/tasks/product-create` (push), `POST /ms/product/tasks/price-stock-update` (stok/fiyat), `GET /cdn/categories` (kategori ağacı). `factory` + `defaultConfig` + `MarketplaceIntegration.fields` `appkey`/`appsecret` kullanır.
- [x] **Amazon TR**: SP-API + AWS SigV4 imzalama (`listings`/`catalog`) + LWA token
- [x] `core-engine MarketplaceIntegration.availableMarketplaces()` 3 yeni pazaryeri (alan etiketleri)
- [x] `MarketplaceIntegrationController.defaultConfig()` 3 yeni varsayılan config
- [x] `fast-xml-parser` bağımlılığı (N11 SOAP yanıtı)
- [x] Tümü `fetchProducts` → `AimeosProductImporter` → "Ürünleri İçe Aktar" butonu ile çalışır

### Phase 6C.1 — Pazaryeri Ürün İçe Aktarma ✅ **TAMAM**
- [x] `IntegrationInterface.fetchProducts(page)` abstract metod
- [x] Trendyol: `api.getProducts()` + `TrendyolIntegrationService.fetchProducts()` (content → ProductData)
- [x] Hepsiburada: `HepsiburadaIntegrationService` — REST (mpop.hepsiburada.com + listing-external.hepsiburada.com), Basic auth + `User-Agent: {MERCHANT_ID} - SelfIntegration`, `merchant_id` config gerekli; `fetchProducts` (listing), `sendProduct` (catalog import, trackingId + comma-decimal price), `updateStock`/`updatePrice` (listing PUT)
- [x] Pazarama: OAuth2 client_credentials + Bearer/APIKey; `fetchProducts` (`GET /product` page+1/size/approved), `sendProduct` (`POST /product/create` `{products:[...]}`, brandId/CategoryId GUID + `attributes:[{attributeId,attributeValueId}]` zorunlu), `updateStock` (`POST /product/updateStock-v2` `{items:[{code,stockCount}]}`), `updatePrice` (`POST /product/updatePrice-v2` `{items:[{code,listPrice,salePrice}]}`), `fetchCategories` (`GET /category/getCategoryTree`), `getCategoryAttributes` (`GET /category/getCategoryWithAttributes?Id=`). Batch sonucu `GET /product/getProductBatchResult?BatchRequestId=` (status 1/2/3)
- [x] `factory.createIntegration(marketplace, config)` — store config'ten integration örneği
- [x] integration-service: `POST /import/products` route (marketplace + config + maxPages → products)
- [x] core-engine: `AimeosProductImporter` servisi (create/update by SKU, price/stock/media/text)
- [x] core-engine: `MarketplaceIntegrationController::importProducts()` — integration-service'ten çekip Aimeos'a aktarır
- [x] Route: `POST /api/admin/integrations/{marketplace}/import`
- [x] Frontend: entegrasyon kartında "Ürünleri İçe Aktar" butonu + `api.importIntegrationProducts()`

### Phase 6C — Marketplace Entegrasyonları ✅ **TAMAM**
- [x] Migration: `marketplace_integrations` (store_id, marketplace, is_active, config JSON)
- [x] Model: `MarketplaceIntegration` (availableMarketplaces, store relation)
- [x] Controller: `MarketplaceIntegrationController` (list, update)
- [x] Routes: 3 marketplace integration endpoint (api.php: index, import, update) — 5 pazaryeri (trendyol, hepsiburada, pazarama, n11, amazon)
- [x] Frontend: Entegrasyon ayar sayfası (toggle + config form)
- [x] Frontend: Sidebar'da Pazaryeri linki
- [x] Update: `SendProductWebhook` listener sends store marketplace configs
- [x] AGENTS.md: Phase 6C planı eklendi

### Phase 6I — Ödeme Yöntemleri ✅ **TAMAM**
- [x] Migration: `store_payment_methods` (store_id, method, is_active, config JSON)
- [x] Model: `StorePaymentMethod` (availableMethods, store relation, casts)
- [x] Controller: `PaymentMethodController` (list, update, show, checkoutMethods)
- [x] Routes: 4 ödeme endpoint + 1 public checkout endpoint
- [x] Frontend: Ödeme yöntemleri ayar sayfası (toggle + config form)
- [x] Frontend: Sidebar'da Ödeme linki
- [x] AGENTS.md: Phase 6I planı eklendi

### Phase 6E — Varyasyon Sistemi ✅ **TAMAM**
- [x] Migration: `variations` (store_id, name, type), `variation_options` (variation_id, value, sort_order), `product_variants` (store_id, product_id, sku, price, stock, attributes, image)
- [x] Model: `Variation`, `VariationOption`, `ProductVariant`
- [x] Controller: `VariationController` (CRUD + variants CRUD)
- [x] Routes: 9 variation endpoint + 4 variant endpoint
- [x] Frontend: Varyasyon yönetim sayfası (ekle/düzenle/sil, seçenek ekle/kaldır)
- [x] Frontend: Sidebar'da Varyasyonlar linki
- [x] AGENTS.md: Phase 6E planı eklendi

### Phase 6J — XML Feed Sistemi ✅ **TAMAM**
- [x] Migration: `external_feeds` (URL, auth, format, mapping, pricing, autoSync)
- [x] Migration: `feed_sync_logs` (feed_id, status, started_at, completed_at, summary)
- [x] Model: `ExternalFeed` (fillable, casts, store/category/syncLogs relations)
- [x] Model: `FeedSyncLog` (feed/store relations)
- [x] Controller: `FeedController` (CRUD, test → curl + parse preview, sync → fetch + parse + Aimeos import)
- [x] Controller: `parseFeed()` — XML, CSV, JSON (XLSX stub)
- [x] Controller: `importProducts()` — field mapping, Aimeos product/price/stock/media/text oluşturma
- [x] Routes: 8 feed endpoint (api.php)
- [x] Frontend: Feed listesi sayfası (+ düzenle/sil/senkron düğmeleri)
- [x] Frontend: Feed detay/wizard sayfası (4 adım: URL+Auth, Fiyat, Eşleme, Senkron)
- [x] Frontend: Feed test sonucu görüntüleme + senkron geçmişi
- [x] Frontend: Sidebar'da XML Feed bağlantısı
- [x] AGENTS.md: Phase 6J planı eklendi

### Phase 6B — Evrensel Kategori Sistemi ✅ **TAMAM**
- [x] Migration: `categories` (parent_id, slug, name, translations, icon, sort_order, is_active)
- [x] Migration: `marketplace_category_mappings` (category_id, marketplace, marketplace_category_id, name, parent_id)
- [x] Model: `Category` (self-referencing parent/children, `tree()` helper)
- [x] Model: `MarketplaceCategoryMapping`
- [x] Controller: `CategoryController` (CRUD, tree, flat, marketplace mappings)
- [x] Routes: 11 category endpoint (api.php)
- [x] Frontend: Super admin kategori ağacı sayfası (ekle/düzenle/sil, alt kategori, expand/collapse)
- [x] Frontend: Kategori detay sayfası + pazar yeri eşleme yönetimi
- [x] Frontend: Super admin sidebar'da Kategoriler linki
- [x] AGENTS.md: Phase 6B planı eklendi

### Phase 6A — Multi-Vendor / B2B "Beatby" ✅ **TAMAM**
- [x] Migration: `product_b2b_settings` (store_id, product_id, is_b2b_enabled, b2b_discount, b2b_price)
- [x] Migration: `b2b_requests` (from_store_id, to_store_id, product_id, status, note)
- [x] Migration: `b2b_listed_products` (store_id, original_store_id, product_id, original_product_id, b2b_request_id)
- [x] Model: `ProductB2bSetting` (Eloquent, store_id + product_id unique)
- [x] Model: `B2bRequest` (Eloquent, pending/approved/rejected)
- [x] Model: `B2bListedProduct` (Eloquent, clone tracking)
- [x] Controller: `B2bController` (discover, settings CRUD, requests CRUD, clone)
- [x] Routes: 9 B2B endpoint (api.php)
- [x] Backend: Ürün detayında B2B alanları (discount badge, B2B price)
- [x] Frontend: B2B keşfet sayfası (discover, detail modal, request)
- [x] Frontend: B2B talep sayfası (incoming/outgoing tabs, onay/red/klon)
- [x] Frontend: Ürün düzenleme modal'ında B2B ayarları (toggle + indirim/fiyat)
- [x] Frontend: Sidebar'da B2B linkleri (Keşfet + Talepler)
- [x] AGENTS.md: Phase 6A planı eklendi

### Phase 5 — Mobile App ✅ **TAMAM** (İskelet)
- [x] **Expo SDK 54** projesi (`mobile-app/`) — Expo Router file-based routing
- [x] **shared/ paket** (`mobile-app/src/shared/`): types (frontend ile senkron), api-client (RN: SecureStore/AsyncStorage, FileSystem), auth context, utils
- [x] **Auth screens**: `(auth)/login.tsx`, `(auth)/register.tsx` — auth guard, redirect
- [x] **Store owner panel** (bottom tabs): Dashboard (istatistikler, store bilgisi), Products (list view), Orders, AI (ImagePicker + process), Settings (store adı, logout)
- [x] **Super admin panel** (dark theme tabs): Stores, Users, Plans list view
- [x] **AI Görsel** — expo-image-picker ile seçim, FormData upload, sonuç görüntüleme
- [x] **AGENTS.md** — Expo/RN kuralları, route yapısı, önemli farklar (frontend vs mobile)

## API Routes

### Public (no auth)
| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/` | Landing page (HTML) |
| GET | `/health` | Health check |
| POST | `/api/auth/register` | Kullanıcı kaydı |
| POST | `/api/auth/login` | Kullanıcı girişi (Sanctum token döner) |
| POST | `/api/orders` | Sipariş oluşturma |

### Auth Required (auth:sanctum)
| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/api/auth/me` | Mevcut kullanıcı bilgisi |
| POST | `/api/auth/logout` | Oturum kapatma |
| POST | `/api/ai/process-image` | AI görsel işleme proxy |
| GET | `/api/admin/dashboard` | Dashboard istatistikleri |
| GET/POST | `/api/admin/stores` | Mağaza listesi / oluşturma |
| GET/PUT/DELETE | `/api/admin/stores/{id}` | Mağaza detay / güncelle / sil |
| GET | `/api/admin/users` | Kullanıcı listesi |
| GET/PUT/DELETE | `/api/admin/users/{id}` | Kullanıcı detay / güncelle / sil |
| GET/POST | `/api/admin/plans` | Plan listesi / oluşturma |
| GET/PUT/DELETE | `/api/admin/plans/{id}` | Plan detay / güncelle / sil |
| GET | `/api/admin/products` | Ürün listesi (Aimeos) |
| GET | `/api/admin/products/{id}` | Ürün detay |
| GET | `/api/admin/orders` | Sipariş listesi (Aimeos) |
| GET | `/api/admin/orders/{id}` | Sipariş detay |
| GET | `/api/admin/settings` | Mağaza ayarları |
| PUT | `/api/admin/settings` | Mağaza ayarlarını güncelle |
| GET | `/api/admin/slave/download-php` | PHP slave indir (config enjekte edilmiş) |
| GET | `/api/admin/slave/download-vercel` | Vercel slave ZIP indir |

### Category Routes (auth:sanctum, super admin)
| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/api/admin/categories` | Kategori listesi (parent → children nested) |
| GET | `/api/admin/categories/tree` | Tam ağaç (recursive) |
| GET | `/api/admin/categories/flat` | Düz liste (path ile) |
| POST | `/api/admin/categories` | Kategori oluştur |
| GET | `/api/admin/categories/{id}` | Kategori detay + çocuklar + mappings |
| PUT | `/api/admin/categories/{id}` | Kategori güncelle |
| DELETE | `/api/admin/categories/{id}` | Kategori sil |
| GET | `/api/admin/categories/{id}/mappings` | Pazar yeri eşlemeleri |
| POST | `/api/admin/categories/{id}/mappings` | Eşleme ekle/güncelle |
| DELETE | `/api/admin/categories/{id}/mappings/{marketplace}` | Eşleme sil |

### Variation Routes (auth:sanctum)
| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/api/admin/variations` | Varyasyon listesi (options ile) |
| POST | `/api/admin/variations` | Varyasyon oluştur |
| GET | `/api/admin/variations/{id}` | Varyasyon detay |
| PUT | `/api/admin/variations/{id}` | Varyasyon güncelle |
| DELETE | `/api/admin/variations/{id}` | Varyasyon sil |
| GET | `/api/admin/products/{pid}/variants` | Ürün varyantları |
| POST | `/api/admin/products/{pid}/variants` | Varyant oluştur |
| PUT | `/api/admin/products/{pid}/variants/{id}` | Varyant güncelle |
| DELETE | `/api/admin/products/{pid}/variants/{id}` | Varyant sil |

### Feed Routes (auth:sanctum)
| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/api/admin/feeds` | Feed listesi (store bazlı) |
| POST | `/api/admin/feeds` | Yeni feed oluştur |
| GET | `/api/admin/feeds/{id}` | Feed detay + sync logs |
| PUT | `/api/admin/feeds/{id}` | Feed güncelle |
| DELETE | `/api/admin/feeds/{id}` | Feed sil |
| POST | `/api/admin/feeds/{id}/test` | Test et (fetch + parse + preview) |
| POST | `/api/admin/feeds/{id}/sync` | Senkronize et (ürünleri Aimeos'a aktar) |
| GET | `/api/admin/feeds/{id}/logs` | Senkron geçmişi |

### B2B Routes (auth:sanctum)
| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/api/b2b/discover` | B2B ürün keşfet (diğer mağazaların B2B açık ürünleri) |
| GET | `/api/b2b/settings` | Kendi B2B ayarlarını listele |
| GET | `/api/b2b/settings/{productId}` | Tek ürün B2B ayarı |
| PUT | `/api/b2b/settings` | B2B ayarı güncelle/oluştur |
| GET | `/api/b2b/requests` | Talepleri listele (type=incoming\|outgoing, status=?) |
| POST | `/api/b2b/requests` | Talep oluştur |
| PUT | `/api/b2b/requests/{id}` | Talebi onayla/reddet (status=approved\|rejected) |
| POST | `/api/b2b/requests/{id}/clone` | Onaylanmış talepteki ürünü klonla |
| GET | `/api/b2b/listed` | Mağazandaki B2B klonlanmış ürünler |

### API Key Required (AuthenticateWithApiKey)
| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/api/products` | Ürün listesi |
| GET | `/api/products/{id}` | Ürün detay |
| POST | `/api/products/sync` | Ürün senkronizasyonu |
| GET | `/api/stocks/{sku}` | Stok sorgula |
| PUT | `/api/stocks/` | Stok güncelle |

## Frontend Route Yapısı

```
src/app/
├── (public)/              # Public routes (Navbar + Footer)
│   ├── page.tsx           # Landing (/)
│   ├── blog/page.tsx      # Blog (/blog)
│   ├── features/page.tsx  # Özellikler (/features)
│   ├── pricing/page.tsx   # Fiyatlandırma (/pricing)
│   ├── login/page.tsx     # Giriş (/login)
│   └── register/page.tsx  # Kayıt (/register)
├── (dashboard)/           # Store admin (sidebar + auth guard)
│   ├── dashboard/page.tsx # Dashboard (/dashboard)
│   ├── products/page.tsx  # Ürünler (/products)
│   ├── orders/page.tsx    # Siparişler (/orders)
│   ├── b2b/page.tsx       # B2B Keşfet (/b2b)
│   ├── b2b/requests/page.tsx # B2B Talepler (/b2b/requests)
│   ├── ai/page.tsx        # AI Görsel (/ai)
│   ├── feeds/page.tsx     # XML Feed Yönetimi (/feeds)
│   ├── feeds/[id]/page.tsx # Feed Detay/Wizard (/feeds/{id})
│   ├── payment/page.tsx   # Ödeme Yöntemleri (/payment)
│   └── settings/page.tsx  # Ayarlar (/settings)
├── (super)/               # Super admin (dark sidebar + auth guard)
│   ├── stores/page.tsx    # Mağazalar (/stores)
│   ├── users/page.tsx     # Kullanıcılar (/users)
│   ├── plans/page.tsx     # Planlar (/plans)
│   ├── categories/page.tsx # Kategoriler (/categories)
│   └── categories/[id]/page.tsx # Kategori detay + pazar yeri eşleme
└── layout.tsx             # Root layout (Geist font, globals)
```

## CI/CD

- Branch: `main`
- Workflow: `.github/workflows/deploy.yml`
- Path filter ile sadece değişen servis build edilir
- Docker Hub → Portainer webhook (`d6050fb9...`)
- **Slave** Go → PHP geçişi yapıldı, slave validate/build kaldırıldı (PHP node panelden indirilir)
- **Mobile** EAS Build ile APK/IPA üretilir (`expo/expo-github-action` + `eas build`)

### Gerekli GitHub Secrets
- `DOCKER_HUB_USERNAME` — `asbajans`
- `DOCKER_HUB_TOKEN`
- `PORTAINER_WEBHOOK_URL` — `https://cont.asb.web.tr/api/webhooks/d6050fb9-2679-4422-902f-916da4785ca6` (fallback only)
- `PORTAINER_API_KEY` — Portainer X-API-Key; used by CI to call `PUT /api/stacks/66/git/redeploy?endpointId=2` (REAL deploy — pulls latest compose from git + recreates). The generic webhook alone does NOT pull git, so this is required for deploys to take effect.
- `PAT_TOKEN` — GitHub PAT with `repo` + branch-protection bypass; lets CI pin changed service images to the commit SHA in `docker-compose.yml` (committed with `[skip ci]`) so each deploy pulls a fresh, never-cached image. Without it, CI falls back to `:latest` tags (may serve cached images).
- `EXPO_TOKEN` — Expo account token (EAS Build için)

## Kullanılan Aimeos Özellikleri

Aimeos headless backend olarak kullanılır, frontend sıfırdan yazılır.

| Özellik | Kullanım |
|---------|----------|
| JSON REST API | /jsonapi ile tüm CRUD (product, order, customer, stock, price, text, media) |
| GraphQL admin API | Store owner paneli için (admin UI değil, API olarak) |
| MShop::create() | Custom controller'larda manager factory |
| Context | Multi-tenant locale/site yönetimi |
| Subscription extension | Plan/abonelik yönetimi (eklenecek) |
| Payment extensions | Stripe, Iyzico, PayTR (eklenecek) |
| Tax manager | Vergi hesaplama |
| Coupon manager | İndirim/kupon sistemi |

## Pazaryeri Entegrasyonu — Teknik Detaylar

Pazaryeri entegrasyonu, harici pazaryerlerinden (Trendyol, Hepsiburada, Pazarama, N11, Amazon TR) ürün çekip Aimeos'a aktarır. Sipariş/stok geri-sync ve ürün push (createProduct/stock/price) altyapısı ayrıdır (bkz. orderSync/webhook). Bu bölüm **ürün içe aktarma (import)** hattını belgeler.

### Mimari Veri Akışı

```
[Frontend /integrations]  ──POST /api/admin/integrations/{marketplace}/import──▶  [core-engine]
                                                                                     │  MarketplaceIntegrationController::importProducts
                                                                                     │  MarketplaceImport kaydı (status=pending) + 202 döner
                                                                                     │  ImportMarketplaceProducts job'ı dispatch edilir (Redis queue)
                                                                                     ▼
                                                                        [core-engine worker: queue:work]
                                                                                     │  integration-service'e HTTP POST /import/products
                                                                                     ▼
                                                              [integration-service]  factory.createIntegration(marketplace, config)
                                                                                     │  IntegrationInterface.fetchProducts(page)  (sayfa sayfa)
                                                                                     │  her pazaryeri kendi api client + mapper'ı
                                                                                     ▼  {products:[ProductData...]}
                                                                        [core-engine worker]
                                                                                     │  AimeosProductImporter::import(store, products, marketplace)
                                                                                     │  → Aimeos product/price/stock/media/text + 'marketplaces' property
                                                                                     ▼
                                                                  MarketplaceImport.status='done', summary={imported,updated,failed,errors}
[Frontend]  ──GET /api/admin/integrations/{marketplace}/import/{id}──▶  polling ile durum/özet gösterilir
```

**Neden async?** Senkron import Cloudflare ücretsiz plan ~100s timeout'a takılıyordu (504). Bu yüzden import arka plan job'a alındı; frontend 3sn'de bir `importStatus` poll eder.

### Bileşenler

#### integration-service (Node.js + TypeScript, port 3631)
- `src/integrations/factory.ts` — `createIntegration(marketplace, config)`: store config'inden pazaryeri örneği üretir. 5 sağlayıcı: `trendyol`, `hepsiburada`, `pazarama`, `n11`, `amazon`.
- `src/integrations/IntegrationInterface.ts` — sözleşme: `fetchProducts(page): ProductData[]`, vb.
- `src/routes/import.ts` — `POST /import/products`: `{marketplace, config, maxPages}` alır; `maxPages` 1–50 (vars. 5) sayfa çeker, her sayfa 50 kayıt; `{marketplace, count, products}` döner. Hata → 502.
- **Trendyol** (`trendyol/api.ts` + `TrendyolIntegrationService.ts` + `mapper.ts`):
  - V1 client (`https://api.trendyol.com/sapigw`) → `createProduct`, `updateStock`, `updatePrice`, `getOrders`.
  - V2 client (`https://apigw.trendyol.com/integration/product`) → `GET /sellers/{supplierId}/products/approved` (onaylı ürünler). **Bu endpoint ürün listesi içindir.**
  - Auth: `Basic base64(apiKey:apiSecret)`, `User-Agent: "{supplierId} - SelfIntegration"` (zorunlu).
  - Rate limit: 100 istek/dk (enforceRateLimit), axios-retry 3x (429/5xx).
  - `mapper.ts`: Trendyol yanıtını `ProductData`'ya çevirir. `price`/`stock`/`images`/`description` birden çok olası alan yolundan okunur (defensive). İlk ham ürün `console.log('[trendyol] sample raw product[0]: …')` ile loglanır (alan eksikse teşhis için).
- **Hepsiburada / Pazarama / N11 / Amazon**: kendi `IntegrationService` + `mapper`'ları. Amazon AWS SigV4 + LWA token kullanır.

#### core-engine (Laravel + Aimeos)
- `app/Http/Controllers/Api/Admin/MarketplaceIntegrationController.php`:
  - `index` — `MarketplaceIntegration::availableMarketplaces()` ile tüm pazaryerlerini (label, is_active, config, fields) döner.
  - `update` — `updateOrCreate` ile store bazlı aktif/config kaydeder.
  - `importProducts($marketplace)` — aktif kontrolü, `MarketplaceImport` kaydı (status=`pending`), **`ImportMarketplaceProducts::dispatch($id)` → 202 `{id, marketplace, status}`**.
  - `importStatus($marketplace, $id)` — kaydın `status` / `summary` / `error` / `fetched` döner.
- `app/Models/MarketplaceImport.php` + migration `marketplace_imports` — import kaydı (`store_id, marketplace, config, max_pages, status, summary, error`).
- `app/Jobs/ImportMarketplaceProducts.php` — `ShouldQueue`, `$timeout=1800`. `INTEGRATION_SERVICE_URL` (env, vars. `http://rahatio-integration:3001`) + `/import/products`'e POST; dönen ürünleri `AimeosProductImporter::import()` ile işler; `summary['fetched']` ekler. Worker `supervisord` ile `php artisan queue:work redis` olarak çalışır.
- `app/Services/AimeosProductImporter.php` — `import(Store $store, array $records, string $source): array`. SKU'ya göre ürün oluşturur/günceller:
  - `price` → `price` manager + `product/lists` (domain=price)
  - `stock` → `product/property` (type=`stock`)
  - `image` → `media` + `product/lists` (domain=media)
  - `description`/`name` → `product` text (type=name/short/long)
  - **`marketplaces` property**: `product/property` type=`marketplaces`, değer `source` (örn. `trendyol`). Birden çok kaynak varsa virgülle birleşik.
  - **Durum**: `stock > 0` ise `status=1` (satışta), değilse `0`.
  - Dönüş: `{total, imported, updated, failed, errors[]}`.
- `app/Http/Controllers/Api/Admin/ProductController.php` — `index` ürün listesi. Artık `productDetails()` ile `price`/`stock`/`image` yükler (eski kod null'dı). **Filtreler** (query param): `marketplaces` (virgülle, `__none__` = pazaryeri yok), `status` (`1`=satışta, `0`=değil), `price_min`, `price_max`.

#### frontend (Next.js)
- `src/app/(dashboard)/integrations/page.tsx` — pazaryeri kartları (toggle + config form), "Ürünleri İçe Aktar" butonu → `api.importIntegrationProducts()` → 3sn'de bir `api.getMarketplaceImportStatus()` poll, özet gösterir.
- `src/app/(dashboard)/products/page.tsx` — ürün tablosu. Filtreler: **pazaryeri çoktan seçim** (chip'ler: Kendi Sitem / Trendyol / … / **Pazaryeri Yok**), **durum** (Tümü / Satışta / Satışta Değil), **fiyat min-max**. `api.getAdminProducts({marketplaces, status, priceMin, priceMax})`. "Satışta" = `stock > 0`. Boş pazaryeri = `marketplaces` boş (sentinel `__none__`).

### ProductData sözleşmesi (integration→core)
```ts
interface ProductData {
  id: string            // benzersiz (variantId/barcode/productMainId)
  sku: string           // stockCode/barcode
  name: string
  description?: string
  price: number         // TRY
  currency?: string
  stock: number
  barcode?: string
  images?: string[]     // URL'ler
  category?: string
  brand?: string
  attributes?: Record<string,string>
}
```

### Gerekli Ortam Değişkenleri (docker-compose)
- `INTEGRATION_SERVICE_URL` (core) → integration-service adresi
- `QUEUE_CONNECTION=redis` + `redis.default` config (core) — import job kuyruğu
- Trendyol: `TRENDYOL_API_KEY`, `TRENDYOL_API_SECRET`, `TRENDYOL_SUPPLIER_ID` (factory fallback; asıl config store'dan gelir)
- Hepsiburada: `HB_USERNAME`, `HB_PASSWORD`, `HB_MERCHANT_ID`
- `CORE_API_KEY` (integration→core iç sync'ler için)

### Teşhis / Bilinen Davranış
- **401 Unauthorized** → Trendyol API key/secret/supplierId hatalı (V2 `www-authenticate` logta).
- **Ürün geliyor ama fiyat/stok/görsel boş** → `integration-service` container logundaki `[trendyol] sample raw product[0]: …` satırı Trendyol'un gerçek yanıt şeklini gösterir; `mapper.ts` alan yolları buna göre güncellenir.
- Import job'u worker çalışmıyorsa takılır: `supervisord` `queue` programı `php artisan queue:work redis` çalıştırmalı (`config/database.php`'de `redis.default` tanımlı olmalı).
- `marketplaces` property Aimeos'ta virgülle ayrılmış tek bir `product/property` kaydıdır; boşsa hiç kayıt yazılmaz.

## Önemli Portainer Env

```
APP_ENV=production
APP_DEBUG=false
APP_KEY=                  # Entrypoint'te key:generate ile oluşturulur
NGINX_PORT=3680
MYSQL_ROOT_PASSWORD=change-me-root
MYSQL_DATABASE=rahatio
MYSQL_USER=rahatio
MYSQL_PASSWORD=change-me-db
REDIS_HOST=redis
REDIS_PASSWORD=           # Boş (null string değil)
REDIS_PORT=6379
INTEGRATION_SERVICE_URL=http://rahatio-integration:3001
AI_SERVICE_URL=http://rahatio-ai:3000
CORE_API_KEY=
TRENDYOL_API_KEY=         # Boş, doldurulacak
TRENDYOL_API_SECRET=      # Boş, doldurulacak
TRENDYOL_SUPPLIER_ID=     # Boş, doldurulacak
RAHAT_INTERNAL_KEY=change-me-internal-key
```

## Sık Karşılaşılan Sorunlar

### MySQL volume şifre sorunu
MySQL volume varsa env'deki şifreler yok sayılır. Volume silinip stack redeploy edilmeli:
```bash
DELETE /api/endpoints/2/docker/containers/rahatio-mysql?force=true
DELETE /api/endpoints/2/docker/volumes/rahatio-stack_mysql_data   # Stack prefix'li: compose'da `mysql_data`
PUT /api/stacks/66/git/redeploy?endpointId=2
```

### YAML indentation hatası
GitHub Actions'ta `dorny/paths-filter` altındaki tüm filtreler aynı hizada olmalı.

### Aimeos setup — `firstOrCreate` ile site_code
Seeder `firstOrCreate` kullanır, bu yüzden aynı site_code ile tekrar çalıştırılabilir.

### Slave config format — `injectConfig()`
- PHP template: `var_export()` kullan (geçerli PHP `[]` array syntax)
- JS template: `json_encode()` kullan (geçerli JS `{}` object syntax)
- Tespit: `str_contains($template, '$_RAHATIO_CONFIG')` ile PHP/JS ayrımı
- Template'de `// #CONFIG_START ... // #CONFIG_END` arası değiştirilir

### Slave API key — `ensureSlaveApiKey()`
- Her indirişte eski `slave-auto` key silinir, yenisi oluşturulur
- `plain_text` her zaman return edilir (Eloquent model dinamik property)
- Format: `slv-` prefix + 32 hex karakter

## Proje Yapısı (Full)

```
rr/
├── core-engine/               # Laravel 10 + Aimeos
│   ├── Dockerfile
│   ├── app/
│   │   ├── Console/
│   │   │   ├── Kernel.php
│   │   │   └── Commands/FixAimeosOrders.php
│   │   ├── Exceptions/Handler.php
│   │   ├── Http/
│   │   │   ├── Controllers/Api/
│   │   │   │   ├── AuthController.php
│   │   │   │   ├── B2bController.php
│   │   │   │   ├── OrderController.php
│   │   │   │   ├── AiGatewayController.php
│   │   │   │   ├── SlaveDownloadController.php
│   │   │   │   ├── Admin/CategoryController.php
│   │   │   │   ├── Admin/FeedController.php
│   │   │   │   ├── Admin/VariationController.php
│   │   │   │   └── WooCommerce/
│   │   │   │       ├── ProductController.php
│   │   │   │       └── StockController.php
│   │   │   └── Middleware/
│   │   │       ├── AuthenticateWithApiKey.php
│   │   │       ├── ResolveStoreFromDomain.php
│   │   │       └── TrustHosts.php
│   │   ├── Models/
│   │   │   ├── User.php
│   │   │   ├── Store.php
│   │   │   ├── ApiKey.php
│   │   │   ├── B2bRequest.php
│   │   │   ├── B2bListedProduct.php
│   │   │   ├── Category.php
│   │   │   ├── DropshippingOrder.php
│   │   │   ├── ExternalFeed.php
│   │   │   ├── FeedSyncLog.php
│   │   │   ├── MarketplaceCategoryMapping.php
│   │   │   ├── ProductB2bSetting.php
│   │   │   ├── ProductVariant.php
│   │   │   ├── Variation.php
│   │   │   └── VariationOption.php
│   │   ├── Providers/RouteServiceProvider.php
│   │   ├── Services/InternalKeyService.php
│   │   ├── Events/ (OrderReceived, ProductUpdated)
│   │   └── Listeners/ (SendProductWebhook, SplitOrderByVendor)
│   ├── config/
│   │   ├── aimeos.php
│   │   ├── shop.php
│   │   ├── app.php, auth.php, cache.php, cors.php
│   │   ├── database.php, filesystems.php, logging.php
│   │   ├── mail.php, queue.php
│   │   ├── sanctum.php, session.php, view.php
│   ├── database/
│   │   ├── migrations/ (7 adet: stores, api_keys, users, orders, vendor_id, sanctum, custom_columns)
│   │   └── seeders/DatabaseSeeder.php
│   ├── resources/
│   │   └── templates/slave/
│   │       ├── php/slave.php    # PHP slave template
│   │       └── vercel/
│   │           ├── api/index.js  # Vercel serverless handler
│   │           └── vercel.json   # Vercel config
│   ├── routes/api.php, web.php, console.php
│   └── docker/
│       ├── nginx/ (default.conf, nginx.conf)
│       └── php/ (entrypoint.sh, php.ini, www.conf, supervisord.conf)
│
├── frontend/                  # Next.js 16.2.10
│   ├── Dockerfile
│   ├── next.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── (public)/      # Public routes
│   │   │   ├── (dashboard)/   # Store admin
│   │   │   ├── (super)/       # Super admin
│   │   │   ├── layout.tsx     # Root layout
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── ui/button.tsx
│   │   │   └── landing/ (navbar.tsx, footer.tsx)
│   │   └── lib/
│   │       ├── api-client.ts  # API client + auth methods
│   │       ├── auth.tsx       # Auth context + hook
│   │       ├── types.ts       # TypeScript types
│   │       └── utils.ts       # cn() helper
│   └── AGENTS.md              # Next.js 16 kuralları
│
├── ai-service/                # Node.js + TypeScript
├── integration-service/       # Node.js + TypeScript
├── slave/                     # Slave node (PHP slave.php + Vercel api/)
│   ├── php/slave.php          # PHP tek dosya, sıfır bağımlılık
│   └── vercel/
│       ├── api/index.js       # Vercel serverless handler
│       └── vercel.json        # Vercel deploy config
├── mobile-app/                # React Native (Expo SDK 54)
│   ├── app.json
│   ├── package.json
│   ├── App.tsx
│   ├── app/                   # Expo Router (file-based)
│   │   ├── _layout.tsx
│   │   ├── (auth)/login.tsx
│   │   ├── (auth)/register.tsx
│   │   ├── (tabs)/index.tsx   # Dashboard
│   │   ├── (tabs)/products.tsx
│   │   ├── (tabs)/orders.tsx
│   │   ├── (tabs)/ai.tsx
│   │   ├── (tabs)/settings.tsx
│   │   ├── (super)/stores.tsx
│   │   ├── (super)/users.tsx
│   │   └── (super)/plans.tsx
│   ├── src/shared/
│   │   ├── types.ts
│   │   ├── api-client.ts
│   │   ├── auth.tsx
│   │   └── utils.ts
│   └── AGENTS.md
│
├── docker-compose.yml
├── .github/workflows/deploy.yml
├── .env.example
└── AGENTS.md
```

## Vaziyet Raporu & Eylem Planı (Denetim — 2026-07)

Kod denetimi sonucu tespit edilen eksiklik ve hatalar. Mimari sağlam, fazların çoğu gerçekten kodda; sorunlar ağırlıkla entegrasyon katmanında (frontend↔backend yol uyumsuzluğu, servisler arası config).

### 🔴 Kritik (çalışmayan özellikler)
- **A1 — Frontend AI yolları yanlış**: `frontend/src/lib/api-client.ts:251-280` `/api/admin/ai/*` çağırıyor; backend `routes/api.php:50-55` `/api/ai/*` altında. 6 metod 404. (admin AI, super-ai, store search/recommend, AiChat)
- **A2 — Sipariş route gölgeleme**: `routes/api.php:92` `admin/orders/{id}`, `:140` `/dropshipping` ve `:145` `/stats`'tan önce → gölgeliyor. Dropshipping listesi + stats ölü.
- **A3 — integration→core yanlış port**: `integration-service/src/services/orderSync.ts:9` `laravel-app:9000` kullanıyor; core nginx **80**'de. Sipariş senkronu başarısız.

### 🟡 Orta
- **B1 — Fiyat güncellemeleri düşüyor**: `integration-service/src/routes/webhook.ts:32-38` price.updated'ı queue'ya atıyor; `queues/workers.ts:46-54` yalnızca `updateStock()` çağırıp fiyatı yok sayıyor.
- **B2 — Hepsiburada push kablolanmamış**: ~~worker/webhook yalnız Trendyol; HB ürün/stok push ölü kod~~ → **ÇÖZÜLDÜ**: HB `sendProduct`/`updateStock`/`updatePrice` REST ile kablolandı (mpop + listing-external). Push worker'ın tüm pazaryerlerini kapsaması için `queues/workers.ts` güncellenecek (bkz. B1).
- **B3 — Eksik ComfyUI workflow**: `ai-service/src/services/comfyui.ts:16-18` `product-studio-dekorasyon.json` / `product-studio-spor.json` referans veriyor, `ai-service/workflows/` içinde yok.
- **C1 — mobile kurulum kırıcı**: `mobile-app/package.json` `typescript ~6.0.3` (yayınlanmamış) → CI install patlar. Ayrıca SDK 54 kullanımı, doküman "SDK 52" diyor.
- **C2 — Eksik compose env**: `laravel-app`'te `AI_SERVICE_URL`/`CORE_API_KEY`/`RAHAT_INTERNAL_KEY`, integration'da `CORE_API_KEY`/`HB_USERNAME`/`HB_PASSWORD` yok.

### 🟢 Düşük / Doküman kayması
- **D1** — `core-engine/app/Models/Store.php:46-49` `productCount()` sabit `return 0`.
- **D2** — `CheckPlanLimit` middleware kayıtlı değil, kullanılmıyor (ölü kod).
- **D3** — `.env.example` eksik; `NGINX_PORT=80` doküman 3680 ile çelişiyor; volume adı doküman `rahatio-stack_mysql_data` vs compose `mysql_data`; MinIO servisi dokümansız.
- **D4** — Frontend `getAdminProducts/Orders` düz `{data,total}` tipli; Aimeos JSON:API zarfı riski (boş liste).
- **D5** — `frontend/src/app/(public)/blog/page.tsx` statik stub; backend `pages` sistemine bağlı değil.

### Eylem Sırası
- **Aşama A (kritik)**: A1, A2, A3  ← şu an
- **Aşama B**: B1, B2, B3
- **Aşama C**: C1, C2, `.env.example` tamamla
- **Aşama D**: D1-D5 temizlik & doküman

> Not: Önceki denetimde "`users.total_credits_consumed` migration yok" bulgusu YANLIŞ — sütun `database/migrations/2025_07_09_000004_create_credit_logs_table.php:24`'te mevcut.
