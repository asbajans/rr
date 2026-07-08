<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_b2b_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->string('product_id', 36);
            $table->boolean('is_b2b_enabled')->default(false);
            $table->decimal('b2b_discount', 5, 2)->nullable();
            $table->decimal('b2b_price', 15, 2)->nullable();
            $table->timestamps();

            $table->unique(['store_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_b2b_settings');
    }
};
