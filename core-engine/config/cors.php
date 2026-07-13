<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [
        env('APP_URL', 'http://localhost'),
        'https://rahatio.com.tr',
        'https://*.rahatio.com.tr',
        'https://api.rahatio.com.tr',
    ],
    'allowed_origins_patterns' => ['#^https://([a-z0-9-]+\.)*rahatio\.com\.tr$#'],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
