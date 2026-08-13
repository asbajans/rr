# Rahatio Monorepo - AGENTS.md

## Genel Bilgi

Monorepo: `rr` (Rahatio)
GitHub: `https://github.com/asbajans/rr`
Portainer Stack: `rahatio-stack` (ID: 75)
Portainer API: `https://cont.asb.web.tr` (Endpoint 2, X-API-Key auth)
Portainer Webhook: `<stored-in-secret-manager>`
Domain: `rahatio.com.tr` → Cloudflare proxied → Portainer sunucu
Portainer API Key: `<stored-in-secret-manager; rotate existing key>`

---

# Work State (Session History)

## Tamamlananlar

### Otomatik Sipariş Çekimi + Sipariş Tarihi + Bildirim Sistemi (Web + Mobil + FCM) ✅
- [x] **Token süresi uzatıldı**: `core/src/config/env.ts` + `config/index.ts` → access `15m→30d`, refresh `7d→90d`.
- [x] **Checkout string→number**: `shared/dto/checkout.ts` `product_id`/`quantity`/`address_id` → `z.coerce.number()`; storefront checkout (`stores/[siteCode]/checkout/page.tsx`) payload Number(), `address_id: Number(selectedAddressId)`; api-client `getCheckoutPaymentMethods` `config` + `label` fallback; bank_transfer seçiliyken IBAN/banka/hesap sahibi kartı (backend `store/publicRoutes.ts` tam `StorePaymentMethod` döner).
- [x] **Sipariş tarihi (`orderDate`)**: `DropshippingOrder.model.ts`'e `orderDate DATE` kolonu; `server.ts` migrasyou `ADD COLUMN IF NOT EXISTS` + mevcut satırlara `orderDate=createdAt`; `orderSplit.ts` ana+alt sipariş create'lerine ve `createVendorSubOrders`'a orderDate; `order/routes.ts` liste `ORDER BY COALESCE(orderDate, createdAt) DESC`; web api-client `mapOrder` → `order_date` fallback zinciri; orders sayfasında Tarih kolonu (tr-TR).
- [x] **Pazarama/N11 durum normalizasyonu**: `modules/integration/orderImport.ts` (YENİ) — `normalizeMarketplaceStatus` (Pazarama 3=alındı/pending, 12=hazırlanıyor/processing, 5=kargoda/shipped, 11=teslim/delivered, 9=iptal/cancelled, 14/15=iade/returned), `extractOrderDate`, `mapPazaramaPackage`, `importMarketplaceOrders` (varsa update, yoksa `createSplitOrder(orderDate)` + bildirim), `importOrdersForAllStores`; eski `statusForPazarama` (integration/routes.ts) silindi, import-orders/import-all sarmalayıcıya çevrildi; webhook/order `orderDate` alıyor.
- [x] **Otomatik çekim**: `server.ts startServer` → 10 dakikada bir `importOrdersForAllStores({maxPages:3})` (interval `.unref()`).
- [x] **In-app bildirim sistemi**: `StoreNotification.model.ts` (storeId, userId, type, title, body, data JSONB, readAt) + `notification/service.ts` (`createStoreNotification`, `getFcmTokensForStore`, `sendPushToStore` — legacy FCM `fcm.googleapis.com/fcm/send`, `config.fcm.serverKey` yoksa skip, `notifyStore`) + `notification/routes.ts` (`GET /`, `GET /unread-count`, `POST /read-all`, `POST /:id/read`) → `/api/admin/notifications` mount; web: api-client'te 4 metot + `components/ui/notification-bell.tsx` (dropdown, unread rozeti, 30sn poll, tümünü/tek oku, sipariş linki) — sidebar altı + mobil header'da.
- [x] **Mobil push (FCM)**: `expo-notifications` + `expo-device` kuruldu (SDK 54); `src/shared/push.ts` (`getFcmToken` — `getDevicePushTokenAsync`, izin + Android kanalı); `api-client.registerFcmToken`; `auth.tsx` giriş/kayıt/soğuk başlatmada token'ı `POST /api/auth/fcm-token` ile kaydeder; `app/_layout.tsx` `setNotificationHandler` (foreground banner); `app.json`'a `expo-notifications` eklendi (+ duplicate RECORD_AUDIO temizlendi).
- [x] **FCM yol düzeltmesi**: integration-service `queues/index.ts:200` `/api/admin/users/fcm-tokens` → `/api/admin/integrations/fcm-tokens` (core `marketplace/routes.ts:526` birebir eşleşti, `{tokens}` döner).
- [x] **Orders sayfası sayfalama**: `PAGE_SIZE=20`, page/totalPages, filtre/tab/arama page reset, Önceki/Sonraki; yanıltıcı per-sayfa stat kartları kaldırıldı.
- [x] **Doğrulamalar**: core typecheck ✅ + test **54/54** ✅, shared typecheck+test 5/5 ✅, integration-service tsc ✅, frontend build ✅ (45 route), mobil `npx tsc --noEmit` ✅.

