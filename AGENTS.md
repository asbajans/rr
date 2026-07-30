# Rahatio Monorepo - AGENTS.md

## Genel Bilgi

Monorepo: `rr` (Rahatio)
GitHub: `https://github.com/asbajans/rr`
Portainer Stack: `rahatio-stack` (ID: 75)
Portainer API: `https://cont.asb.web.tr` (Endpoint 2, X-API-Key auth)
Portainer Webhook: `51a90d30-c009-468f-b1bd-a72bf09abc7d`
Domain: `rahatio.com.tr` → Cloudflare proxied → Portainer sunucu
Portainer API Key: `ptr_eQgVWsrcy0/nOY5h9buCwok0bMVeajidA1eqiYqIncU=`

---

# Work State (Session History)

## Tamamlananlar

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
- [ ] CSS bug: dropdown/select white text on white background
- [ ] Global design improvements (inputs, buttons, cards, tables, scrollbars)
- [ ] Consistent spacing/tokens across all dashboard pages
- [ ] Loading states (skeleton screens, spinners)
- [ ] Error/empty state improvements
- [ ] Responsive layout fixes
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
- [ ] Mobile CRUD methods (category create/update/delete + variation methods)

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

#### AI Gateway & API Key Yönetimi (Sıradaki)
- [ ] **Global AI Settings (Super Admin)** — NVIDIA developer key, OpenRouter key, default model seçimi
- [ ] **Per-Store AI Override (Opsiyonel)** — Mağaza bazında farklı key/model kullanımı
- [ ] **API Key Gizliliği** — Keyler sadece super admin panelinde, seller panelinde GÖRÜNMEZ
- [ ] **AI Gateway Proxy** — Core'den `/api/ai/*` endpointleri → ai-service'e yönlendirme (key injection ile)

#### AI İşlevleri
- [ ] analyze-product (görsel analizi → kategori/özellik önerisi)
- [ ] generate-description (başlık + özellikler → SEO açıklama)
- [ ] chat (müşteri destek / ürün soruları)
- [ ] search (semantik ürün arama)
- [ ] recommend (cross-sell / up-sell önerileri)

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
| `BrandId` | `entry.brandId` | ✅ |
| `CategoryId` | `entry.categoryId` | ✅ |
| `StockCount` | `product.quantity` | ✅ |
| `images[].imageurl` | `imageUrl` → `ensureHttps()` | ✅ |
| `attributes[].attributeId/attributeValueId` | `entry.attributes` | Opsiyonel |
| `VatRate` | `entry.vatRate` | ✅ (validated via `validateVatRate()`) |

`BrandId` veya `CategoryId` yoksa → `{ _skip: true, reason: '...' }`.

**Pazarama Product API**:
- **Base**: `https://isortagimapi.pazarama.com`
- **Create**: `POST /product/CreateProduct` (async, returns `batchRequestId`)
- **Update**: `POST /product/UpdateProductAndStockByCode` (sync)
- **Batch result**: `GET /product/getProductBatchResult?BatchRequestId=...`
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