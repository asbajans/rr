<?php

namespace App\Listeners;

use App\Events\ProductUpdated;
use Illuminate\Support\Facades\Http;

class SendProductWebhook
{
    public function handle(ProductUpdated $event): void
    {
        $product = $event->product;

        Http::timeout(5)
            ->retry(2, 100)
            ->post(env('INTEGRATION_SERVICE_URL', 'http://rahat-integration:3000') . '/webhook/product', [
                'event' => 'product.updated',
                'data' => [
                    'id' => $product->getId(),
                    'sku' => $product->getCode(),
                    'label' => $product->getLabel(),
                    'status' => $product->getStatus(),
                    'stock' => $product->getPropertyValue('stock', 'stock'),
                    'vendor_id' => $product->getPropertyValue('vendor_id', 'vendor'),
                    'updated_at' => now()->toIso8601String(),
                ],
            ]);
    }
}
