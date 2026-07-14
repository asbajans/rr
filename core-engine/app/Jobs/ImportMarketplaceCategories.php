<?php

namespace App\Jobs;

use App\Models\MarketplaceCategory;
use App\Models\Store;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class ImportMarketplaceCategories implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public $timeout = 600;

    protected int $storeId;

    protected string $marketplace;

    protected array $config;

    public function __construct(int $storeId, string $marketplace, array $config)
    {
        $this->storeId = $storeId;
        $this->marketplace = $marketplace;
        $this->config = $config;
    }

    protected function cacheKey(): string
    {
        return "catimport:{$this->storeId}:{$this->marketplace}";
    }

    protected function setStatus(array $payload): void
    {
        Cache::put($this->cacheKey(), $payload, now()->addMinutes(10));
    }

    public function handle(): void
    {
        $store = Store::find($this->storeId);
        if (!$store) {
            $this->setStatus(['status' => 'failed', 'error' => 'Store not found']);

            return;
        }

        $url = env('INTEGRATION_SERVICE_URL', 'http://rahatio-integration:3001') . '/import/categories';

        try {
            $response = Http::timeout(120)->post($url, [
                'marketplace' => $this->marketplace,
                'config' => $this->config,
            ]);
        } catch (\Throwable $e) {
            $this->setStatus(['status' => 'failed', 'error' => 'Integration service unreachable: ' . $e->getMessage()]);

            return;
        }

        if (!$response->successful()) {
            $this->setStatus([
                'status' => 'failed',
                'error' => 'Kategori ağacı çekilemedi: ' . ($response->json('error') ?? $response->body()),
            ]);

            return;
        }

        $categories = $response->json('categories') ?? [];
        if (empty($categories)) {
            $this->setStatus(['status' => 'done', 'imported' => 0, 'message' => 'Pazaryerinde kategori bulunamadı']);

            return;
        }

        $byId = [];
        $children = [];
        $roots = [];
        foreach ($categories as $c) {
            $id = (string) ($c['id'] ?? '');
            if ($id === '') {
                continue;
            }
            $name = (string) ($c['name'] ?? '');
            $parentId = isset($c['parentId']) && $c['parentId'] !== null && $c['parentId'] !== '' && $c['parentId'] !== 0
                ? (string) $c['parentId']
                : null;
            $byId[$id] = ['name' => $name, 'parentId' => $parentId];
            if ($parentId === null) {
                $roots[] = $id;
            } else {
                $children[$parentId][] = $id;
            }
        }

        $rows = [];
        $visited = [];
        $walk = function (string $id, int $depth, array $chain) use (&$walk, &$rows, &$visited, $byId, $children) {
            if ($depth > 30 || isset($visited[$id])) {
                return;
            }
            $visited[$id] = true;
            $node = $byId[$id];
            $newChain = [...$chain, $node['name']];
            $rows[] = [
                'store_id' => $this->storeId,
                'marketplace' => $this->marketplace,
                'marketplace_category_id' => $id,
                'name' => $node['name'],
                'parent_id' => $node['parentId'],
                'level' => $depth,
                'path' => implode(' > ', $newChain),
                'created_at' => now(),
                'updated_at' => now(),
            ];
            foreach ($children[$id] ?? [] as $childId) {
                $walk($childId, $depth + 1, $newChain);
            }
        };

        foreach ($roots as $rootId) {
            $walk($rootId, 0, []);
        }
        foreach (array_keys($byId) as $id) {
            if (!isset($visited[$id])) {
                $walk($id, 0, []);
            }
        }

        MarketplaceCategory::where('store_id', $this->storeId)
            ->where('marketplace', $this->marketplace)
            ->delete();

        if (!empty($rows)) {
            MarketplaceCategory::insert($rows);
        }

        $this->setStatus(['status' => 'done', 'imported' => count($rows)]);
    }

    public function failed(\Throwable $e): void
    {
        $this->setStatus(['status' => 'failed', 'error' => $e->getMessage()]);
    }
}
