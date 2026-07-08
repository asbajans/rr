<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_payment_methods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->string('method');
            $table->boolean('is_active')->default(false);
            $table->json('config')->nullable();
            $table->timestamps();

            $table->unique(['store_id', 'method']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('store_payment_methods');
    }
};
