<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // TEST ONLY: move owner@test.com to platform store to verify tenant isolation.
        // After verifying, run the down() migration.
        $platformId = DB::table('stores')->where('site_code', 'platform')->value('id');
        if ($platformId) {
            DB::table('users')->where('email', 'owner@test.com')->update(['store_id' => $platformId]);
        }
    }

    public function down(): void
    {
        $defaultId = DB::table('stores')->where('site_code', 'default')->value('id');
        if ($defaultId) {
            DB::table('users')->where('email', 'owner@test.com')->update(['store_id' => $defaultId]);
        }
    }
};
