<?php

namespace App\Http\Controllers\Api\WooCommerce;

use Aimeos\MShop;
use App\Events\ProductUpdated;
use App\Traits\StoreProductFilter;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class ProductController extends Controller
{
    use StoreProductFilter;

    private function context(): \Aimeos\MShop\ContextIface
    {
        return app('aimeos.context')->get();
    }

    public function index(Request $request)
    {
        $context = $this->context();
        $manager = \Aimeos\MShop::create($context, 'product');

        // Get store from API key middleware (set as request attribute)
        $store = $request->attributes->get('store');
        $storeId = $store?->id ?? null;
        
        $search = $manager->filter();
        
        // Filter products by store_id for multi-tenant isolation
        if ($storeId) {
            $allowedIds = $this->getProductIdsByStore($context, (string) $storeId);
            if (empty($allowedIds)) {
                return response()->json([]);
            }
            $search->add($search->compare('==', 'product.id', $allowedIds));
        }

        $items = $manager->search($search);

        return response()->json($items->toArray());
    }

    public function show(Request $request, string $id)
    {
        try {
            $context = $this->context();
            $manager = \Aimeos\MShop::create($context, 'product');
            $item = $manager->get($id);
        } catch (\Aimeos\MShop\Exception $e) {
            return response()->json(['error' => 'Product not found'], 404);
        }

        // Verify product belongs to the store (multi-tenant isolation)
        $store = $request->attributes->get('store');
        $storeId = $store?->id ?? null;
        if ($storeId && !$this->isProductOwnedByStore($context, $item->getId(), (string) $storeId)) {
            return response()->json(['error' => 'Product not found'], 404);
        }

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

        $context = $this->context();
        $manager = \Aimeos\MShop::create($context, 'product');
        $results = [];

        // Get store from API key middleware
        $store = $request->attributes->get('store');
        $storeId = $store?->id ?? null;

        foreach ($validated['products'] as $data) {
            try {
                $item = $manager->find($data['sku']);
            } catch (\Aimeos\MShop\Exception $e) {
                $item = $manager->create();
                $item->setCode($data['sku']);
            }
            $item->setLabel($data['name']);
            $item->setStatus(1);

            $priceManager = \Aimeos\MShop::create($context, 'price');
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

            // Set store_id property for multi-tenant isolation
            if ($storeId) {
                $propManager = \Aimeos\MShop::create($context, 'product/property');
                $ps = $propManager->filter();
                $ps->setConditions($ps->and([
                    $ps->compare('==', 'product.property.parentid', $item->getId()),
                    $ps->compare('==', 'product.property.type', 'store_id'),
                ]));
                foreach ($propManager->search($ps) as $op) {
                    $propManager->delete($op->getId());
                }
                $prop = $propManager->create();
                $prop->setParentId($item->getId());
                $prop->setType('store_id');
                $prop->setValue((string) $storeId);
                $prop->setLanguageId(null);
                $propManager->save($prop);
            }

            $manager->save($item);

            ProductUpdated::dispatch($item);

            $results[] = $item->getId();
        }

        return response()->json(['synced' => $results]);
    }
}
