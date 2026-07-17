#!/bin/sh
set -e

if [ ! -f .env ]; then
    cp .env.example .env
fi

# Yeni eklenen Command class'ları için autoloader'ı tazele
composer dump-autoload -q 2>/dev/null || true

if [ -z "$APP_KEY" ] || [ "$APP_KEY" = " " ]; then
    echo "Generating APP_KEY..."
    php artisan key:generate --force
fi

php artisan aimeos:setup --ansi 2>&1 || echo "Aimeos setup skipped"

# MinIO bucket auto-create (retry up to 30s if MinIO not ready)
for i in 1 2 3 4 5 6; do
    php artisan rahatio:init-minio 2>&1 && break
    echo "MinIO not ready, retrying in 5s... ($i/6)"
    sleep 5
done

# Aimeos OrderUpdateInvoiceNo fix: null invoiceno -> varsayılan değer + kolon fix
php artisan rahatio:fix-orders 2>&1 || true
php artisan migrate --force --ansi 2>&1 || echo "Migration skipped"
php artisan db:seed --force --ansi 2>&1 || echo "Seed skipped"
php artisan rahatio:fix-b2b-data --restore-owner=120 2>&1 || echo "B2B data fix skipped"
php artisan config:cache 2>&1 || true

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
