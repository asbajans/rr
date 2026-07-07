<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class SettingController extends Controller
{
    public function index()
    {
        $user = request()->user();
        $store = $user->store;

        if (!$store) {
            return response()->json(['error' => 'No store assigned.'], 404);
        }

        return $store->only(['id', 'name', 'site_code', 'domain', 'email', 'is_active']);
    }

    public function update(Request $request)
    {
        $user = request()->user();
        $store = $user->store;

        if (!$store) {
            return response()->json(['error' => 'No store assigned.'], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'domain' => 'nullable|string|max:255|unique:stores,domain,' . $store->id,
            'email' => 'nullable|email|max:255',
        ]);

        $store->update($validated);

        return $store->fresh();
    }
}
