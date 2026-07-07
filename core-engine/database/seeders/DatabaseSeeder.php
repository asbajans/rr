<?php

namespace Database\Seeders;

use App\Models\ApiKey;
use App\Models\Plan;
use App\Models\Store;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            ['name' => 'Ücretsiz', 'slug' => 'free', 'price' => 0, 'ai_credits' => 10, 'product_limit' => 50, 'store_limit' => 1, 'description' => 'Yeni başlayanlar için temel paket'],
            ['name' => 'Başlangıç', 'slug' => 'starter', 'price' => 299, 'ai_credits' => 100, 'product_limit' => 500, 'store_limit' => 1, 'description' => 'Küçük işletmeler için ideal'],
            ['name' => 'Profesyonel', 'slug' => 'pro', 'price' => 799, 'ai_credits' => 500, 'product_limit' => 5000, 'store_limit' => 3, 'description' => 'Büyüyen mağazalar için profesyonel paket'],
            ['name' => 'Kurumsal', 'slug' => 'enterprise', 'price' => 2499, 'ai_credits' => 2000, 'product_limit' => -1, 'store_limit' => 10, 'description' => 'Sınırsız ürün ve öncelikli destek'],
        ];

        foreach ($plans as $plan) {
            Plan::firstOrCreate(['slug' => $plan['slug']], $plan);
        }

        $enterprise = Plan::where('slug', 'enterprise')->first();
        $free = Plan::where('slug', 'free')->first();

        $platform = Store::firstOrCreate(
            ['site_code' => 'platform'],
            [
                'name' => 'Rahatio Platform',
                'domain' => 'rahatio.com.tr',
                'email' => 'hello@rahatio.com.tr',
                'is_active' => true,
                'plan_id' => $enterprise?->id,
            ]
        );

        $default = Store::firstOrCreate(
            ['site_code' => 'default'],
            [
                'name' => 'Default Store',
                'domain' => null,
                'email' => null,
                'is_active' => true,
                'plan_id' => $free?->id,
            ]
        );

        Subscription::firstOrCreate(
            ['store_id' => $default->id],
            [
                'plan_id' => $free?->id,
                'status' => 'active',
                'payment_method' => 'free',
            ]
        );

        ApiKey::firstOrCreate(
            ['key' => hash('sha256', 'rahatio-api-key')],
            [
                'store_id' => $default->id,
                'name' => 'Default API Key',
            ]
        );

        User::firstOrCreate(
            ['email' => 'admin@rahatio.com.tr'],
            [
                'name' => 'Super Admin',
                'password' => Hash::make('change-me-password'),
                'is_admin' => true,
                'ai_credits' => 999999,
            ]
        );

        User::firstOrCreate(
            ['email' => 'owner@test.com'],
            [
                'store_id' => $default->id,
                'name' => 'Test Owner',
                'password' => Hash::make('test1234'),
                'ai_credits' => 100,
            ]
        );
    }
}
