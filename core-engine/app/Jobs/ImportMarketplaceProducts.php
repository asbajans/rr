<?php

namespace App\Jobs;

use App\Models\MarketplaceImport;
use App\Models\Store;
use App\Services\AimeosProductImporter;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;

class ImportMarketplaceProducts implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public $timeout = 1800;

    protected int $importId;

    public function __construct(int $importId)
    {
        $this->importId = $importId;
    }

    public function handle(): void
    {
        $record = MarketplaceImport::find($this->importId);
        if (!$record) {
            return;
        }

        $record->update(['status' => 'processing']);

        $store = Store::find($record->store_id);
        if (!$store) {
            $record->update(['status' => 'failed', 'error' => 'Store not found']);
            return;
        }

        $marketplace = $record->marketplace;
        $config = $record->config ?? [];
        $maxPages = $record->max_pages;

        $integrationUrl = env('INTEGRATION_SERVICE_URL', 'http://rahatio-integration:3001') . '/import/products';

        try {
            $response = Http::timeout(120)->post($integrationUrl, [
                'marketplace' => $marketplace,
                'config' => $config,
                'maxPages' => $maxPages,
            ]);
        } catch (\Throwable $e) {
            $record->update([
                'status' => 'failed',
                'error' => 'Integration service unreachable: ' . $e->getMessage(),
            ]);
            return;
        }

        if (!$response->successful()) {
            $record->update([
                'status' => 'failed',
                'error' => 'Pazaryeri ürünleri çekilemedi: ' . ($response->json('error') ?? $response->body()),
            ]);
            return;
        }

        $products = $response->json('products') ?? [];

        if (empty($products)) {
            $record->update([
                'status' => 'done',
                'summary' => [
                    'total' => 0,
                    'imported' => 0,
                    'updated' => 0,
                    'failed' => 0,
                    'errors' => [],
                    'message' => 'Pazaryerinde ürün bulunamadı',
                ],
            ]);
            return;
        }

        /** @var AimeosProductImporter $importer */
        $importer = app(AimeosProductImporter::class);
        $summary = $importer->import($store, $products, $marketplace);
        $summary['fetched'] = count($products);

        $record->update(['status' => 'done', 'summary' => $summary]);
    }

    public function failed(\Throwable $e): void
    {
        $record = MarketplaceImport::find($this->importId);
        if ($record) {
            $record->update(['status' => 'failed', 'error' => $e->getMessage()]);
        }
    }
}
