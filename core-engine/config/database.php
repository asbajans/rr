<?php

return [
    'default' => env('DB_CONNECTION', 'mysql'),
    'migrations' => 'migrations',
    'connections' => [
        'mysql' => [
            'driver' => 'mysql',
            'host' => env('DB_HOST', 'mysql'),
            'port' => env('DB_PORT', '3306'),
            'database' => env('DB_DATABASE', 'rahatio'),
            'username' => env('DB_USERNAME', 'rahatio'),
            'password' => env('DB_PASSWORD', 'rahatio'),
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'prefix' => '',
            'strict' => true,
        ],
    ],
];
