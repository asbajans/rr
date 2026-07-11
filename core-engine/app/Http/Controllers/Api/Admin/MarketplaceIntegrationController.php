<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\MarketplaceIntegration;
use App\Services\AimeosProductImporter;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Http;
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

    public function importProducts(Request $request, string $marketplace, AimeosProductImporter $importer)
    {
        $store = $this->getStore($request);

        if (!array_key_exists($marketplace, MarketplaceIntegration::availableMarketplaces())) {
            return response()->json(['error' => 'Invalid marketplace'], 422);
        }

        $integration = MarketplaceIntegration::where('store_id', $store->id)
            ->where('marketplace', $marketplace)
            ->first();

        if (!$integration || !$integration->is_active) {
            return response()->json(['error' => 'Entegrasyon aktif değil'], 422);
        }

        $config = $integration->config;
        if (empty($config)) {
            return response()->json(['error' => 'Entegrasyon ayarları eksik'], 422);
        }

        $maxPages = (int) $request->input('max_pages', 5);

        try {
            $response = Http::timeout(120)
                ->post(env('INTEGRATION_SERVICE_URL', 'http://rahatio-integration:3001') . '/import/products', [
                    'marketplace' => $marketplace,
                    'config' => $config,
                    'maxPages' => $maxPages,
                ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Integration service unreachable: ' . $e->getMessage()], 502);
        }

        if (!$response->successful()) {
            return response()->json([
                'error' => 'Pazaryeri ürünleri çekilemedi',
                'detail' => $response->json('error') ?? $response->body(),
            ], 502);
        }

        $products = $response->json('products') ?? [];

        if (empty($products)) {
            return response()->json([
                'marketplace' => $marketplace,
                'summary' => ['total' => 0, 'imported' => 0, 'updated' => 0, 'failed' => 0, 'errors' => []],
                'message' => 'Pazaryerinde ürün bulunamadı',
            ]);
        }

        $summary = $importer->import($store, $products, $marketplace);

        return response()->json([
            'marketplace' => $marketplace,
            'fetched' => count($products),
            'summary' => $summary,
        ]);
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
