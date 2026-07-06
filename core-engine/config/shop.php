<?php

return [
    'resource' => [
        'db' => [
            'adapter' => env('DB_CONNECTION', 'mysql'),
            'host' => env('DB_HOST', 'mysql'),
            'port' => env('DB_PORT', '3306'),
            'database' => env('DB_DATABASE', 'rahatio'),
            'username' => env('DB_USERNAME', 'rahatio'),
            'password' => env('DB_PASSWORD', 'rahatio'),
            'stmt' => ["SET SESSION sort_buffer_size=2097144; SET NAMES 'utf8'; SET SESSION sql_mode='ANSI'"],
            'opt-persistent' => false,
        ],
    ],
];
