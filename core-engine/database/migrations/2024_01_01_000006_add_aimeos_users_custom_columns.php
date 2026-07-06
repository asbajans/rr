<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'store_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->foreignId('store_id')->nullable()->constrained()->nullOnDelete();
            });
        }

        if (!Schema::hasColumn('users', 'ai_credits')) {
            Schema::table('users', function (Blueprint $table) {
                $table->bigInteger('ai_credits')->default(0);
            });
        }

        if (!Schema::hasColumn('users', 'fcm_token')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('fcm_token')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['store_id', 'ai_credits', 'fcm_token']);
        });
    }
};
