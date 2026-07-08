<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('b2b_listed_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->foreignId('original_store_id')->constrained('stores')->cascadeOnDelete();
            $table->string('product_id', 36);
            $table->string('original_product_id', 36);
            $table->foreignId('b2b_request_id')->nullable()->constrained('b2b_requests')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('b2b_listed_products');
    }
};
