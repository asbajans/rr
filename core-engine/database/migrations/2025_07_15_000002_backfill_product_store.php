<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Artisan;

return new class extends Migration
{
    public function up(): void
    {
        try {
            Artisan::call('rahatio:backfill-product-store', ['--attach-users' => true]);
        } catch (\Throwable $e) {
            // best-effort; ignore failures during deploy
        }
    }

    public function down(): void
    {
        //
    }
};