### Faz 6 — Storefront Checkout + Ödeme Gateway'leri (AGENTOPEN.md) ✅ (6A + 6B + 6C)
- [x] **Faz 6A — Checkout temeli**: `packages/shared/src/dto/checkout.ts` (zod: items sadece `product_id|sku`+`quantity`, `shipping_address`, `customer`, `payment_method`, `note`; fiyat istemciden gelmez). `packages/core/src/modules/order/checkout.ts` — `calculateTotals` (vergi included/excluded + kargo + freeAbove, saf fonksiyon), HMAC `orderToken` (7 gün, `config.apiKey.internalKey`, DB'de `orderTokenHash`), `createCheckoutOrder` (transaction + `SELECT FOR UPDATE` + `Product.reservedQuantity` rezervasyonu). `publicRoutes.ts` yeniden yazıldı: anonim checkout (401 düzeltildi), `GET /:siteCode/orders/:id?token=` token doğrulamalı. Yeni kolonlar: `paymentProvider`, `paymentRefId`, `paymentDetails`, `orderTokenHash`, `subtotal`, `shippingAmount`, `taxAmount` (+ boot migration). Frontend: `checkout()` yeni kontrat, `getOrderTracking()`, checkout sayfası yeni payload + email.
- [x] **Faz 6B — Gateway katmanı**: `packages/core/src/modules/payment/gateways/` — `PaymentGateway` arayüzü (`createPayment`/`parseWebhook`/`refund`) + `createGateway()` factory. **Stripe** = Checkout Session (redirect, metadata orderId; webhook `POST /:siteCode/payments/webhook/stripe` raw-body + `webhook_secret` imza; `checkout.session.completed` → `confirmPaidOrder`). **iyzico** (`iyzipay` paketi kuruldu) = `paymentPage.initialize` → `paymentPageUrl`; callback + redirect. **PayTR** = `get-token` REST + HMAC hash; `merchant_oid = RH{orderId}-{orderNumber}`; callback + redirect. `confirmPaidOrder()` idempotent (stok düşümü + rezervasyon boşaltma + history). `POST /:siteCode/payments/initiate` (orderToken doğrulamalı) → paymentUrl/clientToken. Admin `POST /api/admin/orders/:id/refund`. Frontend: `initiatePayment()`, `/stores/[siteCode]/checkout/result` sonuç sayfası (poll'luyor).
- [x] **Faz 6C — Güvenlik & frontend**: `express-rate-limit` — global `/api` (600/15dk) + strict `checkout`(10)/`payments/initiate`(10)/`auth/login`(20)/`auth/register`(10). Honeypot `website` (doluysa 400 Spam). **`CustomerAddress`** modeli + `GET|POST|PUT|DELETE /:siteCode/addresses` (ownerTokenHash anonim adres defteri); checkout `address_id` çözümleme. Order `cancelled`/`returned` → stok iadesi + otomatik gateway refund. Admin order sayfasına `paid` → "Para İadesi" butonu (`refundOrder`). Frontend checkout: adres listesi/kaydet/sil (localStorage token). Testler: honeypot + gateway factory eklendi — core **23/23** ✅.
- [x] **Faz 7A — Tedarikçi Domain Çekirdeği (Dropshipping)**: `Supplier` modeli (storeId unique, banka/komisyon/contractStatus) + `ensureSupplierForStore` (lazy, B2B onay/klon'da); supplier route'ları (`GET|PUT /supplier/profile`, `GET /suppliers` Tedarikçilerim, `GET /supplier/orders`); `Product.cost`/`ProductVariant.cost` + `DropshippingOrder.commissionRate|commissionAmount|supplierEarnings` + boot migration; `createSplitOrder` refactor (transaction, cost bazlı sub-order, `computeSettlement`, `createVendorSubOrders` helper); checkout + import-orders + import-all tedarikçi sub-order üretiyor. Core test **26/26** ✅.
- [x] **Faz 7B — Tedarikçi State Makinesi + Stok/Fiyat Sync**: `DropshippingOrder.supplierStatus` (`pending|accepted|rejected|fulfilled`); saf mantık `modules/supplier/fulfillment.ts` (`deriveParentStatus`, `latestSupplierTracking`, `toRestockMap`, `clonePatchFromOriginal`); fulfillment route'ları `POST /api/admin/supplier/orders/:id/accept|reject|ship` (red → alıcı klon stoğu iade, ship → tracking parent'a yayılır, `syncParentOrder`); orijinal→klon sync (`POST /products/:id/pull-from-original`, `POST /products/:id/push-to-clones`, `GET /products/:id/clones`). Split tutarlılığı tamam: slave `POST /orders` + internal `POST /dropshipping-orders` (`externalId`→`marketplaceOrderId` fix) + webhook worker `createSplitOrder`. Core test **35/35** ✅.
- [x] **Faz 7C — Hakediş + Tedarikçi Paneli**: `SupplierSettlement` modeli (dönem bazlı: `period`, `totalAmount`, `commissionAmount`, `netAmount`, `orderCount`, `status open|requested|paid`, unique `(storeId, period)`); `modules/supplier/settlement.ts` (`computeSettlementTotals`, `toSettlementLines`, `getFulfilledSubOrders`, `computePeriod`, `requestSettlement`); route'lar `GET /supplier/settlements`, `GET /supplier/settlements/period?period=YYYY-MM`, `POST /supplier/settlements/request|cancel|mark-paid`; iade `POST /supplier/orders/:id/return` (restock + parent sync). **Web panel**: `frontend/src/app/(dashboard)/supplier/page.tsx` + api-client'e 14 metot + nav `/supplier` (Truck) + 5 locale `supplier` anahtarı. **Mobil**: `app/(tabs)/supplier.tsx` (profil/sipariş/hakediş sekmeleri + ship Modal) + api-client tedarikçi metotları + `(tabs)/_layout.tsx` `supplier` sekmesi (car icon) + 5 locale `supplier*`/`saved`/`ok`. Core test **39/39** ✅.
- [x] **Faz 8A — Site Publish + Deployment Geçmişi + Tema Render**: `Store.published` (default true) + boot migration; **`SiteDeployment`** modeli (append-only geçmiş, `themeSnapshot` JSONB, status published|draft|reverted|failed, per-store version) + `Store.hasMany`; saf helper `modules/site/publish.ts` (testli) + route'lar `GET /api/admin/site/deployments`, `POST /publish|unpublish`, `POST /deployments/:id/rollback` (tema/siteCode/domain snapshot'tan geri yükler). **Draft gating**: storefront + public product/categories `published: true`, `?preview=1` owner önizleme; `published` me/auth/storefront response'larında. **Tema render**: `components/store/StoreTheme.tsx` CSS vars (`--sf-*`) + `custom_css` + favicon; `stores/layout.tsx` `data-storefront` + gating + "yayında değil" ekranı; storefront CTA'ları `sf-btn-primary`. site-builder: Yayınla/Yayından Kaldır + yayın notu + geçmiş tablosu + Geri Dön. Core test **42/42** ✅, frontend build ✅ (51 route).
- [x] **HOTFIX — `alias session` SequelizeAssociationError (boot crash)**: `associations.ts`'teki `AiProductDraft.belongsTo(..., { as: 'session' })` ile modeldeki `@BelongsTo(() => AiProductSession)` decorator'ü çakışıyordu (aynı alias iki kez). `associations.ts`'ten AI session/draft satırları kaldırıldı (routes association kullanmıyor, `sessionId`/`draftId` alanlarıyla çalışıyor); decorator'e `{ foreignKey: 'sessionId' }` eklendi. Doğrulama: 24 model + `setupAssociations()` crash'siz. Deploy başarılı ✅.
- [x] **Doğrulamalar**: core build ✅, core typecheck ✅, core test 19/19 ✅ (4 dosya), shared test 5/5 ✅, frontend build ✅ (48 route). `iyzipay` core'a eklendi (pnpm).

### AI Product Studio — Faz 0–5 (AGENTOPEN.md) ✅
- [x] **Faz 0 — `packages/shared` workspace**: `@rahatio/shared` (zod ^3.25.76) + `dto/ai.ts` (AiProductSession/Draft/Channel DTO'ları), `dto/product.ts`, `schema/ai-response.ts` (zod schema + `parseAiResponse` + `AiResponseValidationError`), 5 vitest testi. Core'a workspace dep; `deductCredits` transaction'a alındı; `validateAiAnalysisResponse` (422 `AI_RESPONSE_INVALID`); upload MIME filtresi (image/*, 10MB).
- [x] **Faz 1 — Session/Draft modelleri**: `AiProductSession.model.ts` + `AiProductDraft.model.ts` (database/index/associations kayıtları), migrations `20`+`21`, boot-time safe migration, `draftRoutes.ts` (product-sessions CRUD + status, product-drafts list/get/put/approve/validate-channels/delete). `draftRoutes.ts`'ten export: `deductCredits`, `logAiUsage`, `resolveScenarioConfig`, `buildProviderPayload`, `AI_TIMEOUT_MS`.
- [x] **Faz 2 — Yapılandırılmış AI çıktısı**: `agenticListing.ts` (`category_candidates`, `warnings`, `confidence`, marka/fiyat/stok uydurma yasağı + sağlık/kozmetik/gıda iddiası yasağı), `aiResponse.ts` normalizer, proxy'de `validateStructured`, 3 test.
- [x] **Faz 3 — Kanal gereksinimleri**: `channelRequirements.ts` (`CHANNEL_RULES`, `validateDraftForChannels` → `ready|integration-not-connected|category-mapping-needed|missing-fields`), `POST /product-drafts/:id/validate-channels`, `GET /categories/search` + `GET /categories/:id/channel-requirements`.
- [x] **Faz 4 — Mobile wizard**: `mobile-app` tipler + api-client metotları (session/draft/validate/publish), `ai.tsx` → 3 adımlı AI Product Studio (foto → taslak → kanallar; **kamera galeri bug'ı düzeltildi** — `pickImage('camera')` galeri açıyordu), `npx tsc --noEmit` ✅, 5 dilde 50+ yeni i18n anahtarı.
- [x] **Faz 5 — Yayın orkestrasyonu**: `ProductMarketplaceListing` genişletildi (`channel`, `payloadSnapshot` JSONB, `retryCount`, `lastAttemptAt`); `AiProductDraft.productId` eklendi (idempotent draft→product); migrations `22`+`23` + boot-time safe migrations; `publishRoutes.ts` (`POST /product-drafts/:id/publish` transaction + per-channel job, `POST /:id/publish/retry`, `GET /:id/publish`); `publication-queue` BullMQ + `createPublicationWorker()` (storefront + marketplace channel işleri, kanal izolasyonu, externalId kaydı, retryCount/lastAttemptAt). Kanal başına hata diğerlerini durdurmaz. Core build + shared test + mobile tsc ✅.
- [x] **Faz 5 web (frontend)** — `frontend/src/lib/api-client.ts`'e 10 AI Studio metodu (session/draft/validate/publish/retry/state); `layout.tsx`'e `/ai/studio` nav (Wand2) + 5 locale'e `aiStudio` anahtarı; `frontend/src/app/(dashboard)/ai/studio/page.tsx` — fotoğraf → AI taslağı → kanal doğrulama → yayın + retry akışı, kredi/ürün-limit gate modalları, listing durumu; frontend `npm run build` ✅ (45 route)

### Landing Page Rebuild (Dark, market-launch-ai.lovable.app klonu) ✅
- [x] **`frontend/src/app/(marketing)/page.tsx` + `layout.tsx`** — dark tema landing (`/`); eski `(public)/page.tsx` silindi; auth flow'lar korunur (Panel/Giriş/Kayıt/Pricing)
- [x] **`components/landing/landing-page.tsx`** — Header (EN/TR/ES dil switcher + auth linkleri), Hero, How it works, Features, Marketplaces, Solutions, Pricing, FinalCTA, Footer
- [x] **`components/landing/landing-ai-demo.tsx`** — referansla birebir animasyonlu telefon mockup (2600ms step cycle, progress card, terminal ticker, marketplace chip'leri, corner-bracket focus frame)
- [x] **`components/landing/landing-marquee.tsx`** — çift yönlü marquee şeritleri (40s, bir ters yönde)
- [x] **`lib/landing-content.ts`** — EN/TR/ES kopyalar (başlangıç dili EN; referans TR idi, bilinçli sapma)
- [x] **`globals.css`** — `.landing` scoped dark tokens (oklch, teal primary `oklch(78% .16 178)`, amber accent), grid-lines, text-gradient, bg-hero-glow, marquee/float/ticker-y/pulse-ring/scanline/fade-in keyframes + `prefers-reduced-motion` fallback
- [x] **`layout.tsx`** — Space_Grotesk / DM_Sans / JetBrains_Mono font değişkenleri (`--font-display`, `--font-landing-sans`, `--font-landing-mono`)
- [x] Pricing CTA: girişli → `/billing`, değilse → `/register`; Enterprise → `mailto:hello@rahatio.com.tr`
- [x] **Doğrulamalar** — `npm run build` ✅ (42 route, 0 hata), prod sunucu testi `/`+`/login`+`/register`+`/pricing`+`/dashboard` 200 ✅, lint 0 error ✅, SSR HTML tüm bölümler render ediliyor ✅

### Blog Sistemi + Storefront Hero (Blog + Hero) ✅
- [x] **Backend model** — `BlogPost` (ContentModels.ts: storeId, slug, title, excerpt, content, coverImage, status `draft|published`, tags, publishedAt, authorName, productId→Product link, featured, viewCount, metaTitle/metaDescription/contentFormat, hero fields) + `Store.hasMany(BlogPost)`; `homepage` JSONB (heading, subtitle, button_text/button_url, image_url, youtube_url, overlay_opacity, min_height, enabled, type) Store.model + boot safe migration (`ADD COLUMN` + `CREATE TABLE IF NOT EXISTS` server.ts)
- [x] **Admin API** — `modules/blog/routes.ts` (`/api/admin/blog`): CRUD + search/pagination, publish|unpublish, featured, delete; POST `/generate` AI önerisi (`blog_generation` modül gate + `deductCredits` + `resolveScenarioConfig('agentic_listing')` + `buildProviderPayload` + AiUsageLog + AI_TIMEOUT_MS), öneri `draft` olarak kaydedilir; POST `/reviews/:id/restore` sönümü taslaktan geri yükler; `homepage` toggle `PUT /:siteCode/homepage`. Plan: `blog` + `blog_generation` MODULE_DEFINITIONS'e eklendi (access.ts)
- [x] **Public API** — publicRoutes.ts: `GET /api/store/:siteCode/blog` (published + publishedAt, search/kategori/sayfalama) + `GET /api/store/:siteCode/blog/:slug`, `GET /api/store/:siteCode/homepage`; blog içeriğinde Map yerine düz JSON döner
- [x] **ai-service blog writer** — `services/blogWriter.ts` + `POST /ai/blog-post`: agentic_listing senaryosundan provider/model, structured `BlogPostResponse` (blogPost zod schema) doğrulaması, marka uydurma yasağı
- [x] **Storefront** — `app/stores/[siteCode]/blog` (liste + hero CTA) + `app/stores/[siteCode]/blog/[slug]` (artikel); `components/store/StoreHero.tsx` — image (overlay %/CTA) veya youtube embed, `homepage.enabled` kapalıysa render etmez; `stores/layout.tsx` Blog nav linki (Newspaper); home page hero kullanır
- [x] **Admin UI** — `(dashboard)/blog-posts/page.tsx` (liste/search/yayınla/featured/AI üret/geri yükle/ürün bağla/kapak yükle/sil); api-client 10 metot (getBlogs/getAdminBlog/createBlog/updateBlog/deleteBlog/publishBlog/generateBlogPost/restoreBlogDraft/setFeatured/getHomepage/updateHomepage); i18n `blog*`+`homepage*` anahtarları 5 dilde; route çakışması: marketing `/blog` ile çakışmaması için mount `/blog-posts`
- [x] **site-builder Hero editor** — homepage state + load/updateHomepage/handleHeroUpload; save/publish/deploy payload'a homepage dahil; Editor UI (enable toggle, type image/youtube, height, youtube URL, görsel URL + upload, overlay slider, heading/subtitle/button text/link); super admin plan kartında homepage snapshot
- [x] **Doğrulamalar** — core build ✅, core typecheck ✅, core test 54/54 ✅, ai-service build+typecheck ✅, frontend `npm run build` ✅ (/blog-posts, /stores/[siteCode]/blog, /stores/[siteCode]/blog/[slug]), lint 0 error ✅

### Free Plan Storefront Hosting + Plan Hosting Yönetimi ✅
- [x] **Plan.hosting** (`'rahatio' | 'vercel' | 'custom'`, default `rahatio`) — Plan model + safe migration + `serializePlan` + super admin `mapPlanBody`/validator; ücretsiz plan mağazaları `rahatio.com.tr/stores/{siteCode}` altında yayınlanır, üst paketler Vercel/kendi sunucu (slave) kullanır
- [x] **Store.siteUrl** — Store model + safe migration; vercel/custom hosting için explicit yayın URL'si
- [x] **Storefront route taşındı**: `app/store/[siteCode]` → `app/stores/[siteCode]` (git mv) + tüm `/store/` linkleri `/stores/` yapıldı (PageBlocks, StoreMenuBar, layout, cart/checkout/detail/pages)
- [x] **`GET /api/store/:siteCode` düzeltildi** — artık `{ store, products, total }` döner; products `StoreProduct` şeklinde (`'product.id'`, `'product.label'`, `image`, `price`, `currency`) — önceden flat store objesi dönüyordu, storefront home boş render ediyordu
- [x] **`getStoreFront`/`getStoreProduct`** — api-client'te tolerant unwrap + `toStoreProduct()` mapper (mapProduct → StoreProduct); product detail **hooks sırası hatası** düzeltildi (conditional return öncesi `useState`/`useEffect`)
- [x] **Super admin Plans** — form'a "Site Yayınlama" select (`rahatio`/`vercel`/`custom`), plan kartında yayınlama gösterimi
- [x] **Super admin Stores** — Site kodu yanında Plan adı + site linki (`rahatio.com.tr/stores/{siteCode}` veya `siteUrl`)
- [x] **Owner görünümü** — Settings'te "Mağaza Siten" linki, Plan kartında yayınlama; Billing modül karşılaştırma tablosuna "Site Yayınlama" satırı eklendi
- [x] **Site adresi ayarlama** — Settings'te `rahatio.com.tr/stores/{adres}` düzenlenebilir alan (slug, debounce'lu müsaitlik kontrolü: `GET /api/admin/me/check-site-code`); `PUT /api/admin/me` `siteCode` + benzersizlik kontrolü (başkası almışsa 409 → kullanıcı başka adrese yönlendirilir); `getSettings`/`updateSettings` normalize (camelCase→snake_case)
- [x] **Doğrulamalar** — core build ✅, frontend `npm run build` ✅ (43 route, `/stores/[siteCode]` dynamic), lint 0 error ✅

### Plan/Modül Yaptırım Sistemi + B2B Tab Placeholder Fix + EAS Deploy ✅
Commitler: `09949ad "Limits+Plans Control"` (tüm sistem), `5b00cf0` (B2B tab fix)

#### Faz A — Backend Yaptırım Çekirdeği (`packages/core`)
- [x] **`src/modules/plan/access.ts`** — yaptırım yardımcıları:
  - `enforceModuleAccess(store, module)`: zorunlu modüller `b2b`, `marketplace` (plana göre sayı limiti), `ai_product_create` (krediye göre); planda `modules` **yoksa/boşsa modül açık** sayılır; ihlalde 403 `MODULE_DISABLED` veya 402 `INSUFFICIENT_CREDITS`
  - `enforceProductLimit(store)`: plan `productLimit` + mevcut ürün sayısı (kendi + B2B klonları `originalProductId NOT NULL` dahil); doluysa 403 `PLAN_PRODUCT_LIMIT`
  - `enforceCredits(store, scenario)`: AI kredi bakiye kontrolü, 402 `INSUFFICIENT_CREDITS`
- [x] **Marketplace import limiti** — `product/routes.ts` marketplace import'ta ürün limiti doluysa import engellenir (403)
- [x] **AI kredi mantığı** — `Math.max(0,...)` kırpma kaldırıldı; talep öncesi bakiye kontrolü yapılır, yetersizse 402 `INSUFFICIENT_CREDITS` döner (artık 0'a kırpılıp başarılı görünmüyor)
- [x] **`server.ts` başlangıç migration** — mevcut `modules` alanı normalize edilir: `NULL`/`{}` → tüm modüller açık; `boolean` → `{ enabled }` nesnesi
- [x] **`me()` payload** — `auth/routes.ts:244-278` → `serializePlan()`: `store.plan` (plan + `modules` + `productLimit` + `aiCreditsPerMonth` + `aiCredits` dengesi) zarfı, web+mobil ortak tüketir

#### Faz B — Web UI Gating (`frontend`)
- [x] **`billing/page.tsx`** — 10 modüllü karşılaştırma tablosu (`moduleComparison` i18n anahtarları 5 dilde); modül adı/açıklama/plana göre ✓/✗
- [x] **`settings/page.tsx`** — Plan kartı: plan adı, ürün limiti, AI kredisi/ay (auth `store.plan`); state `store` → `storeSettings` rename (çakışma fix)
- [x] **`ai/page.tsx`** — per-tab modül gate (her AI sekmesi için), `INSUFFICIENT_CREDITS`/`PLAN_PRODUCT_LIMIT` catch + yönlendirme
- [x] **`ai-creator/page.tsx`** — `ai_product_create` modül gate + modal
- [x] **`components/ai/AiProductCreator.tsx`** — gate + modal + `refreshMe()` (limit aşılırsa bakiye güncellemesi)

#### Faz C — Mobil Gating + Auth Cold-Start Fix (`mobile-app`)
- [x] **`src/shared/auth.tsx:26` cold-start fix** — `me()` artık `{ user, store }` zarfını düzgün açar (önceden `store` içinde `user` arıyordu); context'e `store`, `refreshMe`, `can`, `productLimit` eklendi
- [x] **`api-client.ts`** — `me()` → `MeResponse` tipi; hata zenginleştirme: `Error` üzerinde `code`/`data`/`status` taşınır (web ile aynı davranış)
- [x] **`types.ts`** — `MeResponse`, `StoreWithPlan`, `Plan.modules` tipleri
- [x] **`products.tsx`** — B2B tab stripi (Kendi/B2B), bulk B2B butonları, modal switch `b2bEnabled` ile; ürün limit pre-check + `PLAN_PRODUCT_LIMIT` catch
- [x] **`ai.tsx`** — `ai_product_create` modül gate ekranı + `INSUFFICIENT_CREDITS` alert + `refreshMe()`
- [x] **`index.tsx`** — plan kartında ürün kullanımı `toplam/limit` gösterimi
- [x] **i18n** — `productLimitReached`, `insufficientCredits`, `moduleDisabled`, `upgradePlan` anahtarları 5 dilde (tr/en/ar/ru/es)
- [x] **Doğrulamalar** — core build ✅, frontend `npm run build` ✅, mobil `npx tsc --noEmit` ✅

#### B2B Tab Placeholder Fix (mobil) — commit `5b00cf0`
- [x] **Kök neden** — `mobile-app/app/(tabs)/_layout.tsx`'te B2B sekmeleri `{b2bEnabled && <Tabs.Screen>}` ile **koşullu mount** ediliyordu. `b2b/index.tsx` + `b2b/requests.tsx` route dosyaları diskte durduğu için React Navigation bu ekranları **varsayılan (placeholder) seçeneklerle** tab bar'a otomatik ekliyordu → ikonsuz placeholder görünüyordu. Local testte b2b açık hesapla girildiği için fark edilmedi; APK'da b2b kapalı planlı hesapla göründü.
- [x] **Çözüm** — Ekranlar **her zaman** `Tabs.Screen` olarak declare edilir, görünürlük `href: b2bEnabled ? undefined : null` ile; gizli ekranlar (`products/[id]`, `orders/[id]`) `href: null`. Modül açıkken ikonlar görünür, kapalıyken sekme tamamen gizli.
- [x] Mobil `npx tsc --noEmit` ✅

#### EAS Deploy (mobil)
- [x] **1. build** (hatalı placeholder içeriyordu): `4811cfd6-18a4-4048-9ba3-3ee2a042f6fb`
- [x] **2. build (fix sonrası):** `e79b24b3-ebed-42d3-b2d6-1dd66e70a63b` → https://expo.dev/accounts/ahmedsaidbuluts-team/projects/rahatio/builds/e79b24b3-ebed-42d3-b2d6-1dd66e70a63b (preview APK, internal)
- [x] EAS yapılandırması: giriş `ahmedsaidbulut` (ahmedsaidbulut@gmail.com), proje sahibi `ahmedsaidbuluts-team`, projectId `6bb13aed-b1f2-482f-9327-86b5eb6c6315`, profil `preview` = APK/internal distribution, keystore `AO88p4Fg1e (default)`, `eas build --platform android --profile preview --non-interactive` komutuyla build alınır

### i18n — Mobile Düzeltmeler + Web Dil Seçenekleri ✅
- [x] **ar/ru/es locale dosyaları yeniden yazıldı** — bozuk `?`/U+FFFD karakterler temizlendi, 200+ anahtar 5 dilde tamamlandı (UTF-8, BOM yok)
- [x] **Yeni i18n anahtarları** — `status_*` (pending/confirmed/processing/shipped/delivered/cancelled/returned), `prev`, `next`, `edit`, `required`, `cameraPermission`, `galleryPermission`, `id`, `admin`, `user`, `aiSessionFailed`, `b2bOpen`, `b2bCloneBadge` — 5 dile eklendi
- [x] **Sipariş durumları artık çevriliyor** — `orders.tsx`, `orders/[id].tsx` (status badge + status history) ham İngilizce enum yerine `t('status_'+status)`
- [x] **Hardcoded string'ler temizlendi** — login/register (`gerekli`, `opsiyonel`), super screen'ler (`'Error'`, Admin/User, `products`, `AI credits`), ai.tsx (kamera/galeri izni, `ID:`), settings.tsx (`Site Code/Domain/Email/AI Credits:`), b2b (`Ara...`, `Stok:`, `indirim`), product detail (AI prompt, `AI oturumu başlatılamadı`)
- [x] **Stray bozuk `(tabs` dizini silindi** — `(tabs` + `)_layout.tsx` korrupt artefaktı kaldırıldı
- [x] **Web i18n altyapısı** — `frontend/src/lib/i18n.tsx` (I18nProvider + useI18n + LanguageSwitcher, localStorage `app_locale`, tr/en/ar/ru/es) + `frontend/src/lib/locales/*.ts`
- [x] **Web dil seçici** — dashboard sidebar + mobile header, super admin sidebar, login/register sayfalarına eklendi
- [x] **Web nav + shell + Plan sayfası çevrildi** — nav grupları, "Super Admin"/"Çıkış Yap", billing (Plan) sayfası tamamen `t()` kapsamına alındı
- [x] **Doğrulamalar** — core build ✅, frontend `npm run build` ✅, mobile `npx tsc --noEmit` ✅
- [ ] Diğer web sayfaları (products/orders/settings vb.) kademeli olarak `t()`'ye taşınacak

### 8 Madde — Web + Mobile Eksiklikler (Ürün/Sipariş Arama, B2B, Merge) ✅
- [x] **Ürün arama** — `product/routes.ts` `search` (title/sku iLike) + web & mobile products sayfalarına debounce'lu arama kutusu
- [x] **Sipariş arama** — `order/routes.ts` `search` (orderNumber, marketplaceOrderId/Number, customerName/Email/Phone, trackingNumber, items::text) + web & mobile orders arama
- [x] **Min/max fiyat filtresi kaldırıldı** — web & mobile products sayfalarından (backend parametreleri geriye dönük korundu)
- [x] **B2B Ürünleri sekmesi** — backend `b2b=1` → `originalProductId NOT NULL` (sadece klonlar), `b2b=0` → kendi ürünleri
- [x] **B2B rozeti** — product satırlarında "B2B Klon" (violet) + "B2B Açık %X" (emerald) etiketleri
- [x] **Toplu B2B aç** — `POST /api/admin/b2b/bulk` (ids + isB2BEnabled + discount + price), Product kolonları da sync; web modal + mobile bulk buton
- [x] **"Tümü" sayfa boyutu** — `limit=all` backend desteği (100 limiti atlanır) + api-client'ler
- [x] **Çoklu pazaryeri filtresi** — `marketplaces` virgülle birleşik + JSONB `@>`/`literal` OR mantığı; "Pazaryeri Yok" → boş array
- [x] **SKU Merge modülü** — `product/mergeRoutes.ts`: `GET /merge/duplicates` (GROUP BY sku) + `POST /merge` (transaction: varyant/listing/B2B setting/request/listed taşı, stok+birimler birleştir, sil); web `/products/merge` sayfası + nav linki
- [x] **Build/typecheck** — core build ✅, frontend build ✅, mobile tsc ✅

### Phase 0 — Kritik Hata Düzeltmeleri ✅
- B2B discover/listed/requests response shape fix (async unwrap + field mapping)
- Store route prefix fix (`/store/` prefix kaldırıldı, frontend `api-client.ts`)
- Variant routes fix (mount `/api/admin/variants`, path düzeltildi)
- Checkout conflict fix (stub `POST /:siteCode/checkout` kaldırıldı)
- Response wrapper fix (tüm `api-client.ts` get/list method'ları `.then(r => r.data)` unwrap)

### Phase 1 — Runtime Crash Fixes ✅
- **Duplicate alias `users`** in `associations.ts`: decorator-covered associations removed, 137→8 satır
- **CORS preflight**: `app.options('*', cors())` + origin list (admin.rahatio.com.tr dahil)
- **StoreMenu not defined**: model imported in `database.ts`
- **setupAssociations() never called**: added import + call in `server.ts`
- **DropshippingOrder status ENUM→STRING**: `DataType.STRING(50)` for existing table compat
- **Pages route**: GET `/api/admin/pages` works (model+route vardı ama frontend unwrap bekliyordu)
- **Payment method route**: `:id` (int) → `:type` (string) param change
- **Marketplace PUT validation**: `body('config').optional()` fix
- **Stores page Pasif hatası**: `getAdminStores()` camelCase→snake_case normalize
- **Responselar için field mappers**: `mapPaymentMethod`, `mapIntegration`, `mapPage`, `mapAdminStore`

### Pixel/Tag Integrations Feature (Yeni) ✅
- **Backend**: JSONB `pixels` column added to Store model, safe migration in `server.ts`
- **Backend routes**: `GET|PUT /api/admin/pixels` with validation (8 platform: GA4, GTM, FB, TikTok, IG, GMC, custom head/body)
- **Backend public**: `GET /api/store/:siteCode/pixels` endpoint
- **Frontend page**: `pixels/page.tsx` expandable config cards for all 8 platforms
- **Frontend nav**: "Piksel & Takip" sidebar entry
- **Frontend storefront**: `PixelInjector.tsx` component renders `<Script>` tags with platform-specific snippets
- **Storefront integration**: `<PixelInjector>` in `store/layout.tsx`
- **Deployed**: ConfigHash `b24b38b` live, /health OK, login OK, pixels/stores/pages APIs OK

### Phase 7 — Core API + Auth + Store/Plan ✅ TAMAMLANDI
- Auth: JWT (access/refresh) + API Key HMAC middleware
- Store/Plan/Subscription CRUD + Stripe webhook
- Tenant middleware + otomatik storeId filter
- API Key yönetimi (create/list/revoke, HMAC secret)

### Phase 8 — Product + Category + Variation ✅ TAMAMLANDI
- Product CRUD (backend + frontend full)
- Category tree + marketplace mappings
- Variation/Option/Variant CRUD
- Marketplace config + per-mp category/brand

### Phase 9 — Marketplace Integrations ✅ TAMAMLANDI
- Integration CRUD (Trendyol/HB/Pazarama/N11/Amazon/Etsy)
- BullMQ import/push/webhook queues (core + integration-service)
- Etsy OAuth flow (connect + callback + Listing CRUD)
- Full marketplace clients (Amazon write ops, N11 categories/orders)
- Integration log viewer + DELETE endpoints
- Model cleanup (7 duplicate files removed)

### Phase 10 — B2B Sistemi (Golden'dan gelişmiş) ✅ TAMAMLANDI
- ProductB2bSetting (isEnabled, discount, price)
- B2B Discover (seller filter + enrich)
- B2B Request (create, incoming/outgoing, approve/reject)
- Clone + List (variant destekli, profitMargin, original references)
- Frontend B2B Keşfet + Talepler + Listed

### Phase 11 — AI Provider/Model/Scenario/RL Yönetimi ✅ TAMAMLANDI

#### Completed
- [x] **AiModels.ts** — AiProvider, AiModel, AiScenario, AiProviderRateLimit, AiUsageLog
- [x] **Super admin API** — Full CRUD (`/api/admin/ai/providers`, `/ai/models`, `/ai/scenarios`, `/ai/rate-limits`, `/ai/usage-logs`)
- [x] **Frontend API client** — Tüm metotlar (get/create/update/delete)
- [x] **AI Sağlayıcılar** (`/ai-providers`) — Provider list + inline model CRUD
- [x] **AI Senaryoları** (`/ai-scenarios`) — 5 ön tanımlı senaryo (analyze_product, generate_description, chat, search, recommend)
- [x] **AI Rate Limits** (`/ai-rate-limits`) — Sağlayıcı bazında dakika/saat/gün limit
- [x] **Setting modeli** (`Setting.model.ts`) — Global anahtar-değer deposu (Etsy OAuth)
- [x] **Super admin nav** — Tüm AI sayfaları linklendi

### Phase 11 (devam) — AI Gateway Proxy, Siparişler & XML Feed ✅ TAMAMLANDI
- [x] **AI Gateway Proxy** — Core → ai-service yönlendirme (key injection ile), multi-provider LLM routing (OpenAI, OpenRouter, NVIDIA, DeepSeek, Mistral, Gemini, Ollama)
- [x] **Dropshipping Order** (create, status, tracking, history, split by vendor, `parentOrderId` sub-order system)
- [x] **Express Checkout** (address, payment methods, cart, `paymentMethod`/`paymentStatus` validation)
- [x] **Payment Method seeding** — 6 varsayılan method (stripe, bank_transfer, iyzico, paytr, crypto, cash_on_delivery)
- [x] **XML Feed** — Full config model (auth, pricing, mapping, schedule), import wizard (4-step), field mapping, sync worker (JSON/CSV/XML parser + Product.upsert), auto-sync queue, `/logs` endpoint

## Sıradaki

### Phase 12 — UI/Design Refresh
- [x] CSS bug: dropdown/select white text on white background — `globals.css`'te koyu yüzey select'lerine `color-scheme: dark` (native dropdown artık koyu); base select `color-scheme: light`
- [x] AI + Credits sayfaları görünürlük fix — açık shell üzerinde `text-white` başlıklar görünmüyordu; sayfa kökleri `rounded-2xl border-zinc-800 bg-zinc-950` panel yapıldı (kartlarla tutarlı)
- [x] Global design improvements (kısmi) — globals.css'e tarayıcılar arası scrollbar (Firefox `scrollbar-width/color`), `::selection` (indigo tint), placeholder rengi, `button:disabled{cursor:not-allowed}`, `.card` (birleşik yüzey token'ı) ve `.table-scroll` (mobilde yatay kaydırmalı tablo) yardımcı sınıfları; `Button` bileşenine tutarlı `shadow-sm` derinliği; products/orders tabloları `.table-scroll`
- [x] Consistent spacing/tokens (kısmi) — dashboard shell `main p-4 md:p-6 lg:p-8` + h-14 header tutarlı; `.card`/`.table-scroll` token'ları globals.css'te
- [x] Loading states — tüm dashboard listeleri `TableSkeleton`/`CardSkeleton` (products, orders, b2b, b2b-requests, variations, brands, categories, pages, pixels, locations, payment, shipping, feeds, feeds/[id], integrations, marketplaces, marketplaces/[marketplace], menus, credits, orders/[id], products/merge)
- [x] Error/empty state improvements — products/orders/b2b/b2b-requests/pages/feeds/products-merge boş ekranları `EmptyState`
- [x] Responsive layout fixes (kısmi) — tüm sayfa header satırlarına `flex-wrap gap-3` (title+buton dar ekranda sarar); uzun sekme barları `overflow-x-auto` + `whitespace-nowrap` (orders, brands, categories, marketplaces/[mp], ai, ai tabları); orders import bar `flex-wrap`; products/orders tabloları `.table-scroll` (yatay kaydırma); dashboard plan kartı `flex-wrap`
- [ ] Dark mode support (optional)

## ~~🔴 PHASE 1 — Sayfa Çökmesine Sebep Olan Kritik Hatalar~~ ✅ DÜZELTİLDİ

| # | Hata | Dosya(lar) | Çözüm |
|---|------|-----------|-------|
| 1-7 | Tüm B2B, store prefix, variant, checkout, response wrapper hataları | `api-client.ts`, routes | async unwrap + field mapping + route fix |

## ~~🟠 PHASE 2 — Response Wrapper Uyumsuzlukları (Sayfalar Boş Görünür)~~ ✅ DÜZELTİLDİ

| # | Hata | Çözüm |
|---|------|-------|
| 8-15 | Tüm response wrapper uyumsuzlukları | `.then(r => r.data)` unwrap eklendi |

## 🟡 PHASE 3 — Alan Adı Uyumsuzlukları (Veriler Gözükmez / NaN) ⏳ DEVAM EDİYOR

| # | Alan | Frontend | Backend |
|---|------|----------|---------|
| 16 | product.code | `code` | `sku` |
| 17 | product.label | `label` | `title` |
| 18 | product.status | `0/1` (number) | `isActive` (boolean) |
| 19 | product.price | `price` | `priceTRY` |
| 20 | product.stock | `stock` | `quantity` |
| 21 | b2b_discount | snake_case | `b2bDiscount` camelCase |
| 22 | order.grand_total | `grand_total` | `totalAmount` |
| 23 | order.customer_name | `customer_name` | Yok |
| 24 | order.shipping_address | `shipping_address` | `shippingAddress` |
| 25 | order.items.map() | `items.map(...)` | `items` null olabilir |

## 🟡 PHASE 4 — Eksik Backend Endpoint'leri (Çoğu VAR) ⏳ DEVAM EDİYOR

| # | Sayfa | Endpoint | Durum |
|---|-------|----------|-------|
| 26 | Dashboard | `GET /api/admin/dashboard` | **VAR** (7 field döndürüyor) |
| 27 | Pages | CRUD `/api/admin/pages` | **VAR** (GET list, CRUD tam) |
| 28 | Feeds | CRUD `/api/admin/feeds` | **VAR** (CRUD + test + sync) |
| 29 | Locations | Admin CRUD `/api/admin/locations` | **VAR** (CRUD tam) |
| 30 | Payment Methods | Admin CRUD `/api/admin/payment-methods` | **VAR** (CRUD tam) |
| 31 | AI Credits Logs | `/api/admin/ai/credits/logs`, `/stats` | **VAR** |
| 32 | File Upload | `POST /api/admin/upload` | **VAR** (local disk, MinIO yok) |
| 33 | Subscription Cancel/Change | `/store/subscription/cancel`, `/plan/change` | **Portal-based** (Stripe Billing Portal üzerinden, direct API yok) |
| 34 | Bulk Order Status | `POST /api/admin/orders/bulk-status` | **YOK** — eklenecek |
| 35 | Sync Job Status | `/api/admin/sync/*` | **Yanlış path** — düzeltilecek |
| 36 | AI Status/Output | `/api/ai/status/:id`, `/api/ai/output/:id/:file` | **YOK** — proxy eklenecek |

## 🟣 PHASE 5 — AI Endpoint Payload Uyuşmazlığı ⏳ DEVAM EDİYOR

| # | Endpoint | Frontend Gönderir | Backend Bekler |
|---|----------|-------------------|----------------|
| 37 | `/api/ai/process-image` | FormData (File) | JSON `{ imageUrl }` |
| 38 | `/api/ai/analyze-product` | FormData (File) | JSON `{ imageUrl }` |
| 39 | `/api/ai/generate-description` | `{ name, ... }` | `{ title, ... }` |

## ⚪ PHASE 6 — Slave / Site Builder Hataları ⏳ BEKLİYOR

| # | Hata | Detay |
|---|------|-------|
| 40-50 | Slave routes stub, download path, format, Go slave, Site Builder, theme, pages, domain, ZIP, HMAC, API key | Bekliyor |

## 🟡 PHASE 3 — Alan Adı Uyumsuzlukları (Veriler Gözükmez / NaN)

| # | Alan | Frontend | Backend | Etki |
|---|------|----------|---------|------|
| 16 | product.code | `code` | `sku` | Ürün kodu sütunu boş |
| 17 | product.label | `label` | `title` | Ürün adı sütunu boş |
| 18 | product.status | `0/1` (number) | `isActive` (boolean) | Tüm ürünler "Satışta Değil" |
| 19 | product.price | `price` | `priceTRY` | Fiyat sütunu "-" |
| 20 | product.stock | `stock` | `quantity` | Stok sütunu "-" |
| 21 | b2b_discount | snake_case | `b2bDiscount` camelCase | B2B indirimi gözükmez |
| 22 | order.grand_total | `grand_total` | `totalAmount` | NaN ₺ |
| 23 | order.customer_name | `customer_name` | Yok | Müşteri adı boş |
| 24 | order.shipping_address | `shipping_address` | `shippingAddress` | Adres "—" |
| 25 | order.items.map() | `items.map(...)` | `items` null olabilir | Sayfa çöker |

## 🔵 PHASE 4 — Eksik Backend Endpoint'leri (Hepsi 404)

| # | Sayfa | Endpoint | Durum |
|---|-------|----------|-------|
| 26 | Dashboard | `GET /api/admin/dashboard` | **YOK** |
| 27 | Pages | Tüm CRUD `/api/admin/pages` | **YOK** (model var, route yok) |
| 28 | Feeds | Tüm CRUD `/api/admin/feeds` | **YOK** |
| 29 | Locations | Admin CRUD `/api/admin/locations` | **YOK** |
| 30 | Payment Methods | Admin CRUD `/api/admin/payment-methods` | **YOK** |
| 31 | AI Credits Logs | `/api/admin/ai/credits/logs`, `/stats` | **YOK** |
| 32 | File Upload | `POST /api/admin/upload` | **YOK** |
| 33 | Subscription Cancel/Change | `/store/subscription/cancel`, `/plan/change` | **YOK** |
| 34 | Bulk Order Status | `POST /api/admin/orders/bulk-status` | **YOK** |
| 35 | Sync Job Status | `/api/admin/sync/*` | **Yanlış path** |
| 36 | AI Status/Output | `/api/ai/status/:id`, `/api/ai/output/:id/:file` | **YOK** (proxy yok) |

## 🟣 PHASE 5 — AI Endpoint Payload Uyuşmazlığı

| # | Endpoint | Frontend Gönderir | Backend Bekler | Sonuç |
|---|----------|-------------------|----------------|--------|
| 37 | `/api/ai/process-image` | FormData (File) | JSON `{ imageUrl }` | Validation hatası |
| 38 | `/api/ai/analyze-product` | FormData (File) | JSON `{ imageUrl }` | Validation hatası |
| 39 | `/api/ai/generate-description` | `{ name, ... }` | `{ title, ... }` | Alan adı uyuşmazlığı |

## ⚪ PHASE 6 — Slave / Site Builder Hataları

| # | Hata | Detay |
|---|------|-------|
| 40 | **TS slave routes STUB** | `slave/routes.ts` `"not implemented"` döndürüyor |
| 41 | **Slave download path yanlış** | Frontend `/api/admin/slave/` çağırıyor, backend `/api/slave/`'de |
| 42 | **Slave Aimeos formatı bekliyor** | `product.code`, `product.label` — yeni TS backend Sequelize döndüğü için kırılacak |
| 43 | **Go slave HEAD'den silinmiş** | Git history'de kalmış, geri getirilebilir |
| 44 | **Site Builder (görsel) hiç yok** | Drag-drop, tema, renk/font özelleştirme, template sistemi yok |
| 45 | **`theme` JSONB alanı ölü** | Store modelinde var ama frontend'de UI'ı yok |
| 46 | **Pages migration/routes yeni backend'de yok** | Model duplicate, migration ve route eksik |
| 47 | **Custom domain dashboard'da read-only** | API ile set edilebiliyor ama frontend'de input yok |
| 48 | **Vercel ZIP'te package.json yok** | npm install kırılır |
| 49 | **HMAC secret slave + internal ortak** | Slave config sızarsa internal auth da kırılır |
| 50 | **API key her download'da yenilenir** | Eski slave anında çalışmaz |

---

# YENİ MİMARİ PLANI: Rahatio v2 (Golden-Marketplace Hybrid)

## Stratejik Karar

**Rahatio v1 (Mevcut)**: Laravel + Aimeos + Node.js servisler — multi-tenant çalışıyor ama Aimeos karmaşıklığı, 3 runtime (PHP/Node/Python), marketplace sync kırılgan.

**Golden-Marketplace**: Node.js/TypeScript + Express + Sequelize — temiz kod, çalışan marketplace entegrasyonları (Etsy tam, diğerleri Rahatio'da daha güncel), B2B variant+profit margin, sağlam sync job mimarisi. **AMA** tek domain/pazaryeri modeli (multi-tenant değil).

**Yeni Hedef**: **Golden'un TypeScript backend'ini al, Rahatio'nun multi-tenant + mobile + AI + slave mimarisini koru.**

```
┌─────────────────────────────────────────────────────────────────┐
│                    RAHATIO v2 MİMARİSİ                          │
├─────────────────────────────────────────────────────────────────┤
│  FRONTEND (Korunur)                                             │
│  ├── Next.js 16 (Admin + Storefront) — api-client.ts güncellenir│
│  ├── Mobile Expo/React Native — api-client.ts güncellenir       │
│  └── Landing/SEO — korunur                                      │
├─────────────────────────────────────────────────────────────────┤
│  BACKEND (YENİ: TypeScript/Node.js)                             │
│  ├── packages/core/           # Multi-tenant API (Express)       │
│  │   ├── Auth (JWT + API Key HMAC)                              │
│  │   ├── Store/Plan/Subscription                                │
│  │   ├── Product/Category/Variation (Sequelize)                 │
│  │   ├── B2B (Request/Approve/Clone + Variant + Profit Margin)  │
│  │   ├── Marketplace Integrations (Trendyol/HB/Pazarama/N11/   │
│  │   │   Amazon/Etsy) — Golden'dan alınır                       │
│  │   ├── Marketplace Sync Job (BullMQ) — Golden mimarisi        │
│  │   ├── Order/Dropshipping                                     │
│  │   ├── AI Gateway Proxy (ComfyUI/Ollama)                      │
│  │   └── Slave Download Endpoints                               │
│  ├── packages/ai-service/    # ComfyUI + Ollama (korunur)        │
│  └── packages/integration-service/ # Webhook/Order sync (yeniden)│
├─────────────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE (Korunur/Güncellenir)                           │
│  ├── PostgreSQL (MySQL → PG migration)                          │
│  ├── Redis (BullMQ + Cache)                                     │
│  ├── MinIO/S3 (Media)                                           │
│  ├── Docker Compose + Portainer                                 │
│  └── Mobile: Expo EAS Build (korunur)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Temel Farklar ve Çözümler

| Konu | Rahatio v1 | Golden-Marketplace | **Rahatio v2 Çözümü** |
|------|------------|-------------------|----------------------|
| **Mimari** | Multi-tenant SaaS | Tek domain pazaryeri | **Multi-tenant TypeScript backend** (storeId FK her modelde) |
| **Backend** | Laravel + Aimeos | Node/TS + Sequelize | **packages/core (Express + Sequelize)** |
| **Marketplace Sync** | AimeosProductImporter + integration-service | productSyncJob (BullMQ) | **Golden'un syncJob mimarisi** (CREATE vs UPDATE ayrımı) |
| **B2B** | Temel (clone) | Variant + Profit Margin + OriginalRef | **Golden'un B2B'si** (variant destekli, kâr marjı) |
| **Etsy** | Yok | Tam (OAuth + Listing CRUD) | **Golden'dan alınır** |
| **Diğer MP** | Trendyol/HB/Pazarama/N11/Amazon (güncel) | Etsy tamam, diğerleri Rahatio'da daha yeni | **Rahatio'daki güncel client'lar TS'ye port edilir** |
| **Multi-tenant** | Aimeos site_code + store_id property | Yok (userId/storeId) | **Her modelde storeId FK + middleware** |
| **Mobile App** | Expo SDK 54 (var) | Yok | **Korunur, api-client güncellenir** |
| **Slave Nodes** | PHP + Vercel (var) | Yok | **Korunur, yeni API'ye uyarlanır** |
| **AI Service** | ComfyUI + Ollama (var) | OpenAI/Ollama basit | **Korunur, gateway proxy yeni backend'e** |
| **Veritabanı** | MySQL + Aimeos (~100 tablo) | PostgreSQL + Sequelize | **PostgreSQL + Sequelize (Aimeos tablo kalmaz)** |

---

## Veritabanı Şeması (Yeni: PostgreSQL + Sequelize)

### Core Models (Multi-tenant: her modelde `storeId` FK)

```typescript
// packages/core/src/models/Store.ts
Store: id, name, siteCode, domain, email, isActive, planId, stripeAccountId,
       theme, currency, taxSettings, shippingSettings, createdAt

// packages/core/src/models/User.ts
User: id, storeId, name, email, passwordHash, role (owner/admin/staff),
      aiCredits, fcmToken, isActive

// packages/core/src/models/Plan.ts
Plan: id, name, price, productLimit, aiCredits, features, stripePriceId

// packages/core/src/models/Subscription.ts
Subscription: id, storeId, planId, stripeSubscriptionId, status,
              trialEndsAt, currentPeriodEnd, canceledAt

// packages/core/src/models/Category.ts (Evrensel + Marketplace mapping)
Category: id, storeId?, parentId, slug, name, translations, icon, sortOrder, isActive
MarketplaceCategoryMapping: id, categoryId, marketplace, marketplaceCategoryId, name, parentId
```

### Product Models (Golden'dan alınır, storeId eklenir)

```typescript
// packages/core/src/models/Product.ts
Product: id, storeId, title, slug, description, categoryId, sku,
         gramWeight, milyem, effectiveMilyem, profitMargin, priceMultiplier,
         priceTRY, priceUSD, isB2BEnabled, b2bDiscount, b2bPrice,
         discountRate, discountedPrice, quantity, images, videoUrl,
         marketplaces[], marketplaceConfig, hasVariants, variantAttributes,
         tags, isActive, originalProductId, originalStoreId, createdAt

// packages/core/src/models/ProductVariant.ts (Golden'dan)
ProductVariant: id, productId, storeId, sku, attributes, gramWeight,
                quantity, priceTRY, priceUSD, b2bPrice, isActive

// packages/core/src/models/Variation.ts
Variation: id, storeId, name, type
VariationOption: id, variationId, value, sortOrder
```

### B2B Models (Golden'dan, storeId ile)

```typescript
// packages/core/src/models/ProductB2bSetting.ts
ProductB2bSetting: id, storeId, productId, isB2BEnabled, b2bDiscount, b2bPrice

// packages/core/src/models/B2BRequest.ts (Golden'dan gelişmiş)
B2BRequest: id, productId, variantId, requesterStoreId, ownerStoreId,
            status (pending/approved/rejected), requestNote, profitMargin,
            marketplaces[], createdAt

// packages/core/src/models/B2BListedProduct.ts
B2BListedProduct: id, storeId, originalStoreId, productId, originalProductId,
                  b2bRequestId, profitMargin, createdAt
```

### Marketplace Models

```typescript
// packages/core/src/models/MarketplaceIntegration.ts
MarketplaceIntegration: id, storeId, marketplace, isActive, config (JSON),
                        lastSyncAt, etsyCategoryId, etsyShippingProfileId, ...

// packages/core/src/models/ProductMarketplaceListing.ts (Golden'dan - sync tracking)
ProductMarketplaceListing: id, productId, storeId, platform, externalId,
                           externalCode, status (pending/active/failed),
                           batchRequestId, lastError, lastSyncedAt

// packages/core/src/models/IntegrationLog.ts
IntegrationLog: id, userId, storeId, platform, endpoint, method, isSuccess,
                requestPayload, responsePayload, errorMessage, createdAt
```

### Diğer Modeller (Rahatio'dan taşıınır)

```typescript
// Order/Dropshipping
DropshippingOrder, OrderStatusHistory, CustomerAddress

// Content
Page, StoreLocation, StorePaymentMethod, ExternalFeed, FeedSyncLog

// API Keys
ApiKey: id, storeId, keyHash, name, allowedIps, expiresAt, lastUsedAt

// AI Credits
CreditLog: id, userId, storeId, action, module, amount, balanceBefore, balanceAfter
```

---

## Backend Paket Yapısı (Monorepo: `packages/`)

```
rr/
├── packages/
│   ├── core/                    # Ana API (Express + TypeScript)
│   │   ├── src/
│   │   │   ├── config/          # env, db, redis, s3
│   │   │   ├── middleware/      # auth, tenant, validation, error
│   │   │   ├── modules/
│   │   │   │   ├── auth/        # JWT + API Key HMAC
│   │   │   │   ├── store/       # Store/Plan/Subscription CRUD
│   │   │   │   ├── product/     # Product/Category/Variation + Marketplace Config
│   │   │   │   ├── b2b/         # B2B Discover/Request/Approve/Clone (Golden)
│   │   │   │   ├── marketplace/ # Integration CRUD + Sync Job Trigger
│   │   │   │   ├── order/       # Dropshipping + Customer Order
│   │   │   │   ├── ai/          # Gateway proxy → ai-service
│   │   │   │   ├── slave/       # Download endpoints
│   │   │   │   └── integration/ # Webhook receiver (order/stock/price)
│   │   │   ├── jobs/            # BullMQ workers (sync, price, webhook)
│   │   │   ├── utils/           # goldPrice, s3, helpers
│   │   │   ├── app.ts           # Express app factory
│   │   │   └── server.ts        # Entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ai-service/              # ComfyUI + Ollama (mevcut, koru)
│   │   ├── src/
│   │   │   ├── routes/ai.ts     # /process-image, /analyze-product, /chat
│   │   │   ├── services/comfyui.ts, ollama.ts, visionAnalyzer.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── integration-service/     # Webhook/Order sync (yeniden yaz)
│       ├── src/
│       │   ├── routes/webhook.ts     # POST /webhook/product (order/stock/price)
│       │   ├── routes/sync.ts        # Manual sync triggers
│       │   ├── services/orderSync.ts # Split by vendor → dropshipping orders
│       │   ├── services/coreSync.ts  # Notify core of sync results
│       │   └── queues/               # BullMQ processors
│       └── package.json
│
├── frontend/                    # Next.js 16 (mevcut, api-client güncellenir)
├── mobile-app/                  # Expo SDK 54 (mevcut, api-client güncellenir)
├── slave/                       # PHP + Vercel (mevcut, config güncellenir)
├── docker-compose.yml           # PostgreSQL + Redis + MinIO + Core + AI + Integration + Frontend
├── package.json                 # Root workspace (npm workspaces / pnpm)
├── turbo.json                   # Turborepo config (build pipeline)
└── AGENTS.md                    # Bu dosya
```

---

## Marketplace Entegrasyon Mimarisi (Golden Sync Job Mimarisi)

### Çekme (Import) - Async Job

```
Frontend: POST /api/admin/integrations/{mp}/import
    → Core: MarketplaceImport kaydı (pending) + 202
    → BullMQ: ImportMarketplaceProductsJob(jobId)
    → Worker: integration-service'e POST /import/products {mp, config, maxPages}
    → Integration Service: factory.createIntegration(mp, config).fetchProducts(pages)
    → Worker: Core'e products[] döner
    → Worker: Sequelize Product.upsert (storeId + sku unique) + marketplace listing kaydı
    → MarketplaceImport: done + summary
Frontend: Poll GET /import/{id} → status/summary
```

### Gönderme (Push) - Webhook/Job

```
Product Create/Update → Core: ProductMarketplaceListing yoksa CREATE, varsa UPDATE
    → BullMQ: ProductSyncJob({productId, storeId, trigger})
    → Worker: Her aktif integration için client.createProduct() veya updatePrice/updateStock
    → ProductMarketplaceListing: externalId/externalCode/status güncelle
    → IntegrationLog: success/error kaydet
```

### Webhook (Order/Stock/Price) - Integration Service

```
Marketplace (Trendyol/HB/Etsy...) → POST /webhook/product
    → Integration Service: verify signature → BullMQ (orderSync/stockSync/priceSync)
    → Worker: Core'e order create / stock update / price update
    → Core: DropshippingOrder create / Product quantity update / Product price update
    → IntegrationLog kaydet
```

---

## Multi-Tenant Isolation (Kritik)

```typescript
// packages/core/src/middleware/tenant.ts
export const resolveStore = async (req, res, next) => {
  // 1. API Key auth (slave/mobile) → req.store = store
  // 2. JWT auth (web admin) → req.user.store → req.store = store
  // 3. Domain resolve (storefront) → req.store = store
  // Tüm controller'larda req.store.id ile filter
}

// Her model query'sinde otomatik storeId filter:
Product.findAll({ where: { storeId: req.store.id, ... } })
ProductVariant.findAll({ where: { storeId: req.store.id, ... }, include: Product })
```

**Slave Nodes**: Mevcut PHP/Vercel slave dosyaları korunur, sadece `config.apiBase` ve `config.hmacSecret` yeni Core API'sine güncellenir. Slave indirme endpoint'leri (`/admin/slave/download-php|vercel`) Core'da korunur.

---

## API Route Tasarımı (Yeni)

### Auth
```
POST   /api/auth/register           # + store_name → Store + User + Plan + Subscription
POST   /api/auth/login              # → {accessToken, refreshToken, user, store}
POST   /api/auth/refresh            # refreshToken → new accessToken
GET    /api/auth/me                 # → user + store + plan + subscription
```

### Admin (Store Owner)
```
GET    /api/admin/dashboard
GET    /api/admin/products          # ?page&perPage&marketplaces&status&priceMin&priceMax&search
POST   /api/admin/products          # create (image upload → MinIO)
GET    /api/admin/products/:id
PUT    /api/admin/products/:id
DELETE /api/admin/products/:id
POST   /api/admin/products/bulk-delete
POST   /api/admin/products/:id/verify   # Marketplace verification

GET    /api/admin/orders
GET    /api/admin/orders/:id
PUT    /api/admin/orders/:id/status
PUT    /api/admin/orders/:id/tracking

GET    /api/admin/integrations
PUT    /api/admin/integrations/:marketplace
POST   /api/admin/integrations/:marketplace/import
GET    /api/admin/integrations/:marketplace/import/:id
POST   /api/admin/integrations/:marketplace/categories

GET    /api/admin/b2b/discover
GET    /api/admin/b2b/settings
PUT    /api/admin/b2b/settings
GET    /api/admin/b2b/requests
POST   /api/admin/b2b/requests
PUT    /api/admin/b2b/requests/:id
POST   /api/admin/b2b/requests/:id/clone
GET    /api/admin/b2b/listed

GET    /api/admin/categories (tree/flat)
POST   /api/admin/categories
PUT    /api/admin/categories/:id
GET    /api/admin/categories/:id/mappings
POST   /api/admin/categories/:id/mappings

GET    /api/admin/variations
POST   /api/admin/variations
...

GET    /api/admin/feeds
POST   /api/admin/feeds
POST   /api/admin/feeds/:id/test
POST   /api/admin/feeds/:id/sync

GET    /api/admin/ai/credits
POST   /api/admin/ai/process-image
POST   /api/admin/ai/generate-description
POST   /api/admin/ai/analyze-product

GET    /api/admin/slave/download-php
GET    /api/admin/slave/download-vercel
```

### Storefront (Public - API Key veya Domain)
```
GET    /api/store/:siteCode
GET    /api/store/:siteCode/products/:id
GET    /api/store/:siteCode/locations
GET    /api/store/:siteCode/payment-methods

POST   /api/store/:siteCode/addresses
POST   /api/store/:siteCode/checkout
```

### Mobile/Slave (API Key + HMAC)
```
GET    /api/products
GET    /api/products/:id
POST   /api/products/sync
GET    /api/stocks/:sku
PUT    /api/stocks
```

### AI
```
POST   /api/ai/process-image        # Proxy → ai-service
POST   /api/ai/analyze-product      # Proxy → ai-service (vision)
POST   /api/ai/generate-description # Proxy → ai-service (llm)
POST   /api/ai/chat                 # Proxy → ai-service
```

---

## Geliştirme Aşamaları (Roadmap)

### ✅ Phase 0 — Kritik Hata Düzeltmeleri (Tamamlandı)
- [x] B2B response shape fix
- [x] Store route prefix fix
- [x] Variant routes fix
- [x] Checkout conflict fix
- [x] Response wrapper'lar (tüm api-client.ts unwrap)
- [x] Runtime crash fixes (associations, CORS, model imports, sync call)
- [x] Frontend field mappers & sayfa düzeltmeleri (stores, pages, payment, integration)
- [x] Pixel/Tag Integrations feature (backend + frontend + storefront)

### 🔄 Phase 0.5 — Eksik Endpoint'ler ✅ TAMAMLANDI
- [x] Dashboard stats endpoint (zaten vardı)
- [x] File upload route (zaten vardı, local disk)
- [x] Feeds CRUD (zaten vardı)
- [x] Locations/Payment Methods admin CRUD (zaten vardı)
- [x] Bulk order status endpoint (POST /api/admin/orders/bulk-status) **eklendi**
- [x] AI credits log/stats (zaten vardı)
- [x] AI status/output proxy routes **eklendi**
- [x] requireRole superadmin bypass fix

### 🔄 Phase 3 — Alan Adı Uyumsuzlukları ✅ TAMAMLANDI
- [x] product.code → sku (mapProduct ile)
- [x] product.label → title (mapProduct ile)
- [x] product.status → isActive (0/1 vs boolean, mapProduct ile)
- [x] product.price → priceTRY (+ priceUSD ve price_currency eklendi)
- [x] product.stock → quantity (mapProduct ile)
- [x] b2b_discount → b2bDiscount (mapProduct ile)
- [x] order.grand_total → totalAmount (mapOrder ile)
- [x] order.customer_name — shippingAddress'den extract, + items null guard
- [x] order.shipping_address → shippingAddress (mapOrder ile)
- [x] order.items null guard (mapOrder: items → [] default)

### ✅ Phase 5 — AI Endpoint Payload Uyuşmazlığı (Tamamlandı)
- [x] /api/ai/process-image: ai-service artık JSON `{ imageUrl, category }` kabul ediyor (multipart fallback ile)
- [x] /api/ai/analyze-product: ai-service artık JSON `{ imageUrl, category }` kabul ediyor (multipart fallback ile)
- [x] /api/ai/generate-description: ai-service'e route eklendi (`{ title, category, attributes?, keywords? }` → Ollama description generation)

### Phase 0.6 — Slave & Site Builder ✅ TAMAMLANDI
- [x] Slave download endpoints (config injection + PHP/Vercel ZIP)
- [x] PHP slave template (zero-dependency, standalone)
- [x] Vercel slave template (serverless, package.json auto-generated)
- [x] Deterministic slave API key (no regeneration)
- [x] Slave-facing API (products, sync, orders) with HMAC auth
- [x] mapSlaveProduct() — dual format (Aimeos + new)
- [x] Site Theme CRUD (JSONB on Store + Site Builder UI)
- [x] Site Page CRUD (model + routes + multi-lang content)
- [x] Site Menu CRUD (model + routes + multiple locations)
- [x] Frontend Site Builder (logo, colors, fonts, CSS)
- [x] Frontend Menüler page
- [x] HMAC secret warning in production
- [ ] Go slave geri getir (opsiyonel)

### Phase 7 — Core API + Auth + Store/Plan ✅ TAMAMLANDI
- [x] Auth: JWT (access/refresh) + API Key HMAC middleware
- [x] Store/Plan/Subscription CRUD + Stripe webhook
- [x] Tenant middleware (req.store) + otomatik storeId filter
- [x] API Key yönetimi (create/list/revoke, HMAC secret)
- [x] Frontend api-client.ts zaten Node.js API'sini kullanıyor
- [x] Mobile api-client.ts zaten Node.js API'sini kullanıyor

### Phase 8 — Product + Category + Variation ✅ TAMAMLANDI
- [x] Product CRUD (backend full + frontend sayfa)
- [x] Category tree (backend full + frontend sayfa)
- [x] Variation/Option/Variant CRUD (backend full + frontend sayfa)
- [x] Marketplace config per product (categoryId, brandId, attributes per mp)
- [x] Frontend Products sayfası entegrasyonu (filtreler, modal, AI)
- [x] Mobile CRUD methods — `mobile-app/src/shared/api-client.ts`: category create/update/delete + tree/flat, variation CRUD + option add/update/delete

### Phase 9 — Marketplace Integrations ✅ TAMAMLANDI
- [x] Integration CRUD (Trendyol/HB/Pazarama/N11/Amazon/Etsy tam)
- [x] **Import**: BullMQ workers (`marketplace-import` queue) + `mapMarketplaceProduct()` normalization
- [x] **Push**: BullMQ workers (`product-sync` queue) → marketplace clients (create/update/price/stock)
- [x] **Webhook**: Integration service (order/stock/price) + signature verification
- [x] **Etsy**: OAuth flow (connect + callback) + Listing CRUD (full client)
- [x] Frontend Integrations sayfası (import/poll, config form, Etsy OAuth connect)

### Model Cleanup (Phase 9 Technical Debt)
- [x] Removed duplicate model files: `ExtraModels.ts`, `extra-models.ts`, `content-models.ts`, `StoreExtras.ts`, `Variation.model.ts`, `VariationOption.model.ts`, `OrderModels.ts`
- [x] Fixed `IntegrationLog` (3 definitions → 1 in `LogModels.ts`)
- [x] Fixed `DropshippingOrder` / `OrderStatusHistory` multiple definitions → single source in `.model.ts` files
- [x] Added `DELETE /api/admin/integrations/:marketplace` endpoint
- [x] Added `DELETE /api/admin/integrations/:marketplace/listings/:productId` endpoint
- [x] Added `GET /api/admin/integration/logs` endpoint with filtering
- [x] Fixed frontend `getImportJobStatus` path (`/sync/import/` → `/integrations/:marketplace/import/`)
- [x] Fixed frontend `syncProduct` path (`/sync/product/` → `/products/:id/sync`)
- [x] Implemented Amazon write operations (`createProduct`, `updateProduct`, `updatePrice`, `updateStock`)
- [x] Implemented N11 `getCategories`, `getOrders`, `getOrder`
- [x] Added Etsy OAuth callback endpoint

### Phase 10 — B2B Sistemi (Golden'dan gelişmiş) ✅ TAMAMLANDI
- [x] ProductB2bSetting (isEnabled, discount, price)
- [x] B2B Discover (seller storeId filter + enrichProduct)
- [x] B2B Request (create, incoming/outgoing, approve/reject)
- [x] **Clone + List**: `listB2BProduct` (variant destekli, profitMargin, originalProductId/originalStoreId referans)
- [x] Frontend B2B Keşfet + Talepler + Listed

### Phase 11 — AI Gateway & Provider Yönetimi ⏳ DEVAM EDİYOR

#### AI Provider/Model/Scenario/RL Yönetimi ✅ TAMAMLANDI
- [x] **AiModels.ts** — AiProvider, AiModel, AiScenario, AiProviderRateLimit, AiUsageLog modelleri (Sequelize)
- [x] **Super admin API** — `/api/admin/ai/providers`, `/ai/models`, `/ai/scenarios`, `/ai/rate-limits`, `/ai/usage-logs` (full CRUD + validator)
- [x] **Frontend api-client.ts** — Tüm AI yönetim metotları (get/create/update/delete)
- [x] **AI Sağlayıcılar sayfası** (`/ai-providers`) — Provider list + inline model CRUD (create/edit/delete)
- [x] **AI Senaryoları sayfası** (`/ai-scenarios`) — 5 ön tanımlı senaryo (analyze_product, generate_description, chat, search, recommend) için model/parametre/kredi atama
- [x] **AI Rate Limits sayfası** (`/ai-rate-limits`) — Sağlayıcı bazında dakika/saat/gün limit tanımlama
- [x] **Setting modeli** (`Setting.model.ts`) — Global anahtar-değer deposu (Etsy OAuth credential'ları için)
- [x] **Super admin nav** — Tüm AI sayfaları linklendi

#### AI Gateway & Provider Yönlendirme ✅ TAMAMLANDI
- [x] **AI Gateway Proxy** — Core'den `/api/ai/*` endpointleri → ai-service'e yönlendirme (key injection ile, `buildProviderPayload`)
- [x] **Vision provider yönlendirmesi** — `llmProvider.ts` artık vision destekli: `ChatMessage` içinde `image_url` data-URI (OpenAI-compatible + Gemini `inline_data` + Ollama `images` base64); `visionAnalyzer.ts` görsel analizini hardcoded Ollama yerine yapılandırılan provider üzerinden yapar (Ollama fallback korunur)
- [x] **Senaryo kodu birleştirme** — `analyze_product`, `generate_description`, `process_image`, `agentic_listing`, `chat`, `search`, `recommend` (tire → underscore); superadmin `SCENARIO_CODES` + `AiModels.code` yorumu güncellendi

#### AI İşlevleri
- [x] analyze-product (görsel analizi → kategori/özellik önerisi)
- [x] generate-description (başlık + özellikler → SEO açıklama)
- [x] chat (müşteri destek / ürün soruları)
- [x] search (semantik ürün arama)
- [x] recommend (cross-sell / up-sell önerileri)

### Agentik İlan Akışı (`agentic_listing`) ✅ TAMAMLANDI
- [x] **ai-service `/ai/agentic-listing`** — `services/agenticListing.ts`: fotoğraf → vision specs (`analyzeProductImage`) → tam ilan taslağı (başlık, kısa+uzun açıklama, SEO meta, keywords, slug, kategori, attributes, Amazon bullet points, opsiyonel fiyat aralığı önerisi); multipart `image` VEYA JSON `{ imageUrl, category, suggest_price, target_marketplaces, provider?, model? }`
- [x] **core proxy `POST /api/admin/ai/agentic-listing`** — scenario `agentic_listing`, default 12 kredi; kredi kesimi + `AiUsageLog`; modül `ai_product_create`
- [x] **frontend api-client `agenticListing()`** — görsel URL + seçeneklerle JSON post
- [x] **AI sayfası "Agentik İlan" sekmesi** (`/ai`) — kategori seçimi, fotoğraf yükleme, satıcı notu/keywords, hedef pazaryeri çip'leri (Trendyol/N11/HB/Pazarama/Amazon/Etsy), fiyat önerisi toggle, taslak düzenleme (başlık/kategori/fiyat/stok/açıklama), AI tespit detayı (attributes + bullet points), "Ürünü Oluştur" (`marketplaces` ile ürün yaratır)
- [x] **Doğrulamalar** — ai-service `tsc` ✅, core build ✅, frontend build ✅ (43 route)

#### AI Gateway & API Key Yönetimi
- [x] **Global AI Settings (Super Admin)** — `GET|PUT /api/admin/ai/settings` (Setting modeli `ai` anahtarı): varsayılan provider/model seçimi (senaryoda provider/model yoksa fallback) + sağlayıcı API key deposu (openai/openrouter/nvidia/deepseek/mistral/google; key'ler masked, boş kaydedilerek silinir); frontend `/ai-settings` sayfası + super admin nav
- [x] **AI Gateway fallback** — `resolveScenarioConfig` senaryoda provider/model yoksa global default'a düşer; `buildProviderPayload` provider.authConfig yoksa global key'i kullanır; hiçbiri yoksa ai-service Ollama default'a düşer
- [x] **Analyze-product 500 fix (double `/v1`)** — `ai-service/llmProvider.ts`: `callOpenAiCompatible` endpoint'i artık `resolveChatEndpoint()` ile çözer; baseUrl `https://api.openai.com/v1` gibi `/v1` ile bitiyorsa tekrar `/v1` eklenmez (`/v1/chat/completions` → doğru). Scheme yoksa `https://` öneki eklenir, tam `.../v1/chat/completions` girişi de kabul edilir. `providerError` hata mesajına `[status]` öneki eklendi (UI'da gerçek upstream hatası görünür). Ai-providers formu placeholder `https://api.openai.com` yapıldı + `/v1` otomatik eklenir notu.
- [ ] **Per-Store AI Override (Opsiyonel)** — Mağaza bazında farklı key/model kullanımı
- [ ] **API Key Gizliliği** — Keyler sadece super admin panelinde, seller panelinde GÖRÜNMEZ (zaten öyle; `stripApiKey` mevcut)

#### Sipariş & Diğer
- [x] Dropshipping Order (create, status, tracking, history, split by vendor)
- [x] Express Checkout (address, payment methods, cart)
- [x] XML Feed (import wizard, mapping, auto-sync)
- [x] Store Location, Payment Methods, Shipping

### Order Page & N11/Pazarama Integration ✅ TAMAMLANDI
- [x] Order list page full rewrite with marketplace tabs (Tüm Siparişler, Trendyol, N11, HB, Pazarama, Amazon, Etsy), per-tab import, import-all button
- [x] Import-all endpoint: `POST /api/admin/integration/import-all` + frontend `importAllOrders()`
- [x] Customer name display fix: `customerName`/`customerEmail`/`customerPhone` columns now properly populated on order import; backfill SQL for existing orders
- [x] N11 order integration complete: field mapping (`customerfullName`, `gsm`, `stockCode`, `orderLineId`, cargo fields, `UnPacked`/`UnSupplied` statuses), approve flow with lineIds
- [x] N11 product sync fixes: `getExternalId` uses `stockCode`; mapper sends `status`, HTTPS images, validated `vatRate`, `maxPurchaseQuantity`; create uses `ensureHttps`+`validateVatRate`; update only sends allowed fields
- [x] Pazarama client full rewrite (`packages/core/src/marketplace/clients/pazarama.ts`): OAuth2 auth with `{success, data: {accessToken}}` flow; `getBrands()`, `getCategoryWithAttributes()`, `getCities()`, `getSellerDeliveries()`, `getProductBatchResult()`, `updatePrices()`, `updateStocks()`; product create/update with PascalCase fields + `images[].imageurl` + `attributes[].attributeId/valueId`; order list via `POST /order/getOrdersForApi`
- [x] **Pazarama product push (Tamamlandı)**: `POST /product/create` + `{ products: [...] }` array wrapper; `BrandId`/`CategoryId` **GUID string** olarak gönderilir (`Number()` ile `NaN → null` olan latent bug düzeltildi, `pazarama.ts:289`); mapper `_skip` guard (kategori/marka atanmamış ürün API'ye hiç gönderilmez); `getBrands` **PascalCase `Page`/`Size`** parametresi ile çekilir (lowercase gönderilince API default page=1/size=100 döndürüp sadece 100 marka geliyordu → `Size: 100000` tek istekte tümü)
- [x] Pazarama product mapper updated: PascalCase fields (`Name`, `DisplayName`, `BrandId`, `Code`, `StockCount`, `CategoryId`, `ListPrice`, `SalePrice`, `Desi`); HTTPS images; validated attribute/vat formats
- [x] Pazarama batch polling in `queues/index.ts`: 5-retry loop calling `getProductBatchResult`; externalId from `result.code` or `product.sku`
- [x] Order detail page (`[id]/page.tsx`): fully enriched (date, customer, payment, ZPL/cargo check, B2B badge, parent link, split info, raw data toggle)
- [x] Trendyol approve flow: `updatePackageStatus()` via `PUT /shipment-packages/{packageId}` instead of deprecated approve endpoint; ZPL label flow via `createCommonLabel`+`getCommonLabel`
- [x] B2B sub-order handling: sub-orders use parent's `marketplaceOrderId` (not synthetic); labels via parent store's integration; only main order pushes to marketplace; status propagates parent→subs
- [x] Integration-service PazaramaClient updated: correct `https://isortagimapi.pazarama.com` base URL, OAuth2 auth with token caching, order list via `POST /order/getOrdersForApi`

### Phase 12 — Frontend & Mobile Entegrasyon (1 hafta)
- [ ] Frontend: Tüm sayfalar yeni API'ye bağla
- [ ] Mobile: Tüm ekranlar yeni API'ye bağla (SecureStore token)
- [ ] Slave: PHP + Vercel config → yeni API Base + HMAC
- [ ] E2E test: Register → Store → Product → Marketplace → Order

### Phase 13 — Deployment & Migration (1 hafta)
- [ ] PostgreSQL migration script (MySQL → PG, Aimeos tabloları atılır)
- [ ] Docker images: core, ai, integration, frontend
- [ ] Portainer stack güncelle (env, volumes)
- [ ] Canlı test: Register → Product → Marketplace Push → Order

---

## Teknik Borçlar ve Riskler

| Risk | Etki | Mitigasyon |
|------|------|------------|
| MySQL → PostgreSQL migration | Yüksek | `pgloader` + custom script; Aimeos tabloları atılır, sadece core data taşınır |
| Aimeos → Sequelize mapping | Orta | `AimeosProductImporter` logic'i Sequelize `upsert` + relations'a çevrilir |
| Multi-tenant query performance | Orta | Composite index `(storeId, sku)`, `(storeId, status)`, pagination cursor-based |
| BullMQ job idempotency | Yüksek | `ProductMarketplaceListing` unique `(productId, platform)` + status check |
| Mobile app breaking changes | Yüksek | API versioning (`/api/v1/...`), eski endpoint'ler 3 ay desteklenir |
| Slave node uyumsuzluğu | Orta | Slave config `apiVersion` alanı, eski slave'ler 6 ay desteklenir |

---

## Ortam Değişkenleri (Yeni)

```env
# Core
DATABASE_URL=postgresql://user:pass@postgres:5432/rahatio
REDIS_URL=redis://redis:6379
JWT_SECRET=...
JWT_REFRESH_SECRET=...
RAHAT_INTERNAL_KEY=...          # HMAC for webhook/slave
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=rahatio-media
APP_URL=https://api.rahatio.com.tr

# Marketplace (store config'de tutulur, env fallback)
TRENDYOL_API_KEY=
TRENDYOL_API_SECRET=
TRENDYOL_SUPPLIER_ID=
HEPSIBURADA_USERNAME=
HEPSIBURADA_PASSWORD=
HEPSIBURADA_MERCHANT_ID=
PAZARAMA_CLIENT_ID=
PAZARAMA_CLIENT_SECRET=
PAZARAMA_API_KEY=
N11_APPKEY=
N11_APPSECRET=
AMAZON_REFRESH_TOKEN=
AMAZON_LWA_CLIENT_ID=
AMAZON_LWA_CLIENT_SECRET=
AMAZON_AWS_ACCESS_KEY=
AMAZON_AWS_SECRET_KEY=
AMAZON_SELLER_ID=
ETSY_CLIENT_ID=
ETSY_CLIENT_SECRET=
ETSY_REDIRECT_URI=

# AI Service
AI_SERVICE_URL=http://ai-service:3000
OLLAMA_URL=http://ollama:11434
COMFYUI_URL=http://comfyui:8188

# Integration Service
INTEGRATION_SERVICE_URL=http://integration-service:3001
CORE_API_KEY=...                # Internal service-to-service auth

# Frontend
NEXT_PUBLIC_API_URL=https://api.rahatio.com.tr
```

---

# Marketplace Push Sistemi (Product Sync)

## Mimari

```
Frontend (product form) → API → Product.marketplaceConfig (JSONB) → BullMQ (product-sync queue) → Sync Worker
  → mapProductForMarketplace() → marketplace client createProduct/updateProduct → ProductMarketplaceListing (DB)
```

## Veri Akışı

1. **Frontend** product formunda her marketplace için `category_id`, `brand_id`, `brand`, `attributes` seçilir
2. `handleSubmit` → `marketplace_data` objesi oluşturur → api-client `marketplaceConfig` olarak backend'e gönderir
3. **Backend** `Product.marketplaceConfig` JSONB kolonuna kaydeder
4. Product create/update sonrası otomatik `product-sync` kuyruğuna job eklenir (`packages/core/src/modules/product/routes.ts:196`)
5. **Sync Worker** (`packages/core/src/queues/index.ts`) product'ı yükler, her marketplace için mapper çağırır
6. **Mapper** `Product.marketplaceConfig[mp]` + `MarketplaceIntegration.config`'i birleştirerek marketplace API'sinin beklediği formata çevirir
7. Eğer daha önce listing oluşturulmamışsa → `createProduct()`; varsa → `updateProduct()` + `updatePrice()` + `updateStock()`

## Zorunlu Alanlar (Frontend → Backend → Mapper)

Her **marketplace** için product formunda `marketplace_data[mp]`'de şu alanlar TUTULUR:

| Alan | Tip | Açıklama |
|------|-----|----------|
| `category_id` | string | Marketplace kategorisi ID (catOpts'den seçilir) |
| `category` | string | Kategori adı (görsel) |
| `brand` | string | Marka adı (görsel) |
| `brand_id` | string | Marketplace brand ID (brOpts'dan, `Brand.marketplaceBrandId`) |
| `attributes` | array | Ürün attribute'ları (opsiyonel) |
| `on_sale` | boolean | Bu pazaryerinde satışta mı |
| `status` | number | 0/1 |

`brand_id`, **kategori ile aynı pattern** ile çalışır: `brandsFor()` fonksiyonu `{ id: Brand.marketplaceBrandId, name: Brand.name }` döndürür, kullanıcı seçince `brand_id` otomatik doldurulur.

## Marketplace Mapper'ları (`packages/core/src/marketplace/productMapper.ts`)

### Trendyol
```
mapProductForTrendyol(product, integration) → {
  barcode, title, productMainId, brandId, categoryId,
  quantity, stockCode, dimensionalWeight, description,
  currencyType: 'TRY', listPrice, salePrice, vatRate,
  cargoCompanyId, shipmentAddressId, returnAddressId,
  images: [{ url }], attributes: [{ attributeId, attributeValueId }]
}
```

| Alan | Kaynak | Zorunlu |
|------|--------|---------|
| `brandId` | `marketplaceConfig.trendyol.brandId \|\| brand_id` | ✅ |
| `categoryId` | `marketplaceConfig.trendyol.categoryId \|\| category_id` | ✅ |
| `dimensionalWeight` | `entry.dimensionalWeight \|\| intConfig.dimensionalWeight \|\| 1` | ✅ |
| `cargoCompanyId` | `entry.cargoCompanyId \|\| intConfig.cargoCompanyId \|\| 0` | ✅ |
| `shipmentAddressId` | `entry.shipmentAddressId \|\| intConfig.shipmentAddressId \|\| 0` | ✅ |
| `returnAddressId` | `entry.returnAddressId \|\| intConfig.returnAddressId \|\| 0` | ✅ |
| `vatRate` | `entry.vatRate \|\| intConfig.vatRate \|\| 10` | ✅ |

`brandId` veya `categoryId` yoksa → `{ _skip: true, reason: '...' }` → ürün atlanır.

### N11
```
mapProductForN11(product, integration) → {
  title, description, categoryId, currencyType: 'TL',
  productMainId, preparingDay: 3, shipmentTemplate: '1',
  stockCode, quantity, barcode, images: [{ url, order }],
  attributes: [{ id, valueId, customValue }],
  salePrice, listPrice, vatRate, maxPurchaseQuantity
}
```

| Alan | Kaynak | Zorunlu |
|------|--------|---------|
| `categoryId` | `entry.categoryId \|\| category_id` | ✅ |
| `attributes` | `entry.attributes` → `[{ id, valueId }]` | Opsiyonel |
| Brand | `entry.brand` varsa → `{ id:1, customValue: brandName }` eklenir | Opsiyonel |

`categoryId` yoksa → `{ _skip: true, reason: 'N11 category not mapped' }`.

**N11 UpdateProduct (Ürün Bilgisi Güncelleme) — sadece bu alanlar gönderilmeli:**
```
stockCode, status ('Active'/'Suspended'), preparingDay, shipmentTemplate,
currencyType, productMainId (deleteProductMainId: true ile birlikte),
maxPurchaseQuantity (deleteMaxPurchaseQuantity: true ile birlikte),
description, vatRate
```
- `title` ve `categoryId` **CREATE-only alanlardır** — update'te gönderilirse task REJECT alır (n11 doc v9.0 §3.6).
- Fiyat/stok (`price-stock-update`): `listPrice` ve `salePrice` **birlikte** gönderilmeli, `listPrice ≥ salePrice`, küsurat nokta ile 2 hane.

### Hepsiburada
```
mapProductForHepsiburada(product, integration) → {
  merchantSku, name, description, categoryId, brandId,
  attributes: [{ attributeId, valueId }], images,
  listPrice, salePrice, quantity, cargoCompanyId,
  dispatchDuration: 3, vatRate: 10
}
```

### Pazarama
```
mapProductForPazarama(product, integration) → {
  Name, DisplayName, Description, BrandId, Code,
  StockCount, VatRate, ListPrice, SalePrice, CategoryId,
  Desi, GroupCode, images: [{ imageurl }],
  attributes: [{ attributeId, attributeValueId }]
}
```

| Alan | Kaynak | Zorunlu |
|------|--------|---------|
| `BrandId` | `entry.brandId` | ✅ (**GUID string** — sayısal ID değil; `0` gönderilirse `MER_30` hatası) |
| `CategoryId` | `entry.categoryId` | ✅ (**GUID string** — kategori ağacı `id` GUID döndürür) |
| `StockCount` | `product.quantity` | ✅ |
| `images[].imageurl` | `imageUrl` → `ensureHttps()` | ✅ |
| `attributes[].attributeId/attributeValueId` | `entry.attributes` | Opsiyonel |
| `VatRate` | `entry.vatRate` | ✅ (validated via `validateVatRate()`) |

`BrandId` veya `CategoryId` yoksa → `{ _skip: true, reason: '...' }` (ürün API'ye hiç gönderilmez).
`buildProductPayload()` (`pazarama.ts`): `BrandId`/`CategoryId` `Number()` ile dönüştürülmez — **GUID string** olarak geçirilir (`Number(GUID)` → `NaN` → JSON'da `null` → `MER_30` 400 hatası).

**Pazarama Product API**:
- **Base**: `https://isortagimapi.pazarama.com`
- **Create**: `POST /product/create` — body `{ products: [...] }` (async, returns `batchRequestId`; tek ürün object değil `products` array zorunlu — aksi halde `BAC_108: products alanını doldurunuz`)
- **Update**: `POST /product/create` (upsert by Code — ayrı update endpoint'i yok; PHP reference client `bluntk/pazarama` ile doğrulandı)
- **Batch result**: `GET /product/getProductBatchResult?BatchRequestId=...`
- **NOT**: `POST /product/CreateProduct` ve `POST /product/UpdateProductAndStockByCode` **404 döndürür** — kullanma
- **Auth**: OAuth2 via `POST https://isortagimgiris.pazarama.com/connect/token` with `grant_type=client_credentials`; response `{success: true, data: {accessToken, expiresIn}}`
- **Pricing/Stock update**: `POST /product/updatePrices` and `POST /product/updateStocks`
- **Order list**: `POST /order/getOrdersForApi` with `{StartDate, EndDate, Page, Size}`
- **No order status push**: Pazarama does not support order status/tracking push via API

### Amazon
```
mapProductForAmazon(product, integration) → {
  sellerSKU, title, description, categoryId, brand,
  images, listPrice, salePrice, quantity, attributes
}
```

### Etsy
```
mapProductForEtsy(product, integration) → {
  title, description, price, quantity, tags, images,
  categoryId, brand, whoMade: 'someone_else',
  whenMade: '2020_2024', taxonomyId
}
```

## ProductMarketplaceListing (Sync State)

```
ProductMarketplaceListing: { productId, storeId, platform, externalId, status, lastError, lastSyncedAt }
```

- `externalId`: Marketplace'teki ürünün ID'si (N11'de stockCode, Trendyol'de batchRequestId, Etsy'de listing_id)
- `status`: `'active' | 'pending' | 'failed'`
- `lastError`: Son hata mesajı (sync worker set eder)

**externalId stratejisi:**
- N11: `product.sku` (stockCode) — çünkü N11 update/sorgu stockCode ile yapılır
- Trendyol: `batchRequestId` — batch async create sonrası, gerçek product ID batch status sorgusuyla alınır (TODO)
- Etsy: `listing_id`
- Diğerleri: marketplace API yanıtından extract

## Sync Trigger'ları (Ne Zaman Sync Kuyruğa Eklenir)

Product update sonrası, `changedFields` şunlardan birini içeriyorsa sync tetiklenir:
```
['priceTRY', 'quantity', 'title', 'description', 'images', 'discountRate', 'isActive', 'marketplaces', 'marketplaceConfig']
```

Product create'te her zaman tetiklenir (eğer `marketplaces` array'i doluysa).

## Yeni Marketplace Ekleme

1. **Mapper**: `productMapper.ts`'e `mapProductFor<MP>()` fonksiyonu ekle, standart formatı marketplace API'sinin beklediği formata çevir
2. **Mapper switch**: `mapProductForMarketplace()` switch case'ine ekle
3. **Client**: `marketplace/clients/` altına client ekle, `createProduct`, `updateProduct`, `updatePrice`, `updateStock` implemente et
4. **Factory**: `marketplace/clients/index.ts`'e `createMarketplaceClient()` ve `getMarketplaceConfig()` case'ini ekle
5. **Frontend**: `marketplaceOptions` array'ine ekle (`page.tsx:134`)
6. **Frontend kategori ağacı**: Varsa marketplace kategorileri `getMarketplaceTrees()` ile yüklenir
7. **Frontend marka**: `Brand.marketplace` alanı ile filtrelenir, `marketplaceBrandId` ile ID tutulur
8. **External ID**: Sync worker'da yeni marketplace için externalId stratejisini belirle
9. **Migration**: Yok (JSONB + kod tabanlı, DB migration gerektirmez)

---

## Notlar

1. **Golden-Marketplace KODU DOKUNMUYORUZ** — Sadece mimari/pattern/kod parçalarını referans alıyoruz (`golden-marketplace/backend/src/` altındaki controller/service/job/integration dosyalarını okuyoruz).

2. **Mevcut Rahatio verisi** — Aimeos tabloları atılır. Sadece `stores`, `users`, `api_keys`, `subscriptions`, `marketplace_integrations`, `categories`, `products` (Sequelize modeline map edilerek), `b2b_*` tabloları taşınır. Migration script'i yazılır.

3. **Frontend/Mobile** — Mevcut UI/UX korunur. Sadece `api-client.ts` base URL + endpoint path'leri güncellenir. TypeScript tipleri `packages/core/src/types/` ile paylaşılır.

4. **Slave Nodes** — Mevcut `slave/php/slave.php` ve `slave/vercel/` korundu, sadece `config.apiBase` ve HMAC secret yeni Core API'sine işaret eder.

5. **AI Service** — Mevcut `ai-service/` paket olarak taşınır, Core'den `/api/ai/*` proxy ile çağrılır.

---

# Trendyol Integrasyonu (V2 API)

## Genel Bilgi

| Bilgi | Değer |
|-------|-------|
| Supplier ID | 384219 |
| API Base (Product) | `https://apigw.trendyol.com/integration/product` |
| API Base (Order) | `https://apigw.trendyol.com/integration/order` |
| API Base (Inventory) | `https://apigw.trendyol.com/integration/inventory` |
| Auth | HTTP Basic Auth (`apiKey:apiSecret` Base64) |
| V1 Kapanış | 10 Ağustos 2026 — V1 product servisleri kapanıyor |
| Rate Limit (Product) | 60 req/min |
| Rate Limit (Order) | 600 req/min |
| Attribute Formatı (V2) | `attributeValueIds: [1,2,3]` (multi-value) + `customAttributeValue` (custom text) |

## Authentication

Trendyol, HTTP Basic Auth kullanır. `apiKey:apiSecret` → Base64 → `Authorization: Basic <base64>`.

```typescript
'Authorization': `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`
'User-Agent': supplierId  // zorunlu!
'Content-Type': 'application/json'
```

## Client Mimarisi (`packages/core/src/marketplace/clients/trendyol.ts`)

TrendyolClient extends BaseMarketplaceClient. Üç farklı Axios instance kullanır:

| Instance | Base URL | Kullanım |
|----------|----------|----------|
| `this.client` (inherited) | `/integration/product` | Product CRUD, kategori, marka, batch |
| `this.orderClient` | `/integration/order` | Sipariş listeleme, approve, ship, invoice, cancel |
| `updatePriceAndInventory` | `/integration/inventory` | Stok+fiyat toplu güncelleme |

**ÖNEMLİ**: `getOrders()` ve `getOrder()` METOTLARI `orderClient` KULLANMALIDIR. Product client kullanılırsa 404/hatalı URL oluşur.

### TrendyolClient Metotları

#### Product Metotları
| Metot | Endpoint | Açıklama |
|-------|----------|----------|
| `getCategories()` | `GET /product-categories` | Kategori ağacı döndürür |
| `getCategoryAttributes(categoryId)` | `GET /product-categories/{id}/attributes` | Kategori attribute'ları (V2) |
| `getBrands(search?)` | `GET /brands?name=&size=1000` | Marka listesi |
| `getProducts({page, size})` | `GET /sellers/{id}/products/approved` | Onaylı ürünleri getir |
| `getApprovedProductsStockAndPrice({page, size})` | `GET /sellers/{id}/products/approved/inventory-and-price` | Onaylı ürünlerin stok+fiyatı |
| `getProductByBarcode(barcode)` | `GET /sellers/{id}/product/{barcode}` | Barkod ile ürün sorgula |
| `createProduct(product)` | `POST /sellers/{id}/v2/products` | **V2** ürün oluşturma (async, batchRequestId döner) |
| `updateProduct(productId, product)` | `PUT /sellers/{id}/products/{productId}` | Onaylı ürün güncelleme |
| `updateUnapprovedProduct(product)` | `POST /sellers/{id}/products/unapproved-bulk-update` | Onaysız ürün güncelleme |
| `updatePriceAndInventory(items)` | `POST /sellers/{id}/products/price-and-inventory` | Toplu stok+fiyat güncelleme |
| `updatePrice(productId, price)` | `POST /sellers/{id}/products/{productId}/price` | Tek ürün fiyat güncelleme |
| `updateStock(productId, quantity)` | `PUT /sellers/{id}/products/{productId}/stock` | Tek ürün stok güncelleme |
| `getBatchRequestResult(batchId)` | `GET /sellers/{id}/products/batch-requests/{batchId}` | Async batch sonucu sorgula |

#### Order Metotları
| Metot | Endpoint | Açıklama |
|-------|----------|----------|
| `getOrders({startDate, endDate, page, size, status, orderByField, orderByDirection})` | `GET /sellers/{id}/orders` | Sipariş paketlerini listele |
| `getOrder(orderId)` | `GET /sellers/{id}/orders/{orderId}` | Tek sipariş detayı |
| `updateOrderStatus(orderId, status)` | `PUT /sellers/{id}/orders/{orderId}/{action}` | Onayla/faturala/iptal et |
| `cancelOrder(orderId, reason)` | `PUT /sellers/{id}/orders/{orderId}/cancel` | Sipariş iptal |
| `updateTracking(orderId, trackingNumber, carrier)` | `PUT /sellers/{id}/orders/{orderId}/ship` | Kargo bilgisi gir |

## Product Sync Flow (`packages/core/src/queues/index.ts`)

### Push (Rahatio → Trendyol)

```
Frontend "Sync" butonu / Product create/update
    → api-client.syncProduct()
    → POST /api/admin/products/:id/sync
    → BullMQ (product-sync queue)
    → Sync Worker
        ├─ existingListing?.externalId var mı?
        │   ├─ EVET: batchRequestId mi? (UUID formatı)
        │   │   ├─ EVET: Poll batch result
        │   │   │   ├─ COMPLETED + SUCCESS → real productId al, listing'i güncelle
        │   │   │   ├─ COMPLETED + FAILED → listing destroy, shouldCreate=true
        │   │   │   └─ IN_PROGRESS / items=[] → batchRequestId saklanır, bir sonraki sync'te tekrar poll
        │   │   └─ HAYIR (real productId): updateProduct() + updatePrice() + updateStock()
        │   └─ YOK: shouldCreate = true
        ├─ shouldCreate = true:
        │   └─ createProduct (V2) → batchRequestId
        │       └─ catch "recurring.create.not.allowed":
        │           └─ strip {listPrice, salePrice, quantity, currencyType}
        │           └─ updateUnapprovedProduct() (fallback)
        └─ Batch polling (5 kez, 2sn aralık):
            ├─ SUCCESS → real productId
            ├─ FAILED → listing status='failed'
            └─ timeout/IN_PROGRESS → batchRequestId externalId olarak kalır
```

**ÖNEMLİ**: External ID stratejisi:
- Başarılı create → gerçek Trendyol product ID (numeric)
- Batch hala işleniyor → batchRequestId (UUID)
- Hata durumunda listing destroy edilir, bir sonraki sync'te tekrar dener

### Import (Trendyol → Rahatio)

```
Frontend "Import Products" butonu
    → POST /api/admin/integrations/:mp/import
    → BullMQ (marketplace-import queue)
    → Import Worker
        ├─ getProducts(page) → onaylı ürünler
        ├─ getApprovedProductsStockAndPrice(page) → stok+fiyat (merge edilir)
        ├─ normalizeMarketplaceProduct() → Product.upsert
        └─ ProductMarketplaceListing.upsert (externalId = barcode/stockCode)
```

### Product Mapper (`packages/core/src/marketplace/productMapper.ts`)

`mapProductForTrendyol(product, integration)` → Trendyol V2 formatı:

```json
{
  "barcode": "SKU-123",             // = product.sku
  "title": "Ürün Adı",              // = product.title
  "productMainId": "SKU-123",       // = product.sku
  "brandId": 1976661,               // marketplaceConfig.trendyol.brandId
  "categoryId": 900,                // marketplaceConfig.trendyol.categoryId
  "quantity": 10,                   // = product.quantity
  "stockCode": "SKU-123",           // = product.sku
  "dimensionalWeight": 1,           // marketplaceConfig.trendyol.dimensionalWeight
  "description": "...",
  "currencyType": "TRY",
  "listPrice": 300,
  "salePrice": 300,
  "vatRate": 10,                    // marketplaceConfig.trendyol.vatRate
  "shipmentAddressId": 12345,       // SADECE >0 ise gönderilir
  "returningAddressId": 12345,      // SADECE >0 ise gönderilir (v2 adı: returningAddressId)
  "images": [{ "url": "..." }],
  "attributes": [
    { "attributeId": 338, "attributeValueId": 76662 },
    { "attributeId": 346, "customAttributeValue": "Siyah" }
  ]
}
```

**Attribute formatı (V2)**:
- `customValue` → `customAttributeValue` olarak gönderilir
- Girişte hem `customValue` hem `customAttributeValue` okunur
- `attributeValueIds: [1,2,3]` formatı henüz desteklenmiyor (TODO)

**Skip koşulları**:
- `categoryId` yok → `{ _skip: true, reason: 'Trendyol kategorisi atanmamış' }`
- `brandId` yok → `{ _skip: true, reason: 'Trendyol marka ID atanmamış' }`

## Sipariş Yönetimi (Order Flow)

### Trendyol Sipariş Durumları

```
Created → Picking → Invoiced → Shipped → Delivered
                                ↘ Cancelled
```

| # | Durum | Anlamı | Bizim Aksiyon |
|---|-------|--------|---------------|
| 1 | Created | Sipariş oluştu, ödeme onaylandı | approve (Picking'e çek) |
| 2 | Picking | Hazırlanıyor | Hazırla, kargola |
| 3 | Invoiced | Fatura kesildi | ship (kargo no gir) |
| 4 | Shipped | Kargoda | Takip et |
| 5 | Delivered | Teslim edildi | - |
| 6 | Cancelled | İptal edildi | Stokları geri aç |

### Trendyol API Sipariş Listeleme

```
GET /sellers/{supplierId}/orders
  ?status=Created           // Durum filtresi
  &startDate=1717000000000  // Timestamp (ms) - max 1 ay geri
  &endDate=1717000000000    // Timestamp (ms)
  &page=0                   // 0-indexed
  &size=50                  // Max 200
  &orderByField=PackageLastModifiedDate
  &orderByDirection=DESC
  &orderNumber=             // Belirli bir sipariş no
```

**Yanıt**: `{ shipmentPackages: [ { id, status, lines: [], orderNumber, ... } ] }`

### Sipariş İşlem Akışı (Bizim Sistem)

```
TRENDYOL API                     │  RAHATIO SİSTEMİ
                                 │
  GET /orders?status=Created     →  Order Import Worker (periodic)
    → shipmentPackages[]         →  DropshippingOrder.create (storeId, marketplaceOrderId)
                                 │
  Seller approves                →  PUT /api/admin/orders/:id/status → status=processing
    → notifyIntegrationService   →  TrendyolClient.updateOrderStatus(orderId, 'Picking')
    → PUT /orders/{id}/approve   →  Trendyol: Created → Picking
                                 │
  Seller ships                   →  PUT /api/admin/orders/:id/status → status=shipped
    → PUT /api/admin/orders/:id/tracking
    → notifyIntegrationService   →  TrendyolClient.updateTracking(orderId, trackingNo, carrier)
    → PUT /orders/{id}/ship      →  Trendyol: Picking → Invoiced/Shipped
                                 │
  Seller cancels                 →  PUT /api/admin/orders/:id/status → status=cancelled
    → notifyIntegrationService   →  TrendyolClient.cancelOrder(orderId, reason)
    → PUT /orders/{id}/cancel    →  Trendyol: Cancelled
```

### Order Routes (`packages/core/src/modules/order/routes.ts`)

| Metot | Path | Açıklama |
|-------|------|----------|
| GET | `/api/admin/orders` | Liste (pagination, status/marketplace filtresi) |
| POST | `/api/admin/orders` | Manuel sipariş oluşturma (split by vendor) |
| GET | `/api/admin/orders/:id` | Detay + status history + subOrders |
| PUT | `/api/admin/orders/:id/status` | Durum güncelle (pending→confirmed→processing→shipped→delivered→cancelled) |
| PUT | `/api/admin/orders/:id/tracking` | Kargo no + firma gir |
| POST | `/api/admin/orders/bulk-status` | Toplu durum güncelleme |
| GET | `/api/admin/orders/:id/history` | Status history |
| DELETE | `/api/admin/orders/:id` | Sil |

### DropshippingOrder Model

| Alan | Tip | Açıklama |
|------|-----|----------|
| id | int (PK) | |
| storeId | int (FK) | Multi-tenant |
| parentOrderId | int? | Sub-order için parent |
| orderNumber | string | ORD-{timestamp} |
| marketplace | string | trendyol, n11, storefront vb. |
| marketplaceOrderId | string | Trendyol shipmentPackage ID |
| marketplaceOrderNumber | string | Trendyol orderNumber |
| status | string | pending→confirmed→processing→shipped→delivered→cancelled→returned |
| paymentMethod | string | stripe, bank_transfer, vb. |
| paymentStatus | string | pending, awaiting, paid, failed, refunded |
| totalAmount | float | |
| currency | string | TRY, USD |
| shippingAddress | JSON | { fullName, phone, city, district, address, zipCode } |
| items | JSON[] | [{ sku, name, quantity, price, image }] |
| trackingNumber | string | Kargo takip no |
| carrier | string | Kargo firması |
| notes | text | |

## Webhook & Trendyol

Trendyol, webhook ile sipariş durum değişikliklerini bildirebilir (CREATED, SHIPPED vb.). Henüz Trendyol webhook aboneliği eklenmedi.

### Mevcut Webhook Endpoint'leri (Core'daki integration routes)

```
POST /api/admin/integrations/webhook/order   → DropshippingOrder.create
POST /api/admin/integrations/webhook/stock   → Product.quantity update
POST /api/admin/integrations/webhook/price   → Product.priceTRY update
```

### Trendyol Webhook API (Henüz implemente edilmedi)

| Metot | Endpoint | Açıklama |
|-------|----------|----------|
| POST | `/sellers/{id}/webhooks` | Webhook oluştur |
| GET | `/sellers/{id}/webhooks` | Webhook'ları listele |
| PUT | `/sellers/{id}/webhooks/{id}` | Webhook güncelle |
| DELETE | `/sellers/{id}/webhooks/{id}` | Webhook sil |
| PUT | `/sellers/{id}/webhooks/{id}/activate` | Aktif et |
| PUT | `/sellers/{id}/webhooks/{id}/deactivate` | Pasif et |

## Known Issues & Çözümler

| # | Sorun | Çözüm | Durum |
|---|-------|-------|-------|
| 1 | `shipmentAddressId:0` → "Adres bulunamadı" | Mapper'da `if (shipmentAddressId)` ile koşullu gönder | ✅ Düzeltildi |
| 2 | `returnAddressId` → V2'de `returningAddressId` | Mapper'da field adı düzeltildi | ✅ Düzeltildi |
| 3 | `cargoCompanyId` V2'de geçersiz | Mapper'dan çıkarıldı | ✅ Düzeltildi |
| 4 | `getOrders()` product baseURL kullanıyor | `this.orderRequest` kullanacak şekilde düzeltildi | ✅ Düzeltildi |
| 5 | `getOrder()` product baseURL kullanıyor | `this.orderRequest` kullanacak şekilde düzeltildi | ✅ Düzeltildi |
| 6 | Batch polling'de `items: []` race condition | externalId=batchId olarak kalır, sonraki sync'te poll tekrar dener | ⚠️ Accept edildi |
| 7 | "recurring.create.not.allowed" hatası | Fallback: updateUnapprovedProduct (price/stock alanları strip edilir) | ✅ Çözüldü |
| 8 | Pazarama "Token bulunamadı" | Pazarama auth OAuth2 ile düzeltildi (`success.data.accessToken`) | ✅ Düzeltildi |
| 9 | Stok import = 0 | `getApprovedProductsStockAndPrice` eklendi, import worker'da merge | ✅ Düzeltildi |
| 10 | V2 attrs: `customValue` → `customAttributeValue` | Mapper output'ta değiştirildi, input'ta ikisi de okunur | ✅ Düzeltildi |
| 11 | Trendyol webhook yönetimi | TrendyolClient'e webhook CRUD metotları eklenmedi | ⏳ Yapılacak |
| 12 | Order import (periodic fetch) | Manuel sync var, otomatik periyodik yok | ⏳ Yapılacak |
| 13 | N11 ZPL label yok | N11'de ZPL/etiket API'si yok; sadece takip no + kargo firması girilir | ⚠️ Accept edildi |
| 14 | Pazarama order status push yok | Pazarama order status/tracking push API'sini desteklemiyor | ⚠️ Accept edildi |
| 15 | Pazarama sadece 100 marka çekiyor | `getBrands` lowercase `page/size` gönderiyordu (API yoksayıyor → default 100). PascalCase `Page`/`Size: 100000` ile tek istekte tümü | ✅ Düzeltildi |
| 16 | Pazarama `BrandId:null` → 400 MER_30 | Mapper `_skip` guard (kategori/marka atanmamışsa API'ye hiç gönderme) + `buildProductPayload` `Number()` kaldırıldı (GUID string geçer) | ✅ Düzeltildi |

## Yeni Marketplace Ekleme (Trendyol referans alınarak)

Her yeni marketplace için aynı pattern uygulanır. Trendyol'da olduğu gibi:

1. **Client**: `packages/core/src/marketplace/clients/<mp>.ts` → TrendyolClient pattern'ini kopyala
2. **Mapper**: `packages/core/src/marketplace/productMapper.ts` → `mapProductFor<MP>()`
3. **Factory**: `packages/core/src/marketplace/clients/index.ts` → createMarketplaceClient + getMarketplaceConfig
4. **Sync Worker**: `packages/core/src/queues/index.ts` → externalId stratejisi + batch varsa polling
5. **Frontend**: `marketplaceOptions` array'ine ekle + kategori/marka yükleme
6. **Order**: Varsa order endpoint'leri (getOrders, getOrder, updateOrderStatus, updateTracking)

**ÖNEMLİ**: Trendyol dosyalarına (`trendyol.ts`, `productMapper.ts`'deki trendyol kısmı, `queues/index.ts`'deki trendyol kısımları) **dokunulmaz**. Yeni marketplace kendi client/mapper dosyasında implemente edilir, factory'ye eklenir.

---

## Onay ve Başlangıç

Bu plan onaylanırsa **Phase 0** ile başlarız (Monorepo scaffold + Core scaffold + Docker Compose).
