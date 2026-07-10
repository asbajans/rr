<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\MarketplaceIntegration;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;

class MarketplaceIntegrationController extends Controller
{
    private function getStore(Request $request): \App\Models\Store
    {
        $store = $request->user()->store;
        if (!$store) throw ValidationException::withMessages(['store' => 'No store assigned']);
        return $store;
    }

    public function index(Request $request)
    {
        try {
            $store = $this->getStore($request);
            $integrations = MarketplaceIntegration::where('store_id', $store->id)->get();
        } catch (QueryException $e) {
            return response()->json(['error' => 'Database error: ' . $e->getMessage()], 500);
        }

        $available = MarketplaceIntegration::availableMarketplaces();
        $result = [];

        foreach ($available as $key => $info) {
            $existing = $integrations->firstWhere('marketplace', $key);
            $result[] = [
                'marketplace' => $key,
                'label' => $info['label'],
                'is_active' => $existing?->is_active ?? false,
                'config' => $existing?->config ?? $this->defaultConfig($key),
                'fields' => $info['fields'],
                'id' => $existing?->id ?? null,
            ];
        }

        return response()->json(['data' => $result]);
    }

    public function update(Request $request, string $marketplace)
    {
        $store = $this->getStore($request);

        $validated = $request->validate([
            'is_active' => 'required|boolean',
            'config' => 'nullable|array',
        ]);

        if (!array_key_exists($marketplace, MarketplaceIntegration::availableMarketplaces())) {
            return response()->json(['error' => 'Invalid marketplace'], 422);
        }

        try {
            $integration = MarketplaceIntegration::updateOrCreate(
                ['store_id' => $store->id, 'marketplace' => $marketplace],
                [
                    'is_active' => $validated['is_active'],
                    'config' => $validated['config'] ?? $this->defaultConfig($marketplace),
                ]
            );
        } catch (QueryException $e) {
            return response()->json(['error' => 'Database error: ' . $e->getMessage()], 500);
        }

        return response()->json($integration);
    }

    private function defaultConfig(string $marketplace): array
    {
        return match ($marketplace) {
            'trendyol' => ['api_key' => '', 'api_secret' => '', 'supplier_id' => ''],
            'hepsiburada' => ['username' => '', 'password' => ''],
            default => [],
        };
    }
}
