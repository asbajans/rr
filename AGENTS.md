# Rahatio Monorepo - AGENTS.md

## Genel Bilgi

Monorepo: `rr` (Rahatio)
GitHub: `https://github.com/asbajans/rr`
Portainer Stack: `rahatio-stack` (ID: 66)
Portainer API: `https://cont.asb.web.tr` (Endpoint 2, X-API-Key auth)
Portainer Webhook: `d6050fb9-2679-4422-902f-916da4785ca6`
Domain: `rahatio.com.tr` → Cloudflare proxied → Portainer sunucu

---

# BİLİNEN HATALAR / BUG ENVANTERİ

Aşağıdaki tüm hatalar tespit edilmiş olup **Phase 1-6**'da sıralı olarak düzeltilecektir.

## ~~🔴 PHASE 1 — Sayfa Çökmesine Sebep Olan Kritik Hatalar~~ ✅ DÜZELTİLDİ

| # | Hata | Dosya(lar) | Çözüm |
|---|------|-----------|-------|
| 1 | **B2B discover: `Cannot read properties of undefined (reading 'length')`** | `api-client.ts` | B2B metodlarında async unwrap + field mapping eklendi |
| 2 | **B2B listed: aynı hata** | `api-client.ts` | Aynı çözüm |
| 3 | **B2B requests: `res.length` undefined** | `api-client.ts` | `raw.requests` unwrap + field mapping |
| 4 | **Store route prefix: tüm `/api/admin/store/*` 404** | `api-client.ts` | `/store/` prefix'i kaldırıldı |
| 5 | **Variant routes: `GET products/:id/variants` 404** | `product/routes.ts`, `variantRoutes.ts`, `routes.ts` | Product routes'a eklendi, mount `/api/admin/variants` yapıldı |
| 6 | **Variant routes: `PUT/DELETE /api/admin/variants/:id` asla eşleşmez** | `variantRoutes.ts`, `routes.ts` | Mount `/api/admin/variants` → `/:id` tek segment olarak çalışır |
| 7 | **Checkout route conflict: stub gerçek checkout'u ezer** | `publicStoreRoutes.ts` | Stub `POST /:siteCode/checkout` kaldırıldı |

## ~~🟠 PHASE 2 — Response Wrapper Uyumsuzlukları (Sayfalar Boş Görünür)~~ ✅ DÜZELTİLDİ

| # | Hata | Frontend | Backend Key | Çözüm |
|---|------|----------|-------------|-------|
| 8 | `getCategories()` undefined | `Category[]` bekler | `{ categories }` döner | `.then(r => r.categories)` |
| 9 | `getCategoryTree()` undefined | `Category[]` bekler | `{ categories }` döner | `.then(r => r.categories)` |
| 10 | `getCategory(id)` undefined | `Category` bekler | `{ category }` döner | `.then(r => r.category)` |
| 11 | `getIntegrations()` undefined | `MarketplaceIntegration[]` bekler | `{ integrations }` döner | `.then(r => r.integrations)` |
| 12 | `getVariations()` undefined | `Variation[]` bekler | `{ variations }` döner | `.then(r => r.variations)` |
| 13 | `getB2bSettings()` undefined | `ProductB2bSetting[]` bekler | `{ settings }` döner | Phase 1'de çözüldü |
| 14 | `getCategoriesFlat()` `res.data` undefined | `{ data }` bekler | `{ categories }` döner | `async` unwrap + `{ data: r.categories }` |
| 15 | `getProducts()` pagination mismatch | `{ data, current_page, ... }` bekler | `{ products, pagination: { page, limit, ... } }` döner | Pagination map `async` unwrap |

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

### Phase 0 — Kritik Hata Düzeltmeleri (Bu hafta)
- [ ] **B2B response shape**: `discover`, `listed`, `requests` response'larını frontend'in beklediği formata çevir
- [ ] **Store route prefix**: Frontend'deki `/api/admin/store/*` çağrılarını `/api/admin/*` yap
- [ ] **Variant routes**: Mount noktasını `/api/admin/variants` yap, path'leri düzelt
- [ ] **Checkout conflict**: Stub'ı `publicStoreRoutes`'tan kaldır
- [ ] **Response wrapper'lar**: Tüm `api-client.ts` get/list method'larına `.then(r => r.data)` unwrap ekle
- [ ] **Frontend API path fix**: Slave download ve sync path'lerini düzelt

### Phase 0.5 — Eksik Endpoint'ler (Bu hafta)
- [ ] Pages CRUD route'ları ekle (`packages/core/src/modules/page/routes.ts`)
- [ ] Dashboard stats endpoint'i ekle
- [ ] File upload route'u ekle (multer + MinIO)
- [ ] Feeds CRUD route'ları ekle
- [ ] Locations/Payment Methods admin route'ları ekle
- [ ] Bulk order status endpoint'i ekle
- [ ] AI credits log/stats endpoint'leri ekle
- [ ] AI status/output proxy route'ları ekle

