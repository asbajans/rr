<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\ApiKey;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class ApiKeyController extends Controller
{
    public function index()
    {
        $user = request()->user();

        if ($user->isSuperAdmin()) {
            return ApiKey::with('store')->orderBy('id')->paginate(20);
        }

        return ApiKey::where('store_id', $user->store_id)->orderBy('id')->get();
    }

    public function show(ApiKey $apiKey)
    {
        $user = request()->user();
        if (!$user->isSuperAdmin() && $apiKey->store_id !== $user->store_id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        return $apiKey->load('store');
    }

    public function store(Request $request)
    {
        $user = request()->user();
        $storeId = $request->input('store_id', $user->store_id);

        if (!$user->isSuperAdmin()) {
            $storeId = $user->store_id;
        }

        if (!$storeId) {
            return response()->json(['error' => 'No store assigned.'], 400);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'allowed_ips' => 'nullable|string',
            'expires_at' => 'nullable|date',
        ]);

        $plain = \Illuminate\Support\Str::random(32);
        $validated['key'] = hash('sha256', $plain);
        $validated['store_id'] = $storeId;

        $apiKey = ApiKey::create($validated);

        return response()->json([
            'api_key' => $apiKey->load('store'),
            'plain_text' => $plain,
        ], 201);
    }

    public function update(Request $request, ApiKey $apiKey)
    {
        $user = request()->user();
        if (!$user->isSuperAdmin() && $apiKey->store_id !== $user->store_id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'allowed_ips' => 'nullable|string',
            'expires_at' => 'nullable|date',
        ]);

        $apiKey->update($validated);

        return $apiKey->fresh('store');
    }

    public function destroy(ApiKey $apiKey)
    {
        $user = request()->user();
        if (!$user->isSuperAdmin() && $apiKey->store_id !== $user->store_id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $apiKey->delete();

        return response()->json(['message' => 'API key deleted.']);
    }
}
