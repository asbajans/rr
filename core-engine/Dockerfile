# Stage 1: Dependencies
FROM composer:2.7 AS vendor
WORKDIR /app
COPY composer.json ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-progress \
    --optimize-autoloader \
    --ignore-platform-req=ext-*

# Stage 2: Production
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
    && docker-php-ext-install -j$(nproc) \
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
COPY . /var/www/

COPY docker/php/php.ini /usr/local/etc/php/conf.d/app.ini
COPY docker/php/www.conf /usr/local/etc/php-fpm.d/www.conf
COPY docker/php/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/php/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN mkdir -p /var/www/storage/app/public \
    /var/www/storage/framework/cache \
    /var/www/storage/framework/sessions \
    /var/www/storage/framework/views \
    /var/www/storage/logs \
    /var/www/bootstrap/cache \
    && chmod +x /usr/local/bin/entrypoint.sh \
    && chown -R www-data:www-data /var/www/storage /var/www/bootstrap/cache \
    && chmod -R 775 /var/www/storage /var/www/bootstrap/cache

WORKDIR /var/www
EXPOSE 9000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
