<?php

namespace App\Http\Controllers\Api;

use Aimeos\MShop;
use App\Models\Store;
use App\Traits\StoreProductFilter;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class StoreFrontController extends Controller
{
    use StoreProductFilter;

    public function show(string $siteCode)
    {
        $store = Store::where('site_code', $siteCode)->where('is_active', true)->first();
        if (!$store) {
            return response()->json(['error' => 'Store not found'], 404);
        }

        putenv('AIMEOS_SITE_CODE=' . $store->site_code);
        $context = app('aimeos.context')->get();
        $manager = MShop::create($context, 'product');

        $search = $manager->filter();
        $search->setConditions($search->compare('==', 'product.status', 1));
        $search->setSortations([$search->sort('-', 'product.id')]);

        // Filter products by store_id to ensure multi-tenant isolation
        $allowedIds = $this->getProductIdsByStore($context, (string) $store->id);
        if (empty($allowedIds)) {
            return response()->json([
                'store' => [
                    'id' => $store->id,
                    'name' => $store->name,
                    'site_code' => $store->site_code,
                    'domain' => $store->domain,
                    'email' => $store->email,
                ],
                'products' => [],
                'total' => 0,
            ]);
        }
        $search->add($search->compare('==', 'product.id', $allowedIds));

        $total = 0;
        $items = $manager->search($search, ['price', 'media', 'text'], $total);

        $products = [];
        foreach ($items as $item) {
            $data = $item->toArray();

            $prices = $item->getRefItems('price');
            $data['price'] = null;
            $data['currency'] = null;
            foreach ($prices as $price) {
                if (!is_object($price)) {
                    continue;
                }
                $data['price'] = $price->getValue();
                $data['currency'] = $price->getCurrencyId();
                break;
            }

            $medias = $item->getRefItems('media');
            $data['image'] = null;
            foreach ($medias as $media) {
                if (!is_object($media)) {
                    continue;
                }
                $data['image'] = $media->getUrl();
                break;
            }

            $texts = $item->getRefItems('text');
            $data['description'] = null;
            foreach ($texts as $text) {
                if (!is_object($text)) {
                    continue;
                }
                if ($text->getType() === 'default' || $text->getType() === 'long') {
                    $data['description'] = $text->getContent();
                    break;
                }
            }

            $products[] = $data;
        }

        return response()->json([
            'store' => [
                'id' => $store->id,
                'name' => $store->name,
                'site_code' => $store->site_code,
                'domain' => $store->domain,
                'email' => $store->email,
            ],
            'products' => $products,
            'total' => $total,
        ]);
    }

    public function resolveDomain(Request $request)
    {
        $domain = $request->query('domain');
        if (!$domain) {
            return response()->json(['error' => 'Domain parameter required'], 400);
        }

        $store = Store::where('domain', $domain)->where('is_active', true)->first();

        if (!$store) {
            return response()->json(['exists' => false], 404);
        }

        return response()->json([
            'exists' => true,
            'id' => $store->id,
            'name' => $store->name,
            'site_code' => $store->site_code,
            'domain' => $store->domain,
        ]);
    }

    public function product(string $siteCode, string $id)
    {
        $store = Store::where('site_code', $siteCode)->where('is_active', true)->first();
        if (!$store) {
            return response()->json(['error' => 'Store not found'], 404);
        }

        putenv('AIMEOS_SITE_CODE=' . $store->site_code);
        $context = app('aimeos.context')->get();
        $manager = MShop::create($context, 'product');

        try {
            $item = $manager->get($id, ['price', 'media', 'text']);
        } catch (\Aimeos\MShop\Exception $e) {
            return response()->json(['error' => 'Product not found'], 404);
        }

        // Verify product belongs to this store (multi-tenant isolation)
        if (!$this->isProductOwnedByStore($context, $item->getId(), (string) $store->id)) {
            return response()->json(['error' => 'Product not found'], 404);
        }

        $data = $item->toArray();

        $prices = $item->getRefItems('price');
        $data['price'] = null;
        if (!empty($prices)) {
            $price = reset($prices);
            $data['price'] = $price->getValue();
            $data['currency'] = $price->getCurrencyId();
        }

        $medias = $item->getRefItems('media');
        $data['image'] = null;
        if (!empty($medias)) {
            $media = reset($medias);
            $data['image'] = $media->getUrl();
        }

        $texts = $item->getRefItems('text');
        $data['description'] = null;
        if (!empty($texts)) {
            foreach ($texts as $text) {
                if ($text->getType() === 'default' || $text->getType() === 'long') {
                    $data['description'] = $text->getContent();
                    break;
                }
            }
        }

        return response()->json($data);
    }
}
