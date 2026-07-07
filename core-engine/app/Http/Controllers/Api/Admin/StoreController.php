<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class StoreController extends Controller
{
    public function index()
    {
        return Store::with('plan')->orderBy('id')->paginate(20);
    }

    public function show(Store $store)
    {
        return $store->load('plan', 'apiKeys');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'site_code' => 'required|string|max:32|unique:stores',
            'domain' => 'nullable|string|max:255|unique:stores',
            'email' => 'nullable|email|max:255',
            'is_active' => 'boolean',
            'plan_id' => 'nullable|exists:plans,id',
        ]);

        return Store::create($validated);
    }

    public function update(Request $request, Store $store)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'site_code' => 'sometimes|string|max:32|unique:stores,site_code,' . $store->id,
            'domain' => 'nullable|string|max:255|unique:stores,domain,' . $store->id,
            'email' => 'nullable|email|max:255',
            'is_active' => 'boolean',
            'plan_id' => 'nullable|exists:plans,id',
        ]);

        $store->update($validated);

        return $store->fresh('plan');
    }

    public function destroy(Store $store)
    {
        $store->apiKeys()->delete();
        $store->delete();

        return response()->json(['message' => 'Store deleted.']);
    }
}
