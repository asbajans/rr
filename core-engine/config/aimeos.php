<?php

return [
    'headless' => true,
    'api' => [
        'jsonapi' => [
            'enabled' => true,
            'prefix' => 'api',
        ],
    ],
    'shop' => [
        'disableSites' => false,
    ],
    'db' => [
        'host' => env('DB_HOST', 'mysql'),
        'port' => env('DB_PORT', '3306'),
        'database' => env('DB_DATABASE', 'rahatio'),
        'username' => env('DB_USERNAME', 'rahatio'),
        'password' => env('DB_PASSWORD', 'rahatio'),
    ],
    'fs' => [
        'adapter' => 'standard',
        'basedir' => 'uploads',
        'baseurl' => '/file',
    ],
    'fs-admin' => [
        'adapter' => 'standard',
        'basedir' => 'uploads/admin',
        'baseurl' => '/file',
    ],
    'fs-export' => [
        'adapter' => 'standard',
        'basedir' => 'tmp/export',
        'baseurl' => '/file',
    ],
    'fs-import' => [
        'adapter' => 'standard',
        'basedir' => 'tmp/import',
        'baseurl' => '/file',
    ],
    'fs-secure' => [
        'adapter' => 'standard',
        'basedir' => 'uploads/secure',
        'baseurl' => '/file',
    ],
    'fs-media' => [
        'adapter' => 'standard',
        'basedir' => 'uploads/media',
        'baseurl' => '/file',
    ],
    'mq' => [
        'adapter' => 'Standard',
        'basedir' => 'tmp/mq',
    ],
];
