<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('external_feeds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('feed_url');
            $table->string('file_format');
            $table->string('auth_type')->default('none');
            $table->json('auth_credentials')->nullable();
            $table->string('pricing_mode')->default('fixed');
            $table->string('currency')->default('TRY');
            $table->decimal('default_gram_weight', 10, 4)->nullable();
            $table->integer('default_milyem')->nullable();
            $table->decimal('default_profit_margin', 5, 2)->nullable();
            $table->decimal('price_multiplier', 5, 2)->default(1.00);
            $table->string('default_category')->nullable();
            $table->foreignId('default_category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->boolean('default_is_b2b_enabled')->default(false);
            $table->integer('default_quantity')->default(1);
            $table->json('default_marketplaces')->nullable();
            $table->json('field_mapping')->nullable();
            $table->boolean('auto_sync')->default(false);
            $table->string('update_interval')->default('manual');
            $table->timestamp('last_sync_at')->nullable();
            $table->json('last_sync_result')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('feed_sync_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('feed_id')->constrained('external_feeds')->cascadeOnDelete();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->string('status');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->json('summary')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feed_sync_logs');
        Schema::dropIfExists('external_feeds');
    }
};
