<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('marketplace_categories', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('store_id');
            $table->string('marketplace', 32);
            $table->string('marketplace_category_id', 64);
            $table->string('name');
            $table->string('parent_id', 64)->nullable();
            $table->unsignedInteger('level')->default(0);
            $table->string('path')->nullable();
            $table->timestamps();

            $table->unique(['store_id', 'marketplace', 'marketplace_category_id'], 'mpcat_store_mp_cat_unique');
            $table->index(['store_id', 'marketplace']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketplace_categories');
    }
};
