<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dropshipping_order_id')->constrained()->cascadeOnDelete();
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->string('note')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('dropshipping_orders', function (Blueprint $table) {
            $table->string('tracking_number')->nullable()->after('ordered_at');
            $table->string('tracking_company')->nullable()->after('tracking_number');
            $table->text('note')->nullable()->after('tracking_company');
        });
    }

    public function down(): void
    {
        Schema::table('dropshipping_orders', function (Blueprint $table) {
            $table->dropColumn(['tracking_number', 'tracking_company', 'note']);
        });
        Schema::dropIfExists('order_status_histories');
    }
};
