<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->string('slug')->unique();
            $table->string('name');
            $table->json('translations')->nullable();
            $table->string('icon')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('marketplace_category_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->string('marketplace');
            $table->string('marketplace_category_id');
            $table->string('marketplace_category_name');
            $table->string('marketplace_parent_id')->nullable();
            $table->timestamps();

            $table->unique(['category_id', 'marketplace', 'marketplace_category_id'], 'mktpl_cat_map_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketplace_category_mappings');
        Schema::dropIfExists('categories');
    }
};
