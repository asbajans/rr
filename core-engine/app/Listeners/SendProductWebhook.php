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
        $productId = $product->getId();
        $context = app('aimeos.context')->get();

        $storeId = $event->storeId ?? $this->getVendorId($context, $productId);
        $store = $storeId ? Store::find($storeId) : null;

        $marketplaces = [];
        if ($store) {
            $integrations = MarketplaceIntegration::where('store_id', $store->id)
                ->where('is_active', true)
                ->get();

            $selected = $this->getSelectedMarketplaces($context, $productId);

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
                    'id' => $productId,
                    'sku' => $product->getCode(),
                    'name' => $product->getLabel(),
                    'description' => $this->getDescription($context, $productId),
                    'status' => $product->getStatus(),
                    'stock' => $this->getStock($context, $productId),
                    'price' => $this->getPrice($context, $productId),
                    'currency' => 'TRY',
                    'images' => $this->getImages($context, $productId),
                    'category' => $this->getProp($context, $productId, 'category'),
                    'brand' => $this->getProp($context, $productId, 'brand'),
                    'attributes' => (object) [],
                    'vendor_id' => $storeId,
                    'siteCode' => $store?->site_code,
                    'marketplaces' => $marketplaces,
                    'marketplace_data' => $this->getMarketplaceData($context, $productId),
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

    private function getStock(\Aimeos\MShop\ContextIface $context, string $productId): ?int
    {
        try {
            $propManager = MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $productId),
                $ps->compare('==', 'product.property.type', 'stock'),
            ]));
            foreach ($propManager->search($ps) as $prop) {
                return (int) $prop->getValue();
            }
        } catch (\Throwable $e) {
            // property not available
        }
        return null;
    }

    private function getPrice(\Aimeos\MShop\ContextIface $context, string $productId): ?float
    {
        try {
            $priceManager = MShop::create($context, 'price');
            $listManager = MShop::create($context, 'product/lists');
            $ls = $listManager->filter();
            $ls->setConditions($ls->and([
                $ls->compare('==', 'product.lists.parentid', $productId),
                $ls->compare('==', 'product.lists.domain', 'price'),
            ]));
            foreach ($listManager->search($ls) as $li) {
                $price = $priceManager->get($li->getRefId());
                return (float) $price->getValue();
            }
        } catch (\Throwable $e) {
            // price not available
        }
        return null;
    }

    private function getVendorId(\Aimeos\MShop\ContextIface $context, string $productId): ?int
    {
        $val = $this->getProp($context, $productId, 'vendor');
        return $val !== null ? (int) $val : null;
    }

    private function getProp(\Aimeos\MShop\ContextIface $context, string $productId, string $type): ?string
    {
        try {
            $propManager = MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $productId),
                $ps->compare('==', 'product.property.type', $type),
            ]));
            foreach ($propManager->search($ps) as $prop) {
                return $prop->getValue();
            }
        } catch (\Throwable $e) {
            // property not available
        }
        return null;
    }

    private function getMarketplaceData(\Aimeos\MShop\ContextIface $context, string $productId): array
    {
        try {
            $propManager = MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $productId),
                $ps->compare('==', 'product.property.type', 'marketplace_data'),
            ]));
            foreach ($propManager->search($ps) as $prop) {
                $val = $prop->getValue();
                if (empty($val)) {
                    return [];
                }
                $dec = json_decode($val, true);
                return is_array($dec) ? $dec : [];
            }
        } catch (\Throwable $e) {
            // property not available
        }
        return [];
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
