# Rahatio Monorepo - AGENTS.md

## Genel Bilgi

Monorepo: `rr` (Rahatio)
GitHub: `https://github.com/asbajans/rr`
Portainer Stack: `rahatio-stack` (ID: 64)
Portainer API: `https://cont.asb.web.tr` (Endpoint 2, X-API-Key auth)
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

| Dizin | Teknoloji | Görev |
|-------|-----------|-------|
| `core-engine/` | Laravel 10 + Aimeos 2023.10 | Backend API, multi-tenant, auth, AI gateway |
| `ai-service/` | Node.js + Express + Socket.io | AI görsel işleme, ComfyUI, LLM pipeline |
| `integration-service/` | Node.js + BullMQ + Redis | Trendyol/HB entegrasyonu, FCM push |
| `frontend/` | Next.js (React) | Landing page + Admin panel (store owner + super admin) |
| `slave/` | Go (planlanan) | Self-hosted store daemon |
| `mobile-app/` | React Native (planlanan) | Mobil store management |

## Veritabanı

### Mevcut Tablolar (Laravel)
- `stores` — id, name, site_code, domain, email, is_active
- `api_keys` — store_id, key (sha256), allowed_ips, expires_at, last_used_at
- `users` — store_id, name, email, password, ai_credits, fcm_token
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
| rahatio-mysql | 3306 | 3606 |
| rahatio-redis | 6379 | 3679 |
| rahatio-core | 80 | 3680 |
| rahatio-ai | 3000 | 3630 |
| rahatio-integration | 3001 | 3631 |
| rahatio-frontend (plan) | 3000 | 3690 |

## Geliştirme Fazları

### Phase 0 — Acil Düzeltmeler
- [x] docker-compose.yml hostname/port fix (`rahat-integration` → `rahatio-integration`)
- [x] Integration service PORT env
- [ ] config/mail.php + config/queue.php oluştur
- [ ] display_errors Off (php.ini + www.conf)
- [ ] stores seed: `rahatio.com.tr` domain'li platform kaydı
- [ ] entrypoint'e `db:seed` ekle
- [ ] CORS whitelist (config/cors.php)

### Phase 1 — SaaS Frontend (Next.js)
- [ ] frontend/ projesi oluştur (Next.js + TypeScript + Tailwind)
- [ ] Landing page: `/`, `/pricing`, `/features`, `/blog`
- [ ] Auth flow: `/login`, `/register` (Sanctum API ile)
- [ ] Store owner admin paneli:
  - Dashboard (sipariş istatistikleri, AI kredisi)
  - Ürün yönetimi (Aimeos JSON API ile)
  - Sipariş yönetimi
  - AI görsel işleme paneli
  - Mağaza ayarları
- [ ] Super admin paneli:
  - Store listesi + detay
  - Plan atama
  - Kullanıcı yönetimi
  - Abonelik/faturalandırma
- [ ] Cloudflare + SSL yapılandırması

### Phase 2 — Store Frontend + CDN
- [ ] Store tema sistemi (Next.js SSG)
- [ ] Multi-tenant domain routing
- [ ] MinIO / Cloudflare R2 CDN
- [ ] Cloudflare cache stratejisi

### Phase 3 — Billing + Subscription
- [ ] plans + subscriptions tabloları
- [ ] Stripe/Iyzico entegrasyonu
- [ ] Plan limit kontrolleri (AI kredisi, ürün sayısı, vs.)

### Phase 4 — Slave Yazılım
- [ ] Go ile slave servis
- [ ] HMAC auth + API senkronizasyonu
- [ ] CRON + local cache (SQLite)
- [ ] Tek komut kurulum script'i

### Phase 5 — Mobile App
- [ ] React Native projesi
- [ ] shared/ paketi (types, API client, hooks)
- [ ] Store owner mobil paneli
- [ ] AI görsel işleme takibi (WebSocket)

## CI/CD

- Branch: `main`
- Workflow: `.github/workflows/deploy.yml`
- Path filter ile sadece değişen servis build edilir
- Docker Hub → Portainer webhook
- **TODO:** Commit SHA tag'ı ekle, `ForcePullImage: true` yap, validate-core job'ı ekle

### Gerekli GitHub Secrets
- `DOCKER_HUB_USERNAME`
- `DOCKER_HUB_TOKEN`  
- `PORTAINER_WEBHOOK_URL`

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

## Önemli Portainer Env Sorunları

- `INTEGRATION_SERVICE_URL=http://rahat-integration:3000` → `http://rahatio-integration:3001`
- `AI_SERVICE_URL=http://rahat-ai:3000` → `http://rahatio-ai:3000`
- `APP_KEY` boş → doldurulmalı
- `REDIS_PASSWORD=null` → boşalt
- `ForcePullImage: false` → `true` yap
- Git `ReferenceName` = `main` ayarlanmalı

## Proje Yapısı (Full)

```
rr/
├── core-engine/               # Laravel 10 + Aimeos
│   ├── Dockerfile
│   ├── app/
│   │   ├── Console/Kernel.php
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
│   │   │       └── ...
│   │   ├── Models/
│   │   │   ├── User.php
│   │   │   ├── Store.php
│   │   │   ├── ApiKey.php
│   │   │   └── DropshippingOrder.php
│   │   ├── Services/InternalKeyService.php
│   │   ├── Events/ (OrderReceived, ProductUpdated)
│   │   └── Listeners/ (SendProductWebhook, SplitOrderByVendor)
│   ├── config/
│   │   ├── aimeos.php
│   │   ├── shop.php
│   │   ├── app.php, auth.php, cache.php, cors.php
│   │   ├── database.php, filesystems.php, logging.php
│   │   ├── sanctum.php, session.php, view.php
│   │   └── mail.php [EKSIK], queue.php [EKSIK]
│   ├── database/migrations/ (6 adet)
│   ├── routes/api.php, web.php, console.php
│   └── docker/nginx/ (default.conf, nginx.conf)
│       docker/php/ (entrypoint.sh, php.ini, www.conf, supervisord.conf)
│
├── frontend/                  # Next.js (PLANLANAN)
│   ├── package.json
│   ├── next.config.js
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   ├── pricing/page.tsx
│   │   ├── features/page.tsx
│   │   ├── blog/page.tsx
│   │   ├── login/page.tsx
│   │   └── (admin)/          # Admin panel (store + super)
│   ├── components/
│   ├── lib/ (api client, types)
│   └── Dockerfile
│
├── ai-service/                # Node.js + TypeScript
├── integration-service/       # Node.js + TypeScript
├── slave/                     # Go (PLANLANAN)
├── mobile-app/                # React Native (PLANLANAN)
│
├── docker-compose.yml
├── .github/workflows/deploy.yml
├── .env.example
└── AGENTS.md
```