### Phase 0.6 — Slave & Site Builder (1-2 hafta)
- [ ] `packages/core/src/modules/slave/routes.ts` download endpoint'lerini implement et (config injection + file serve)
- [ ] PHP slave template + download controller'ı TypeScript'e taşı
- [ ] Vercel slave template + ZIP oluşturma
- [ ] Vercel ZIP'e `package.json` ekle
- [ ] HMAC secret slave/internal ayrımı yap (`RAHAT_SLAVE_HMAC_SECRET`)
- [ ] API key download'da yenileme mantığını kaldır
- [ ] Slave `GET /api/slave/products` + `POST /api/slave/sync` endpoint'lerini ekle (Sequelize formatında)
- [ ] Site Theme modeli + CRUD route'ları
- [ ] Site Page modeli + CRUD route'ları (blocks JSONB ile)
- [ ] Site Menu modeli + CRUD route'ları
- [ ] Frontend Site Builder UI (renk/font/logo ayarları)
- [ ] Frontend drag-drop page editor
- [ ] Go slave geri getir (opsiyonel)

### Phase 7 — Core API + Auth + Store/Plan (1-2 hafta)
- [ ] Auth: JWT (access/refresh) + API Key HMAC middleware
- [ ] Store/Plan/Subscription CRUD + Stripe webhook
- [ ] Tenant middleware (req.store) + otomatik storeId filter
- [ ] API Key yönetimi (create/list/revoke, HMAC secret)
- [ ] Frontend `api-client.ts` → yeni endpoint'lere güncelle
- [ ] Mobile `api-client.ts` → yeni endpoint'lere güncelle

### Phase 8 — Product + Category + Variation (1-2 hafta)
- [ ] Product CRUD (image upload → MinIO, marketplace config per mp)
- [ ] Category tree (universal + marketplace mappings)
- [ ] Variation/Option/Variant CRUD
- [ ] Marketplace config per product (categoryId, brandId, attributes per mp)
- [ ] Frontend Products sayfası entegrasyonu (filtreler, modal, AI)
- [ ] Mobile Products sayfası entegrasyonu

### Phase 9 — Marketplace Integrations (2-3 hafta)
- [ ] Integration CRUD (Trendyol, Hepsiburada, Pazarama, N11, Amazon, Etsy)
- [ ] **Import**: Golden'dan `productSyncJob` mimarisi + Rahatio client'ları (TS port)
- [ ] **Push**: Product create/update → BullMQ → integration clients
- [ ] **Webhook**: Integration service (order/stock/price) → Core sync
- [ ] **Etsy**: Golden'dan tam OAuth + Listing CRUD al
- [ ] Frontend Integrations sayfası (import/poll, config form)

### Phase 10 — B2B Sistemi (Golden'dan gelişmiş) (1 hafta)
- [ ] ProductB2bSetting (isEnabled, discount, price)
- [ ] B2B Discover (seller storeId filter + enrichProduct)
- [ ] B2B Request (create, incoming/outgoing, approve/reject)
- [ ] **Clone + List**: Golden'dan `listB2BProduct` (variant destekli, profitMargin, originalProductId/originalStoreId referans)
- [ ] Frontend B2B Keşfet + Talepler + Listed

### Phase 11 — AI + Order + Extras (1-2 hafta)
- [ ] AI Gateway Proxy (Core → ai-service)
- [ ] AI: analyze-product, generate-description, chat, search, recommend
- [ ] Dropshipping Order (create, status, tracking, history, split by vendor)
- [ ] Express Checkout (address, payment methods, cart)
- [ ] XML Feed (import wizard, mapping, auto-sync)
- [ ] Store Location, Payment Methods, Shipping

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

## Notlar

1. **Golden-Marketplace KODU DOKUNMUYORUZ** — Sadece mimari/pattern/kod parçalarını referans alıyoruz (`golden-marketplace/backend/src/` altındaki controller/service/job/integration dosyalarını okuyoruz).

2. **Mevcut Rahatio verisi** — Aimeos tabloları atılır. Sadece `stores`, `users`, `api_keys`, `subscriptions`, `marketplace_integrations`, `categories`, `products` (Sequelize modeline map edilerek), `b2b_*` tabloları taşınır. Migration script'i yazılır.

3. **Frontend/Mobile** — Mevcut UI/UX korunur. Sadece `api-client.ts` base URL + endpoint path'leri güncellenir. TypeScript tipleri `packages/core/src/types/` ile paylaşılır.

4. **Slave Nodes** — Mevcut `slave/php/slave.php` ve `slave/vercel/` korundu, sadece `config.apiBase` ve HMAC secret yeni Core API'sine işaret eder.

5. **AI Service** — Mevcut `ai-service/` paket olarak taşınır, Core'den `/api/ai/*` proxy ile çağrılır.

---

## Onay ve Başlangıç

Bu plan onaylanırsa **Phase 0** ile başlarız (Monorepo scaffold + Core scaffold + Docker Compose).