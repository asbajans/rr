# Rahatio Monorepo - AGENTS.md

## Genel Bilgi

Monorepo: `rr` (Rahatio)
GitHub: `https://github.com/asbajans/rr`
Stack Adı (Portainer): `rahatio-stack`

## Proje Yapısı

```
rr/
├── core-engine/          # Laravel 10 + Aimeos (Headless E-commerce)
│   ├── Dockerfile        # PHP 8.3-fpm-alpine, multi-stage
│   ├── app/
│   │   ├── Events/ProductUpdated.php
│   │   ├── Listeners/SendProductWebhook.php
│   │   ├── Models/{Store,ApiKey}.php
│   │   ├── Http/Middleware/{ResolveStoreFromDomain,AuthenticateWithApiKey}.php
│   │   ├── Http/Controllers/Api/WooCommerce/{Product,Stock}Controller.php
│   │   └── Providers/{Event,Route}ServiceProvider.php
│   ├── bootstrap/app.php
│   ├── config/{app,database,aimeos,sanctum}.php
│   ├── database/migrations/ (stores, api_keys, vendor_id)
│   ├── routes/{api,web}.php
│   └── docker/{nginx,php}/
├── ai-service/           # Node.js (AI mikroservisi)
│   ├── Dockerfile        # Node 20-alpine, multi-stage
│   └── src/main.js
├── integration-service/  # Node.js (Entegrasyon/WooCommerce)
│   ├── Dockerfile        # Node 20-alpine, multi-stage
│   └── src/main.js
├── mobile-app/           # (boş, mobil uygulama için ayrılmış)
├── docker-compose.yml    # Portainer uyumlu, tüm servisler
├── .github/workflows/deploy.yml  # CI/CD
├── AGENTS.md             # Bu dosya
└── .env.example
```

## Docker Port Haritası

| Container          | Internal | External |
|--------------------|----------|----------|
| rahatio-mysql      | 3306     | 3606     |
| rahatio-redis      | 6379     | 3679     |
| rahatio-nginx      | 80       | 3680     |
| rahatio-ai         | 3000     | 3630     |
| rahatio-integration| 3001     | 3631     |

## CI/CD

- Branch: `main`
- `paths-filter` ile değişen servis algılanır
- Sadece değişen servisin imajı build edilir -> Docker Hub -> Portainer webhook

### Gerekli GitHub Secrets
- `DOCKER_HUB_USERNAME`
- `DOCKER_HUB_TOKEN`
- `PORTAINER_WEBHOOK_URL`

## Yapılanlar

- [x] Monorepo kurulumu (core-engine, ai-service, integration-service, mobile-app)
- [x] docker-compose.yml (MySQL, Redis, Laravel PHP-FPM+Nginx, 2x Node.js)
- [x] core-engine/Dockerfile (Laravel multi-stage, Aimeos, intl/gd/zip/mbstring)
- [x] ai-service/Dockerfile (Node.js 20 multi-stage alpine)
- [x] integration-service/Dockerfile (Node.js 20 multi-stage alpine)
- [x] Nginx config (Laravel için)
- [x] deploy.yml CI/CD (path detection + Portainer webhook)
- [x] Multi-tenancy: stores tablosu + Store model
- [x] Domain -> site_code middleware (ResolveStoreFromDomain)
- [x] API Key auth middleware (AuthenticateWithApiKey)
- [x] JSON:API endpoints (products + stocks)
- [x] vendor_id alanı (dropshipping bayilik havuzu)
- [x] Product webhook -> integration servisi (Event/Listener)
- [x] Tüm container portları 3500-3600 aralığına alındı

## Yapılacaklar

- [ ] Laravel artisan key:generate (ilk deployda)
- [ ] Aimeos setup (aimeos:setup, aimeos:cache)
- [ ] Migrations çalıştırma (php artisan migrate)
- [ ] api_keys tablosuna seed data (admin API key)
- [ ] stores tablosuna seed data (default store)
- [ ] Integration service'te /webhook/product endpoint'i
- [x] AI service: TypeScript + Express + Socket.io altyapısı
- [x] AI service: /ai/process-image upload endpoint (multi-file + category)
- [x] AI service: Arka plan silme (rembg/BiRefNet)
- [x] AI service: ComfyUI entegrasyonu (workflow + API)
- [x] AI service: Kategori bazlı workflow JSON'ları (giyim, taki, kozmetik, ayakkabi, canta, elektronik + generic)
- [x] AI service: WebSocket anlık durum bildirimi
- [x] AI service: Vision Analyzer (Ollama llama3.2-vision ile teknik özellik çıkarma)
- [x] AI service: LLM Prompt Chain (SEO, Trendyol, Amazon metinleri)
- [x] AI service: Full pipeline (bg -> comfyui -> vision -> llm -> final JSON)
- [x] AI service: Final result WebSocket ile mobil uygulamaya iletilir
- [x] Integration service: TypeScript + Express + BullMQ + Redis
- [x] Integration service: product-push-queue + stock-sync-queue (BullMQ)
- [x] Integration service: IntegrationInterface (Strategy Pattern)
- [x] Integration service: TrendyolIntegrationService (rate-limited API client)
- [x] Integration service: Trendyol product mapper (kategori eşleme)
- [x] Integration service: /webhook/product endpoint (core-engine'den çağrılır)
- [x] Integration service: Cron job (5dk) ile pazar yeri sipariş polling
- [x] Integration service: OrderDTO mapper (ortak şema)
- [x] Integration service: Core-engine order API'sine POST
- [x] Integration service: Hepsiburada IntegrationService (Strategy Pattern)
- [x] Core-engine: POST /api/orders endpoint (OrderController)
- [x] Core-engine: OrderReceived Event + SplitOrderByVendor Listener
- [x] Core-engine: dropshipping_orders tablosu + DropshippingOrder model
- [ ] AI service: Test ve model indirme script'leri
- [ ] mobile-app içeriği (React Native / Flutter?)
- [ ] Domain bazlı SSL (Traefik / Let's Encrypt)
- [ ] Rate limiting ve güvenlik katmanı
- [ ] Logging (ELK / Laravel Telescope?)
- [ ] Test facade'leri (PEST / PHPUnit)
