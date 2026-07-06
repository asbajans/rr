<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dropshipping_orders', function (Blueprint $table) {
            $table->id();
            $table->string('external_id');
            $table->string('marketplace');
            $table->string('status')->default('pending');
            $table->foreignId('vendor_id')->constrained('stores')->cascadeOnDelete();
            $table->string('customer_name');
            $table->string('customer_email');
            $table->string('customer_phone')->nullable();
            $table->string('shipping_address')->nullable();
            $table->json('items');
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('shipping', 12, 2)->default(0);
            $table->decimal('tax', 12, 2)->default(0);
            $table->decimal('grand_total', 12, 2)->default(0);
            $table->string('currency', 3)->default('TRY');
            $table->timestamp('ordered_at');
            $table->timestamps();

            $table->index('vendor_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dropshipping_orders');
    }
};
