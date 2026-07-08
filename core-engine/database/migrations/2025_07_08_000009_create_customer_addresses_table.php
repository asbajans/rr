<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->string('user_id')->nullable();
            $table->string('full_name');
            $table->string('phone', 20);
            $table->string('country', 100)->default('Türkiye');
            $table->string('city', 100);
            $table->string('district', 100)->nullable();
            $table->string('zip', 20)->nullable();
            $table->text('address_line');
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_addresses');
    }
};
