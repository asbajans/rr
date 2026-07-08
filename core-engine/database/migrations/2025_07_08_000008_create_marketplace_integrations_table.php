<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('marketplace_integrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->string('marketplace');
            $table->boolean('is_active')->default(false);
            $table->json('config')->nullable();
            $table->timestamps();

            $table->unique(['store_id', 'marketplace']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketplace_integrations');
    }
};
