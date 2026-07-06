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
    'resource' => [
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
    ],
];
