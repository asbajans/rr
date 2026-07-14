<?php

namespace App\Http\Controllers\Api\Admin;

use App\Jobs\ImportMarketplaceProducts;
use App\Models\MarketplaceImport;
use App\Models\MarketplaceIntegration;
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

    public function importProducts(Request $request, string $marketplace)
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

        $record = MarketplaceImport::create([
            'store_id' => $store->id,
            'marketplace' => $marketplace,
            'config' => $config,
            'max_pages' => $maxPages,
            'status' => 'pending',
        ]);

        ImportMarketplaceProducts::dispatch($record->id);

        return response()->json([
            'id' => $record->id,
            'marketplace' => $marketplace,
            'status' => 'pending',
        ], 202);
    }

    public function importStatus(Request $request, string $marketplace, int $id)
    {
        $store = $this->getStore($request);

        $record = MarketplaceImport::where('store_id', $store->id)
            ->where('marketplace', $marketplace)
            ->where('id', $id)
            ->first();

        if (!$record) {
            return response()->json(['error' => 'Import not found'], 404);
        }

        return response()->json([
            'id' => $record->id,
            'marketplace' => $record->marketplace,
            'status' => $record->status,
            'summary' => $record->summary,
            'error' => $record->error,
            'fetched' => $record->summary['fetched'] ?? null,
        ]);
    }

    private function defaultConfig(string $marketplace): array
    {
        return match ($marketplace) {
            'trendyol' => ['api_key' => '', 'api_secret' => '', 'supplier_id' => ''],
            'hepsiburada' => ['username' => '', 'password' => ''],
            'pazarama' => ['client_id' => '', 'client_secret' => '', 'api_key' => ''],
            'n11' => ['username' => '', 'password' => ''],
            'amazon' => [
                'refresh_token' => '',
                'lwa_client_id' => '',
                'lwa_client_secret' => '',
                'aws_access_key' => '',
                'aws_secret_key' => '',
                'seller_id' => '',
                'marketplace_id' => 'A1O49J7X5Y7RJA',
            ],
            default => [],
        };
    }
}
