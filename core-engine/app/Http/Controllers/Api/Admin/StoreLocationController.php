<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\StoreLocation;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;

class StoreLocationController extends Controller
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
        $locations = StoreLocation::where('store_id', $store->id)
            ->orderByDesc('is_primary')
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $locations]);
    }

    public function store(Request $request)
    {
        $store = $this->getStore($request);

        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'address' => 'required|string|max:1000',
            'city' => 'required|string|max:100',
            'country' => 'sometimes|string|max:100',
            'phone' => 'nullable|string|max:20',
            'working_hours' => 'nullable|array',
            'is_primary' => 'boolean',
        ]);

        $location = StoreLocation::create([
            ...$validated,
            'store_id' => $store->id,
            'country' => $validated['country'] ?? 'Türkiye',
        ]);

        if ($location->is_primary) {
            StoreLocation::where('store_id', $store->id)
                ->where('id', '!=', $location->id)
                ->update(['is_primary' => false]);
        }

        return response()->json($location, 201);
    }

    public function update(Request $request, StoreLocation $location)
    {
        $store = $this->getStore($request);
        if ($location->store_id !== $store->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'latitude' => 'sometimes|numeric|between:-90,90',
            'longitude' => 'sometimes|numeric|between:-180,180',
            'address' => 'sometimes|string|max:1000',
            'city' => 'sometimes|string|max:100',
            'country' => 'sometimes|string|max:100',
            'phone' => 'nullable|string|max:20',
            'working_hours' => 'nullable|array',
            'is_primary' => 'boolean',
        ]);

        $location->update($validated);

        if ($location->is_primary) {
            StoreLocation::where('store_id', $store->id)
                ->where('id', '!=', $location->id)
                ->update(['is_primary' => false]);
        }

        return response()->json($location);
    }

    public function destroy(Request $request, StoreLocation $location)
    {
        $store = $this->getStore($request);
        if ($location->store_id !== $store->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }
        $location->delete();
        return response()->json(['message' => 'Location deleted']);
    }

    public function publicLocations(string $siteCode)
    {
        $store = \App\Models\Store::where('site_code', $siteCode)->first();
        if (!$store) {
            return response()->json(['error' => 'Store not found'], 404);
        }

        $locations = StoreLocation::where('store_id', $store->id)->get();

        return response()->json(['data' => $locations]);
    }
}
