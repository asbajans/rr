<?php

namespace App\Http\Controllers\Api\WooCommerce;

use Aimeos\MShop;
use App\Events\ProductUpdated;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $siteCode = $request->input('site_code', 'default');

        $manager = MShop::create('product');

        $search = $manager->filter()->add('product.sitecode', '==', $siteCode);

        $items = $manager->search($search);

        return response()->json($items->toArray());
    }

    public function show(Request $request, string $id)
    {
        $manager = MShop::create('product');
        $item = $manager->get($id);

        return response()->json($item->toArray());
    }

    public function sync(Request $request)
    {
        $validated = $request->validate([
            'products' => 'required|array',
            'products.*.sku' => 'required|string',
            'products.*.name' => 'required|string',
            'products.*.price' => 'required|numeric',
            'products.*.stock' => 'integer|min:0',
            'products.*.vendor_id' => 'integer|exists:stores,id',
        ]);

        $manager = MShop::create('product');
        $results = [];

        foreach ($validated['products'] as $data) {
            $item = $manager->find($data['sku'], ['product']);
            $item->setCode($data['sku']);
            $item->setLabel($data['name']);
            $item->setStatus(1);

            $priceManager = MShop::create('price');
            $price = $priceManager->create();
            $price->setValue($data['price']);
            $price->setCurrencyId('TRY');
            $priceManager->save($price);

            $item->setPropertyValue('stock', 0, 'stock');
            if (isset($data['stock'])) {
                $item->setPropertyValue('stock', (int) $data['stock'], 'stock');
            }

            if (isset($data['vendor_id'])) {
                $item->setPropertyValue('vendor_id', (int) $data['vendor_id'], 'vendor');
            }

            $manager->save($item);

            ProductUpdated::dispatch($item);

            $results[] = $item->getId();
        }

        return response()->json(['synced' => $results]);
    }
}
