<?php

namespace App\Listeners;

use App\Events\ProductUpdated;
use App\Models\MarketplaceIntegration;
use App\Models\Store;
use Aimeos\MShop;
use Illuminate\Support\Facades\Http;

class SendProductWebhook
{
    public function handle(ProductUpdated $event): void
    {
        $product = $event->product;
        $storeId = $event->storeId ?? $product->getPropertyValue('vendor_id', 'vendor');
        $store = $storeId ? Store::find($storeId) : null;

        $marketplaces = [];
        if ($store) {
            $integrations = MarketplaceIntegration::where('store_id', $store->id)
                ->where('is_active', true)
                ->get();

            $context = app('aimeos.context')->get();
            $selected = $this->getSelectedMarketplaces($context, $product->getId());

            foreach ($integrations as $integration) {
                if (!empty($selected) && !in_array($integration->marketplace, $selected)) {
                    continue;
                }
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
                    'description' => $this->getDescription($context, $product->getId()),
                    'status' => $product->getStatus(),
                    'stock' => $product->getPropertyValue('stock', 'stock'),
                    'price' => $product->getPropertyValue('price', 'price'),
                    'currency' => 'TRY',
                    'images' => $this->getImages($context, $product->getId()),
                    'category' => $product->getPropertyValue('category', 'category'),
                    'brand' => $product->getPropertyValue('brand', 'brand'),
                    'attributes' => (object) [],
                    'vendor_id' => $storeId,
                    'siteCode' => $store?->site_code,
                    'marketplaces' => $marketplaces,
                    'updated_at' => now()->toIso8601String(),
                ],
            ]);
    }

    private function getDescription(\Aimeos\MShop\ContextIface $context, string $productId): ?string
    {
        try {
            $textManager = MShop::create($context, 'text');
            $listManager = MShop::create($context, 'product/lists');
            $ls = $listManager->filter();
            $ls->setConditions($ls->and([
                $ls->compare('==', 'product.lists.parentid', $productId),
                $ls->compare('==', 'product.lists.domain', 'text'),
                $ls->or([
                    $ls->compare('==', 'product.lists.type', 'long'),
                    $ls->compare('==', 'product.lists.type', 'default'),
                ]),
            ]));
            foreach ($listManager->search($ls) as $li) {
                $text = $textManager->get($li->getRefId());
                if (($text->getContent() ?? '') !== '') {
                    return $text->getContent();
                }
            }
        } catch (\Throwable $e) {
            // text not available
        }
        return null;
    }

    private function getImages(\Aimeos\MShop\ContextIface $context, string $productId): array
    {
        $images = [];
        try {
            $mediaManager = MShop::create($context, 'media');
            $listManager = MShop::create($context, 'product/lists');
            $ls = $listManager->filter();
            $ls->setConditions($ls->and([
                $ls->compare('==', 'product.lists.parentid', $productId),
                $ls->compare('==', 'product.lists.domain', 'media'),
            ]));
            $ls->setSortations([$ls->sort('+', 'product.lists.position')]);
            foreach ($listManager->search($ls) as $li) {
                $media = $mediaManager->get($li->getRefId());
                $url = $media->getUrl();
                if ($url !== '') {
                    $images[] = $url;
                }
            }
        } catch (\Throwable $e) {
            // media not available
        }
        return $images;
    }

    private function getSelectedMarketplaces(\Aimeos\MShop\ContextIface $context, string $productId): array
    {
        try {
            $propManager = MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $productId),
                $ps->compare('==', 'product.property.type', 'marketplaces'),
            ]));
            foreach ($propManager->search($ps) as $prop) {
                $val = $prop->getValue();
                if (empty($val)) {
                    return [];
                }
                return array_filter(array_map('trim', explode(',', $val)));
            }
        } catch (\Throwable $e) {
            // property not available
        }
        return [];
    }
}
