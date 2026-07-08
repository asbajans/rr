<?php

namespace App\Listeners;

use App\Events\ProductUpdated;
use App\Models\MarketplaceIntegration;
use App\Models\Store;
use Illuminate\Support\Facades\Http;

class SendProductWebhook
{
    public function handle(ProductUpdated $event): void
    {
        $product = $event->product;
        $storeId = $product->getPropertyValue('vendor_id', 'vendor');
        $store = Store::find($storeId);

        $marketplaces = [];
        if ($store) {
            $integrations = MarketplaceIntegration::where('store_id', $store->id)
                ->where('is_active', true)
                ->get();

            foreach ($integrations as $integration) {
                $marketplaces[] = [
                    'marketplace' => $integration->marketplace,
                    'config' => $integration->config,
                ];
            }
        }

        Http::timeout(5)
            ->retry(2, 100)
            ->post(env('INTEGRATION_SERVICE_URL', 'http://rahatio-integration:3001') . '/webhook/product', [
                'event' => 'product.updated',
                'data' => [
                    'id' => $product->getId(),
                    'sku' => $product->getCode(),
                    'name' => $product->getLabel(),
                    'status' => $product->getStatus(),
                    'stock' => $product->getPropertyValue('stock', 'stock'),
                    'price' => $product->getPropertyValue('price', 'price'),
                    'vendor_id' => $storeId,
                    'siteCode' => $store?->site_code,
                    'marketplaces' => $marketplaces,
                    'updated_at' => now()->toIso8601String(),
                ],
            ]);
    }
}
