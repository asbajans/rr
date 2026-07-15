<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_marketplace_sync', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('product_id'); // Aimeos product id (string)
            $table->string('marketplace'); // trendyol, n11, ...
            $table->string('status')->default('none'); // none|pending|synced|error
            $table->string('marketplace_product_id')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('checked_at')->nullable();
            $table->timestamps();

            $table->unique(['store_id', 'product_id', 'marketplace']);
            $table->index(['product_id', 'marketplace']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_marketplace_sync');
    }
};
