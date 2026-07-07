#!/bin/sh
set -e

if [ ! -f .env ]; then
    cp .env.example .env
fi

if [ -z "$APP_KEY" ] || [ "$APP_KEY" = " " ]; then
    echo "Generating APP_KEY..."
    php artisan key:generate --force
fi

# Aimeos OrderUpdateInvoiceNo fix: null invoiceno -> varsayılan değer
php artisan rahatio:fix-orders 2>&1 || true

php artisan aimeos:setup --ansi 2>&1 || echo "Aimeos setup skipped"
php artisan migrate --force --ansi 2>&1 || echo "Migration skipped"
php artisan db:seed --force --ansi 2>&1 || echo "Seed skipped"
php artisan config:cache 2>&1 || true

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
