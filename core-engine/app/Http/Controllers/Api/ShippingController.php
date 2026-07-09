<?php

namespace App\Http\Controllers\Api;

use App\Models\ShippingSetting;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class ShippingController extends Controller
{
    public function index(Request $request)
    {
        $store = $request->user()->store;
        if (!$store) {
            return response()->json(['error' => 'No store found'], 404);
        }

        $settings = ShippingSetting::firstOrCreate(
            ['store_id' => $store->id],
            ['method' => 'flat_rate', 'flat_rate' => 0, 'is_active' => true]
        );

        return $settings;
    }

    public function update(Request $request)
    {
        $store = $request->user()->store;
        if (!$store) {
            return response()->json(['error' => 'No store found'], 404);
        }

        $validated = $request->validate([
            'method' => 'sometimes|string|in:flat_rate,free',
            'flat_rate' => 'sometimes|numeric|min:0',
            'free_shipping_threshold' => 'nullable|numeric|min:0',
            'zones' => 'nullable|array',
            'is_active' => 'boolean',
        ]);

        $settings = ShippingSetting::firstOrCreate(
            ['store_id' => $store->id],
            ['method' => 'flat_rate', 'flat_rate' => 0, 'is_active' => true]
        );

        $settings->update($validated);

        return $settings->fresh();
    }
}