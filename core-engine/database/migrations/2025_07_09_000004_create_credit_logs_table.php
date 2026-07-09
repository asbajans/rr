<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('credit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('action'); // consume | grant | purchase
            $table->string('module')->nullable(); // ai_product_create | ai_image_generate | etc
            $table->integer('amount');
            $table->integer('balance_before');
            $table->integer('balance_after');
            $table->text('note')->nullable();
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->integer('total_credits_consumed')->default(0)->after('ai_credits');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('credit_logs');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('total_credits_consumed');
        });
    }
};