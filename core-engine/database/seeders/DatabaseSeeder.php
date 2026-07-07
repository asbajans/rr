<?php

namespace Database\Seeders;

use App\Models\ApiKey;
use App\Models\Store;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $platform = Store::firstOrCreate(
            ['site_code' => 'platform'],
            [
                'name' => 'Rahatio Platform',
                'domain' => 'rahatio.com.tr',
                'email' => 'hello@rahatio.com.tr',
                'is_active' => true,
            ]
        );

        $default = Store::firstOrCreate(
            ['site_code' => 'default'],
            [
                'name' => 'Default Store',
                'domain' => null,
                'email' => null,
                'is_active' => true,
            ]
        );

        ApiKey::firstOrCreate(
            ['key' => hash('sha256', 'rahatio-api-key')],
            [
                'store_id' => $default->id,
                'name' => 'Default API Key',
            ]
        );
    }
}
