<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\ProductVariant;
use App\Models\Variation;
use App\Models\VariationOption;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;

class VariationController extends Controller
{
    private function getStore(Request $request): \App\Models\Store
    {
        $store = $request->user()->store;
        if (!$store) throw ValidationException::withMessages(['store' => 'No store assigned']);
        return $store;
    }

    public function index(Request $request)
    {
        $store = $this->getStore($request);
        $variations = Variation::where('store_id', $store->id)->with('options')->orderBy('name')->get();
        return response()->json(['data' => $variations]);
    }

    public function store(Request $request)
    {
        $store = $this->getStore($request);
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:select,color,text',
            'options' => 'nullable|array',
            'options.*.value' => 'required|string|max:255',
            'options.*.sort_order' => 'nullable|integer|min:0',
        ]);

        $variation = Variation::create([
            'store_id' => $store->id,
            'name' => $validated['name'],
            'type' => $validated['type'],
        ]);

        if (!empty($validated['options'])) {
            foreach ($validated['options'] as $i => $opt) {
                VariationOption::create([
                    'variation_id' => $variation->id,
                    'value' => $opt['value'],
                    'sort_order' => $opt['sort_order'] ?? $i,
                ]);
            }
        }

        $variation->load('options');
        return response()->json($variation, 201);
    }

    public function show(Request $request, Variation $variation)
    {
        $store = $this->getStore($request);
        if ($variation->store_id !== $store->id) return response()->json(['error' => 'Not found'], 404);
        $variation->load('options');
        return response()->json($variation);
    }

    public function update(Request $request, Variation $variation)
    {
        $store = $this->getStore($request);
        if ($variation->store_id !== $store->id) return response()->json(['error' => 'Not found'], 404);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'type' => 'sometimes|in:select,color,text',
        ]);

        $variation->update($validated);

        if ($request->has('options')) {
            $options = $request->input('options', []);
            $variation->options()->delete();
            foreach ($options as $i => $opt) {
                VariationOption::create([
                    'variation_id' => $variation->id,
                    'value' => $opt['value'] ?? $opt,
                    'sort_order' => $opt['sort_order'] ?? $i,
                ]);
            }
        }

        $variation->load('options');
        return response()->json($variation);
    }

    public function destroy(Request $request, Variation $variation)
    {
        $store = $this->getStore($request);
        if ($variation->store_id !== $store->id) return response()->json(['error' => 'Not found'], 404);
        $variation->options()->delete();
        $variation->delete();
        return response()->json(['message' => 'Variation deleted']);
    }

    public function variants(Request $request, string $productId)
    {
        $store = $this->getStore($request);
        $variants = ProductVariant::where('store_id', $store->id)
            ->where('product_id', $productId)
            ->orderBy('created_at')
            ->get();
        return response()->json(['data' => $variants]);
    }

    public function storeVariant(Request $request)
    {
        $store = $this->getStore($request);
        $validated = $request->validate([
            'product_id' => 'required|string|max:36',
            'sku' => 'required|string|max:255',
            'price' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|size:3',
            'stock' => 'nullable|integer|min:0',
            'attributes' => 'nullable|array',
            'image' => 'nullable|string|max:1024',
            'is_active' => 'nullable|boolean',
        ]);

        $existing = ProductVariant::where('store_id', $store->id)
            ->where('product_id', $validated['product_id'])
            ->where('sku', $validated['sku'])
            ->first();

        if ($existing) {
            return response()->json(['error' => 'Variant with this SKU already exists'], 409);
        }

        $validated['store_id'] = $store->id;
        $variant = ProductVariant::create($validated);
        return response()->json($variant, 201);
    }

    public function updateVariant(Request $request, ProductVariant $variant)
    {
        $store = $this->getStore($request);
        if ($variant->store_id !== $store->id) return response()->json(['error' => 'Not found'], 404);

        $validated = $request->validate([
            'sku' => 'sometimes|string|max:255',
            'price' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|size:3',
            'stock' => 'nullable|integer|min:0',
            'attributes' => 'nullable|array',
            'image' => 'nullable|string|max:1024',
            'is_active' => 'nullable|boolean',
        ]);

        $variant->update($validated);
        return response()->json($variant);
    }

    public function destroyVariant(Request $request, ProductVariant $variant)
    {
        $store = $this->getStore($request);
        if ($variant->store_id !== $store->id) return response()->json(['error' => 'Not found'], 404);
        $variant->delete();
        return response()->json(['message' => 'Variant deleted']);
    }
}
