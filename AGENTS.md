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
| `slave/` | Go (planlanan) | Self-hosted store daemon | — |
| `mobile-app/` | React Native (planlanan) | Mobil store management | — |
| `slave/` | Go | Self-hosted store node (SQLite cache, CRON sync, HMAC auth) | 3681 |

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

## Docker Port Haritası

| Container | Internal | External |
|-----------|----------|----------|
| rahatio-mysql | 3306 | — |
| rahatio-redis | 6379 | — |
| rahatio-core (nginx) | 80 | 3680 |
| rahatio-ai | 3000 | 3630 |
| rahatio-integration | 3001 | 3631 |
| rahatio-frontend (Next.js) | 3000 | 3690 |
| rahatio-slave | 8080 | 3681 |

### Docker Compose Volumes
- `rahatio-stack_mysql_data` → `/var/lib/mysql` (persistent)

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

### Phase 4 — Slave Yazılım ✅ **TAMAM**
- [x] Go modülü + proje yapısı (cmd/slave, internal/)
- [x] Config: YAML tabanlı yapılandırma (slave.yaml)
- [x] SQLite local cache (products, orders, sync_log tabloları)
- [x] HMAC auth: X-API-Key + X-Signature (HMAC-SHA256) ile imzalama
- [x] Client: Rahatio Core API'ye bağlantı (products sync, stocks sync, orders push)
- [x] CRON scheduler: robfig/cron ile periyodik senkronizasyon
- [x] Health endpoint: `:8080/health` (ürün sayısı + status)
- [x] install.sh: tek komut kurulum (Go kurulumu, binary build, systemd service)
- [x] Dockerfile: multi-stage Go build
- [x] docker-compose slave servisi (port 3681)
- [x] CI/CD: detect-changes + validate-slave + build-slave job'ları
- [x] Core: AuthenticateWithApiKey HMAC doğrulama desteği

### Phase 5 — Mobile App
- [ ] React Native projesi
- [ ] shared/ paketi (types, API client, hooks)
- [ ] Store owner mobil paneli
- [ ] AI görsel işleme takibi (WebSocket)

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
│   ├── ai/page.tsx        # AI Görsel (/ai)
│   └── settings/page.tsx  # Ayarlar (/settings)
├── (super)/               # Super admin (dark sidebar + auth guard)
│   ├── stores/page.tsx    # Mağazalar (/stores)
│   ├── users/page.tsx     # Kullanıcılar (/users)
│   └── plans/page.tsx     # Planlar (/plans)
└── layout.tsx             # Root layout (Geist font, globals)
```

## CI/CD

- Branch: `main`
- Workflow: `.github/workflows/deploy.yml`
- Path filter ile sadece değişen servis build edilir
- Docker Hub → Portainer webhook (`d6050fb9...`)
- **TODO:** Commit SHA tag'ı ekle, validate-core job'ı ekle

### Gerekli GitHub Secrets
- `DOCKER_HUB_USERNAME` — `asbajans`
- `DOCKER_HUB_TOKEN`
- `PORTAINER_WEBHOOK_URL` — `https://cont.asb.web.tr/api/webhooks/d6050fb9-2679-4422-902f-916da4785ca6`

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
DELETE /api/endpoints/2/docker/volumes/rahatio-stack_mysql_data
PUT /api/stacks/66/git/redeploy?endpointId=2
```

### YAML indentation hatası
GitHub Actions'ta `dorny/paths-filter` altındaki tüm filtreler aynı hizada olmalı.

### Aimeos setup — `firstOrCreate` ile site_code
Seeder `firstOrCreate` kullanır, bu yüzden aynı site_code ile tekrar çalıştırılabilir.

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
│   │   │   │   ├── OrderController.php
│   │   │   │   ├── AiGatewayController.php
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
│   │   │   └── DropshippingOrder.php
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
├── slave/                     # Go slave node
├── mobile-app/                # React Native (PLANLANAN)
│
├── docker-compose.yml
├── .github/workflows/deploy.yml
├── .env.example
└── AGENTS.md
```
