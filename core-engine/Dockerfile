# Stage 1: Dependencies
FROM composer:2.7 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-progress \
    --optimize-autoloader \
    --ignore-platform-req=ext-*

# Stage 2: Assets
FROM node:20-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json vite.config.js ./
RUN npm ci --omit=dev
COPY resources/ resources/
RUN npm run build

# Stage 3: Production
FROM php:8.3-fpm-alpine AS rahatio-core
RUN apk add --no-cache \
    nginx \
    supervisor \
    curl \
    bash \
    icu-dev \
    libpng-dev \
    libzip-dev \
    oniguruma-dev \
    && docker-php-ext-install \
    pdo \
    pdo_mysql \
    bcmath \
    opcache \
    intl \
    gd \
    zip \
    mbstring

COPY --from=composer:2.7 /usr/bin/composer /usr/bin/composer
COPY --from=vendor /app/vendor/ /var/www/vendor/
COPY --from=assets /app/public/build/ /var/www/public/build/
COPY . /var/www/

COPY docker/php/php.ini /usr/local/etc/php/conf.d/app.ini
COPY docker/php/www.conf /usr/local/etc/php-fpm.d/www.conf
COPY docker/php/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN set -eux \
    && chown -R www-data:www-data /var/www/storage /var/www/bootstrap/cache \
    && chmod -R 775 /var/www/storage /var/www/bootstrap/cache

WORKDIR /var/www
EXPOSE 9000
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
