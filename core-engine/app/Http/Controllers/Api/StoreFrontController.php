<?php

namespace App\Http\Controllers\Api;

use Aimeos\MShop;
use App\Models\Store;
use Illuminate\Routing\Controller;

class StoreFrontController extends Controller
{
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

        $total = 0;
        $items = $manager->search($search, ['price', 'media', 'text'], $total);

        $products = [];
        foreach ($items as $item) {
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
