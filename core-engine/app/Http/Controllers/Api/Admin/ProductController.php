<?php

namespace App\Http\Controllers\Api\Admin;

use Aimeos\MShop;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class ProductController extends Controller
{
    private function context(): \Aimeos\MShop\ContextIface
    {
        return app('aimeos.context')->get();
    }

    public function index(Request $request)
    {
        $context = $this->context();
        $manager = MShop::create($context, 'product');

        $search = $manager->filter();
        $search->setSortations([$search->sort('-', 'product.id')]);

        $total = 0;
        $items = $manager->search($search, [], $total);

        return response()->json([
            'data' => array_values($items->toArray()),
            'total' => $total,
        ]);
    }

    public function show(Request $request, string $id)
    {
        try {
            $context = $this->context();
            $manager = MShop::create($context, 'product');
            $item = $manager->get($id);
        } catch (\Aimeos\MShop\Exception $e) {
            return response()->json(['error' => 'Product not found'], 404);
        }

        return response()->json($item->toArray());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => 'required|string|max:255',
            'label' => 'required|string|max:255',
            'price' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|size:3',
            'stock' => 'nullable|integer|min:0',
            'status' => 'nullable|integer|in:0,1',
        ]);

        $context = $this->context();
        $manager = MShop::create($context, 'product');
        $item = $manager->create();
        $item->setCode($validated['code']);
        $item->setLabel($validated['label']);
        $item->setStatus($validated['status'] ?? 1);

        if (isset($validated['price'])) {
            $priceManager = MShop::create($context, 'price');
            $price = $priceManager->create();
            $price->setValue((float) $validated['price']);
            $price->setCurrencyId($validated['currency'] ?? 'TRY');
            $priceManager->save($price);
        }

        if (isset($validated['stock'])) {
            $item->setPropertyValue('stock', (int) $validated['stock'], 'stock');
        }

        $manager->save($item);

        return response()->json($item->toArray(), 201);
    }

    public function update(Request $request, string $id)
    {
        $validated = $request->validate([
            'label' => 'sometimes|string|max:255',
            'price' => 'nullable|numeric|min:0',
            'stock' => 'nullable|integer|min:0',
            'status' => 'nullable|integer|in:0,1',
        ]);

        $context = $this->context();
        $manager = MShop::create($context, 'product');

        try {
            $item = $manager->get($id);
        } catch (\Aimeos\MShop\Exception $e) {
            return response()->json(['error' => 'Product not found'], 404);
        }

        if (isset($validated['label'])) {
            $item->setLabel($validated['label']);
        }
        if (isset($validated['status'])) {
            $item->setStatus((int) $validated['status']);
        }
        if (isset($validated['price'])) {
            $priceManager = MShop::create($context, 'price');
            $price = $priceManager->create();
            $price->setValue((float) $validated['price']);
            $price->setCurrencyId('TRY');
            $priceManager->save($price);
        }
        if (array_key_exists('stock', $validated ?? [])) {
            $item->setPropertyValue('stock', (int) $validated['stock'], 'stock');
        }

        $manager->save($item);

        return response()->json($item->toArray());
    }

    public function destroy(string $id)
    {
        $context = $this->context();
        $manager = MShop::create($context, 'product');

        try {
            $manager->delete($id);
        } catch (\Aimeos\MShop\Exception $e) {
            return response()->json(['error' => 'Product not found'], 404);
        }

        return response()->json(['message' => 'Product deleted.']);
    }
}
