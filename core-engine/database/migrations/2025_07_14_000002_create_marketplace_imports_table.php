<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('marketplace_imports', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('store_id');
            $table->string('marketplace');
            $table->json('config')->nullable();
            $table->integer('max_pages')->default(5);
            $table->string('status')->default('pending');
            $table->json('summary')->nullable();
            $table->text('error')->nullable();
            $table->timestamps();

            $table->index(['store_id', 'marketplace']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketplace_imports');
    }
};
