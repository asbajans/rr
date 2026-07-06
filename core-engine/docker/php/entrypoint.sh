#!/bin/sh
set -e

if [ ! -f .env ]; then
    cp .env.example .env
fi

if [ -z "$APP_KEY" ] || [ "$APP_KEY" = " " ]; then
    echo "Generating APP_KEY..."
    php artisan key:generate --force
fi

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
