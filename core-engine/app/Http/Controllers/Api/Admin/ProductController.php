<?php

namespace App\Http\Controllers\Api\Admin;

use Aimeos\MShop;
use App\Events\ProductUpdated;
use App\Models\ProductMarketplaceSync;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class ProductController extends Controller
{
    private function context(): \Aimeos\MShop\ContextIface
    {
        $store = request()->user()?->store;
        if ($store && $store->site_code) {
            putenv('AIMEOS_SITE_CODE=' . $store->site_code);
            $_ENV['AIMEOS_SITE_CODE'] = $store->site_code;
            app()->forgetInstance('aimeos.context');
        }
        return app('aimeos.context')->get();
    }

    public function index(Request $request)
    {
        $context = $this->context();
        $manager = MShop::create($context, 'product');
        $storeId = $request->user()->store_id ?? null;

        $search = $manager->filter();
        $search->setSortations([$search->sort('-', 'product.id')]);
        $storeFilterId = $request->user()->store_id ?? null;
        if ($storeFilterId) {
            $search->add($search->and([
                $search->compare('==', 'product.property.type', 'store_id'),
                $search->compare('==', 'product.property.value', (string) $storeFilterId),
            ]));
        }
        $search->slice(0, 5000);

        $total = 0;
        $items = $manager->search($search, [], $total);

        $marketplacesParam = $request->query('marketplaces');
        $statusParam = $request->query('status');
        $priceMin = $request->query('price_min');
        $priceMax = $request->query('price_max');

        $perPageRaw = $request->query('per_page');
        $all = $perPageRaw === 'all';
        $page = max(1, (int) ($request->query('page') ?? 1));
        $perPage = $all ? 100000 : max(1, min(500, (int) ($perPageRaw ?: 25)));

        $wanted = $marketplacesParam !== null ? array_filter(array_map('trim', explode(',', $marketplacesParam))) : null;
        $wantsNone = $wanted !== null && in_array('__none__', $wanted, true);
        $wantsNamed = $wanted !== null ? array_values(array_diff($wanted, ['__none__'])) : [];

        $products = [];
        foreach ($items as $item) {
            $marketplaces = $this->getMarketplaces($context, $item->getId());

            if ($wanted !== null) {
                $matchNamed = !empty($wantsNamed) && (bool) array_intersect($marketplaces, $wantsNamed);
                $matchNone = $wantsNone && empty($marketplaces);
                if (!$matchNamed && !$matchNone) {
                    continue;
                }
            }

            $details = $this->productDetails($context, $item);

            $price = $details['price'];
            if ($priceMin !== null && $priceMin !== '' && $price !== null && $price < (float) $priceMin) {
                continue;
            }
            if ($priceMax !== null && $priceMax !== '' && $price !== null && $price > (float) $priceMax) {
                continue;
            }

            if ($statusParam !== null && $statusParam !== '') {
                if (($statusParam === '1') !== ($item->getStatus() === 1)) {
                    continue;
                }
            }

            $products[] = [
                'id' => $item->getId(),
                'code' => $item->getCode(),
                'label' => $item->getLabel(),
                'status' => $item->getStatus(),
                'price' => $details['price'],
                'currency' => $details['currency'],
                'stock' => $details['stock'],
                'image' => $details['image'],
                'images' => $details['images'],
                'description' => $details['description'],
                'category' => $details['category'],
                'brand' => $details['brand'],
                'marketplaces' => $marketplaces,
                'marketplace_data' => $this->getMarketplaceData($context, $item->getId()),
                'marketplace_sync' => $this->syncMap($storeId, $item->getId()),
            ];
        }

        $total = count($products);
        if (!$all) {
            $products = array_slice($products, ($page - 1) * $perPage, $perPage);
        }

        return response()->json([
            'data' => $products,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'last_page' => $all ? 1 : (int) ceil($total / $perPage),
        ]);
    }

    public function destroyMany(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'string',
        ]);

        $context = $this->context();
        $manager = MShop::create($context, 'product');
        $deleted = 0;

        foreach ($validated['ids'] as $id) {
            try {
                $manager->delete($id);
                $deleted++;
            } catch (\Throwable $e) {
                // skip products that no longer exist
            }
        }

        return response()->json([
            'message' => $deleted . ' product(s) deleted.',
            'deleted' => $deleted,
        ]);
    }

    public function show(Request $request, string $id)
    {
        try {
            $context = $this->context();
            $manager = MShop::create($context, 'product');
            $item = $manager->get($id);
        } catch (\Aimeos\MShop\Exception $e) {
            return response()->json(['error' => 'Product not found'], 404);
        }

        $storeFilterId = $request->user()->store_id ?? null;
        if ($storeFilterId) {
            $propManager = MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $item->getId()),
                $ps->compare('==', 'product.property.type', 'store_id'),
            ]));
            $ownStore = null;
            foreach ($propManager->search($ps) as $op) {
                $ownStore = $op->getValue();
            }
            if ($ownStore !== null && (string) $ownStore !== (string) $storeFilterId) {
                return response()->json(['error' => 'Product not found'], 404);
            }
        }

        $storeId = $request->user()->store_id ?? null;
        $data = $item->toArray();
        $data = array_merge($data, $this->productDetails($context, $item));
        $data['marketplaces'] = $this->getMarketplaces($context, $item->getId());
        $data['marketplace_data'] = $this->getMarketplaceData($context, $item->getId());
        $data['marketplace_sync'] = $this->syncMap($storeId, $item->getId());

        return response()->json($data);
    }

    private function syncMap(?int $storeId, string $productId): array
    {
        $query = ProductMarketplaceSync::where('product_id', $productId);
        if ($storeId !== null) {
            $query->where('store_id', $storeId);
        }

        $map = [];
        foreach ($query->get() as $row) {
            $map[$row->marketplace] = [
                'status' => $row->status,
                'marketplace_product_id' => $row->marketplace_product_id,
                'error_message' => $row->error_message,
                'checked_at' => $row->checked_at?->toISOString(),
            ];
        }

        return $map;
    }

    public function syncStatus(Request $request, string $id)
    {
        $validated = $request->validate([
            'store_id' => 'required|integer',
            'marketplace' => 'required|string',
            'success' => 'required|boolean',
            'marketplaceId' => 'nullable|string',
            'error' => 'nullable|string',
        ]);

        ProductMarketplaceSync::syncResult(
            (int) $validated['store_id'],
            $id,
            $validated['marketplace'],
            (bool) $validated['success'],
            $validated['marketplaceId'] ?? null,
            $validated['error'] ?? null
        );

        return response()->json(['ok' => true]);
    }

    public function verify(Request $request, string $id)
    {
        $validated = $request->validate([
            'marketplace' => 'required|string|in:trendyol,n11,pazarama,hepsiburada,amazon',
        ]);

        $store = $request->user()->store;
        if (!$store) {
            return response()->json(['error' => 'Store not found'], 404);
        }

        $context = $this->context();
        $manager = MShop::create($context, 'product');
        $item = $manager->get($id);

        $sku = $item->getCode();
        $barcode = $this->getProp($context, $id, 'barcode') ?: $sku;

        $mi = \App\Models\MarketplaceIntegration::where('store_id', $store->id)
            ->where('marketplace', $validated['marketplace'])
            ->first();

        if (!$mi || !$mi->is_active) {
            return response()->json(['error' => 'Marketplace not configured'], 400);
        }

        $config = $mi->config ?? [];

        $base = rtrim(env('INTEGRATION_SERVICE_URL', 'http://rahatio-integration:3001'), '/');
        $response = \Illuminate\Support\Facades\Http::withHeaders([
            'X-Internal-Key' => env('RAHAT_INTERNAL_KEY', ''),
        ])->timeout(30)->post($base . '/verify/product', [
            'marketplace' => $validated['marketplace'],
            'config' => $config,
            'sku' => $sku,
            'barcode' => $barcode,
        ]);

        if (!$response->successful()) {
            return response()->json(['error' => 'Verification request failed'], 502);
        }

        $result = $response->json();
        $exists = (bool) ($result['exists'] ?? false);
        $marketplaceId = $result['marketplaceId'] ?? null;

        ProductMarketplaceSync::syncResult(
            $store->id,
            $id,
            $validated['marketplace'],
            $exists,
            $marketplaceId,
            $exists ? null : ($result['error'] ?? 'Pazaryerinde bulunamadı')
        );

        return response()->json([
            'marketplace' => $validated['marketplace'],
            'exists' => $exists,
            'marketplace_product_id' => $marketplaceId,
            'error' => $result['error'] ?? null,
            'detail' => $result['detail'] ?? null,
            'sync' => $this->syncMap($store->id, $id)[$validated['marketplace']] ?? null,
        ]);
    }

    private function productDetails(\Aimeos\MShop\ContextIface $context, \Aimeos\MShop\Common\Item\Iface $item): array
    {
        $id = $item->getId();
        $data = ['label' => $item->getLabel(), 'status' => $item->getStatus(), 'code' => $item->getCode(), 'price' => null, 'currency' => 'TRY', 'stock' => null, 'image' => null, 'images' => [], 'description' => null, 'category' => null, 'brand' => null];

        try {
            $priceManager = MShop::create($context, 'price');
            $listManager = MShop::create($context, 'product/lists');
            $ls = $listManager->filter();
            $ls->setConditions($ls->and([
                $ls->compare('==', 'product.lists.parentid', $id),
                $ls->compare('==', 'product.lists.domain', 'price'),
            ]));
            foreach ($listManager->search($ls) as $li) {
                $priceItem = $priceManager->get($li->getRefId());
                $data['price'] = $priceItem->getValue();
                $data['currency'] = $priceItem->getCurrencyId();
                break;
            }
        } catch (\Throwable $e) {
            // price not available
        }

        try {
            $propManager = MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $id),
                $ps->compare('==', 'product.property.type', 'stock'),
            ]));
            foreach ($propManager->search($ps) as $prop) {
                $data['stock'] = (int) $prop->getValue();
                break;
            }
        } catch (\Throwable $e) {
            // stock not available
        }

        try {
            $mediaManager = MShop::create($context, 'media');
            $listManager2 = MShop::create($context, 'product/lists');
            $ls2 = $listManager2->filter();
            $ls2->setConditions($ls2->and([
                $ls2->compare('==', 'product.lists.parentid', $id),
                $ls2->compare('==', 'product.lists.domain', 'media'),
            ]));
            $ls2->setSortations([$ls2->sort('+', 'product.lists.position')]);
            foreach ($listManager2->search($ls2) as $ml) {
                $mediaItem = $mediaManager->get($ml->getRefId());
                $url = $mediaItem->getUrl();
                $data['images'][] = $url;
                if ($data['image'] === null) {
                    $data['image'] = $url;
                }
            }
        } catch (\Throwable $e) {
            // media not available
        }

        $data['description'] = $this->getText($context, $id);
        $data['category'] = $this->getProp($context, $id, 'category');
        $data['brand'] = $this->getProp($context, $id, 'brand');
        $data['marketplace_data'] = $this->getMarketplaceData($context, $id);

        return $data;
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => 'required|string|max:255',
            'label' => 'required|string|max:255',
            'price' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|size:3',
            'stock' => 'nullable|integer|min:0',
            'status' => 'nullable|integer|in:0,1',
            'description' => 'nullable|string',
            'marketplaces' => 'nullable|array',
            'marketplaces.*' => 'nullable|string|max:32',
            'marketplace_data' => 'nullable|array',
            'marketplace_data.*.category' => 'nullable|string|max:255',
            'marketplace_data.*.category_id' => 'nullable|string|max:255',
            'marketplace_data.*.brand' => 'nullable|string|max:255',
            'marketplace_data.*.on_sale' => 'nullable|boolean',
            'media_url' => 'nullable|string|max:1024',
            'media_urls' => 'nullable|array|max:12',
            'media_urls.*' => 'nullable|string|max:1024',
        ]);

        $store = $request->user()->store;
        if ($store && $store->plan && $store->plan->product_limit >= 0) {
            $context = $this->context();
            $filter = MShop::create($context, 'product')->filter();
            $count = MShop::create($context, 'product')->search($filter)->count();
            if ($count >= $store->plan->product_limit) {
                return response()->json([
                    'error' => 'Product limit reached. Upgrade your plan.',
                    'limit' => $store->plan->product_limit,
                    'current' => $count,
                ], 403);
            }
        }

        $context = $this->context();
        $manager = MShop::create($context, 'product');

        $existingSearch = $manager->filter()->add(['product.code' => $validated['code']])->slice(0, 1);
        $existing = $manager->search($existingSearch)->first();

        $item = $existing ?: $manager->create();
        $item->setCode($validated['code']);
        $item->setLabel($validated['label']);
        $item->setStatus($validated['status'] ?? 1);
        $item = $manager->save($item);

        if ($store) {
            $propManager = MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $item->getId()),
                $ps->compare('==', 'product.property.type', 'store_id'),
            ]));
            foreach ($propManager->search($ps) as $op) {
                $propManager->delete($op->getId());
            }
            $prop = $propManager->create();
            $prop->setParentId($item->getId());
            $prop->setType('store_id');
            $prop->setValue((string) $store->id);
            $prop->setLanguageId(null);
            $propManager->save($prop);
        }

        if (isset($validated['price'])) {
            $priceManager = MShop::create($context, 'price');
            $listManager = MShop::create($context, 'product/lists');
            $ps = $listManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.lists.parentid', $item->getId()),
                $ps->compare('==', 'product.lists.domain', 'price'),
            ]));
            foreach ($listManager->search($ps) as $ol) {
                $priceManager->delete($ol->getRefId());
                $listManager->delete($ol->getId());
            }
            $price = $priceManager->create();
            $price->setValue((float) $validated['price']);
            $price->setCurrencyId($validated['currency'] ?? 'TRY');
            $price->setType('default');
            $priceManager->save($price);

            $list = $listManager->create();
            $list->setParentId($item->getId());
            $list->setRefId($price->getId());
            $list->setDomain('price');
            $list->setType('default');
            $listManager->save($list);
        }

        if (isset($validated['stock'])) {
            $propManager = MShop::create($context, 'product/property');
            $prop = $propManager->create();
            $prop->setParentId($item->getId());
            $prop->setValue((string) (int) $validated['stock']);
            $prop->setType('stock');
            $prop->setLanguageId(null);
            $propManager->save($prop);
        }

        if ($existing) {
            $listManager = MShop::create($context, 'product/lists');
            $ms = $listManager->filter();
            $ms->setConditions($ms->and([
                $ms->compare('==', 'product.lists.parentid', $item->getId()),
                $ms->compare('==', 'product.lists.domain', 'media'),
            ]));
            $mediaManager = MShop::create($context, 'media');
            foreach ($listManager->search($ms) as $ol) {
                $mediaManager->delete($ol->getRefId());
                $listManager->delete($ol->getId());
            }
        }

        if (!empty($validated['media_url'])) {
            $this->attachMedia($context, $item->getId(), $validated['media_url']);
        } elseif (!empty($validated['media_urls'])) {
            foreach (array_slice($validated['media_urls'], 0, 12) as $url) {
                if (!empty($url)) {
                    $this->attachMedia($context, $item->getId(), $url);
                }
            }
        }

        if (isset($validated['marketplaces'])) {
            $this->saveMarketplaces($context, $item->getId(), $validated['marketplaces']);
        }

        if (array_key_exists('description', $validated ?? [])) {
            $this->saveText($context, $item->getId(), $validated['description'] ?? null);
        }
        if (array_key_exists('marketplace_data', $validated ?? [])) {
            $this->saveMarketplaceData($context, $item->getId(), $validated['marketplace_data'] ?? []);
        }

        if (!empty($validated['marketplaces'])) {
            ProductMarketplaceSync::markPending($store?->id, $item->getId(), $validated['marketplaces']);
            ProductMarketplaceSync::markRemoved($store?->id, $item->getId(), $validated['marketplaces']);
            ProductUpdated::dispatch($item, $store?->id);
        }

        return response()->json($item->toArray(), 201);
    }

    public function update(Request $request, string $id)
    {
        $validated = $request->validate([
            'label' => 'sometimes|string|max:255',
            'price' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|size:3',
            'stock' => 'nullable|integer|min:0',
            'status' => 'nullable|integer|in:0,1',
            'description' => 'nullable|string',
            'marketplaces' => 'nullable|array',
            'marketplaces.*' => 'nullable|string|max:32',
            'marketplace_data' => 'nullable|array',
            'marketplace_data.*.category' => 'nullable|string|max:255',
            'marketplace_data.*.category_id' => 'nullable|string|max:255',
            'marketplace_data.*.brand' => 'nullable|string|max:255',
            'marketplace_data.*.on_sale' => 'nullable|boolean',
            'media_url' => 'nullable|string|max:1024',
            'media_urls' => 'nullable|array|max:12',
            'media_urls.*' => 'nullable|string|max:1024',
        ]);

        $context = $this->context();
        $manager = MShop::create($context, 'product');

        try {
            $item = $manager->get($id);
        } catch (\Aimeos\MShop\Exception $e) {
            return response()->json(['error' => 'Product not found'], 404);
        }

        $storeFilterId = $request->user()->store_id ?? null;
        if ($storeFilterId) {
            $propManager = MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $item->getId()),
                $ps->compare('==', 'product.property.type', 'store_id'),
            ]));
            $ownStore = null;
            foreach ($propManager->search($ps) as $op) {
                $ownStore = $op->getValue();
            }
            if ($ownStore !== null && (string) $ownStore !== (string) $storeFilterId) {
                return response()->json(['error' => 'Product not found'], 404);
            }
        }

        if (isset($validated['label'])) { $item->setLabel($validated['label']); }
        if (array_key_exists('status', $validated ?? [])) { $item->setStatus((int) $validated['status']); }
        $manager->save($item);

        if (array_key_exists('price', $validated ?? [])) {
            $listManager = MShop::create($context, 'product/lists');
            $ps = $listManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.lists.parentid', $item->getId()),
                $ps->compare('==', 'product.lists.domain', 'price'),
            ]));
            $priceManager = MShop::create($context, 'price');
            foreach ($listManager->search($ps) as $ol) {
                $priceManager->delete($ol->getRefId());
                $listManager->delete($ol->getId());
            }
            if ($validated['price'] !== null) {
                $price = $priceManager->create();
                $price->setValue((float) $validated['price']);
                $price->setCurrencyId($validated['currency'] ?? 'TRY');
                $price->setType('default');
                $priceManager->save($price);
                $list = $listManager->create();
                $list->setParentId($item->getId());
                $list->setRefId($price->getId());
                $list->setDomain('price');
                $list->setType('default');
                $listManager->save($list);
            }
        }

        if (array_key_exists('stock', $validated ?? [])) {
            $propManager = MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $item->getId()),
                $ps->compare('==', 'product.property.type', 'stock'),
            ]));
            foreach ($propManager->search($ps) as $op) { $propManager->delete($op->getId()); }
            $prop = $propManager->create();
            $prop->setParentId($item->getId());
            $prop->setValue((string) (int) $validated['stock']);
            $prop->setType('stock');
            $prop->setLanguageId(null);
            $propManager->save($prop);
        }

        if (array_key_exists('media_url', $validated ?? []) || array_key_exists('media_urls', $validated ?? [])) {
            $listManager = MShop::create($context, 'product/lists');
            $ms = $listManager->filter();
            $ms->setConditions($ms->and([
                $ms->compare('==', 'product.lists.parentid', $item->getId()),
                $ms->compare('==', 'product.lists.domain', 'media'),
            ]));
            $mediaManager = MShop::create($context, 'media');
            foreach ($listManager->search($ms) as $ol) {
                $mediaManager->delete($ol->getRefId());
                $listManager->delete($ol->getId());
            }
            if (!empty($validated['media_url'])) {
                $this->attachMedia($context, $item->getId(), $validated['media_url']);
            } elseif (!empty($validated['media_urls'])) {
                foreach (array_slice($validated['media_urls'], 0, 12) as $url) {
                    if (!empty($url)) {
                        $this->attachMedia($context, $item->getId(), $url);
                    }
                }
            }
        }

        if (array_key_exists('marketplaces', $validated ?? [])) {
            $this->saveMarketplaces($context, $item->getId(), $validated['marketplaces']);
        }

        if (array_key_exists('description', $validated ?? [])) {
            $this->saveText($context, $item->getId(), $validated['description'] ?? null);
        }
        if (array_key_exists('marketplace_data', $validated ?? [])) {
            $this->saveMarketplaceData($context, $item->getId(), $validated['marketplace_data'] ?? []);
        }

        if (array_key_exists('marketplaces', $validated ?? [])) {
            $mps = $validated['marketplaces'] ?? [];
            ProductMarketplaceSync::markPending($request->user()->store?->id, $item->getId(), $mps);
            ProductMarketplaceSync::markRemoved($request->user()->store?->id, $item->getId(), $mps);
            if (!empty($mps)) {
                ProductUpdated::dispatch($item, $request->user()->store?->id);
            }
        }

        return response()->json(['id' => $item->getId(), 'code' => $item->getCode(), 'label' => $item->getLabel(), 'status' => $item->getStatus()]);
    }

    public function taxonomies(Request $request)
    {
        $context = $this->context();
        $store = $request->user()->store;
        if (!$store) {
            return response()->json(['categories' => [], 'brands' => []]);
        }

        $manager = MShop::create($context, 'product');
        $items = $manager->search($manager->filter());

        $cats = [];
        $brands = [];
        foreach ($items as $item) {
            $id = $item->getId();
            $mps = $this->getMarketplaces($context, $id);
            $md = $this->getMarketplaceData($context, $id);

            foreach ($md as $scope => $vals) {
                if (!empty($vals['category'])) {
                    $cats[$scope][$vals['category']] = true;
                }
                if (!empty($vals['brand'])) {
                    $brands[$scope][$vals['brand']] = true;
                }
            }

            $legacyCat = $this->getProp($context, $id, 'category');
            $legacyBrand = $this->getProp($context, $id, 'brand');
            $legacyScopes = !empty($mps) ? $mps : ['own'];
            if ($legacyCat) {
                foreach ($legacyScopes as $s) {
                    $cats[$s][$legacyCat] = true;
                }
            }
            if ($legacyBrand) {
                foreach ($legacyScopes as $s) {
                    $brands[$s][$legacyBrand] = true;
                }
            }
        }

        $categories = [];
        foreach ($cats as $scope => $vals) {
            $categories[$scope] = array_keys($vals);
        }
        $brandList = [];
        foreach ($brands as $scope => $vals) {
            $brandList[$scope] = array_keys($vals);
        }

        return response()->json(['categories' => $categories, 'brands' => $brandList]);
    }

    public function destroy(string $id)
    {
        $context = $this->context();
        $manager = MShop::create($context, 'product');

        try {
            $manager->delete($id);
        } catch (\Aimeos\MShop\Exception $e) {
            return response()->json(['error' => 'Product not found'], 404);
        }

        return response()->json(['message' => 'Product deleted.']);
    }

    private function getMarketplaces(\Aimeos\MShop\ContextIface $context, string $productId): array
    {
        try {
            $propManager = MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $productId),
                $ps->compare('==', 'product.property.type', 'marketplaces'),
            ]));
            $props = $propManager->search($ps);
            foreach ($props as $prop) {
                $val = $prop->getValue();
                if (empty($val)) {
                    return [];
                }
                return array_filter(array_map('trim', explode(',', $val)));
            }
        } catch (\Throwable $e) {
            // property not available
        }
        return [];
    }

    private function getMarketplaceData(\Aimeos\MShop\ContextIface $context, string $productId): array
    {
        try {
            $propManager = MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $productId),
                $ps->compare('==', 'product.property.type', 'marketplace_data'),
            ]));
            foreach ($propManager->search($ps) as $prop) {
                $val = $prop->getValue();
                if (empty($val)) {
                    return [];
                }
                $dec = json_decode($val, true);
                return is_array($dec) ? $dec : [];
            }
        } catch (\Throwable $e) {
            // property not available
        }
        return [];
    }

    private function saveMarketplaceData(\Aimeos\MShop\ContextIface $context, string $productId, array $data): void
    {
        $propManager = MShop::create($context, 'product/property');
        $ps = $propManager->filter();
        $ps->setConditions($ps->and([
            $ps->compare('==', 'product.property.parentid', $productId),
            $ps->compare('==', 'product.property.type', 'marketplace_data'),
        ]));
        foreach ($propManager->search($ps) as $op) {
            $propManager->delete($op->getId());
        }

        $clean = [];
        foreach ($data as $k => $v) {
            if (!is_array($v)) {
                continue;
            }
            $clean[(string) $k] = [
                'category' => isset($v['category']) ? (string) $v['category'] : '',
                'category_id' => isset($v['category_id']) ? (string) $v['category_id'] : '',
                'brand' => isset($v['brand']) ? (string) $v['brand'] : '',
                'on_sale' => !empty($v['on_sale']),
                'status' => !empty($v['on_sale']) ? 1 : 0,
            ];
        }

        if (empty($clean)) {
            return;
        }

        $prop = $propManager->create();
        $prop->setParentId($productId);
        $prop->setType('marketplace_data');
        $prop->setValue(json_encode($clean, JSON_UNESCAPED_UNICODE));
        $prop->setLanguageId(null);
        $propManager->save($prop);
    }

    private function getText(\Aimeos\MShop\ContextIface $context, string $productId): ?string
    {
        try {
            $textManager = MShop::create($context, 'text');
            $listManager = MShop::create($context, 'product/lists');
            $ls = $listManager->filter();
            $ls->setConditions($ls->and([
                $ls->compare('==', 'product.lists.parentid', $productId),
                $ls->compare('==', 'product.lists.domain', 'text'),
                $ls->or([
                    $ls->compare('==', 'product.lists.type', 'long'),
                    $ls->compare('==', 'product.lists.type', 'default'),
                ]),
            ]));
            $ls->setSortations([$ls->sort('+', 'product.lists.type')]);
            foreach ($listManager->search($ls) as $li) {
                $text = $textManager->get($li->getRefId());
                if (($text->getContent() ?? '') !== '') {
                    return $text->getContent();
                }
            }
        } catch (\Throwable $e) {
            // text not available
        }
        return null;
    }

    private function saveText(\Aimeos\MShop\ContextIface $context, string $productId, ?string $text): void
    {
        $listManager = MShop::create($context, 'product/lists');
        $ls = $listManager->filter();
        $ls->setConditions($ls->and([
            $ls->compare('==', 'product.lists.parentid', $productId),
            $ls->compare('==', 'product.lists.domain', 'text'),
            $ls->compare('==', 'product.lists.type', 'long'),
        ]));
        $textManager = MShop::create($context, 'text');
        foreach ($listManager->search($ls) as $li) {
            $textManager->delete($li->getRefId());
            $listManager->delete($li->getId());
        }

        if ($text === null || $text === '') {
            return;
        }

        $textItem = $textManager->create();
        $textItem->setType('long');
        $textItem->setLanguageId('tr');
        $textItem->setContent($text);
        $textItem->setLabel(mb_substr($text, 0, 100));
        $textItem = $textManager->save($textItem);

        $li = $listManager->create();
        $li->setParentId($productId);
        $li->setRefId($textItem->getId());
        $li->setDomain('text');
        $li->setType('default');
        $listManager->save($li);
    }

    private function getProp(\Aimeos\MShop\ContextIface $context, string $productId, string $type): ?string
    {
        try {
            $propManager = MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $productId),
                $ps->compare('==', 'product.property.type', $type),
            ]));
            foreach ($propManager->search($ps) as $prop) {
                return $prop->getValue();
            }
        } catch (\Throwable $e) {
            // property not available
        }
        return null;
    }

    private function saveProp(\Aimeos\MShop\ContextIface $context, string $productId, string $type, ?string $value): void
    {
        $propManager = MShop::create($context, 'product/property');
        $ps = $propManager->filter();
        $ps->setConditions($ps->and([
            $ps->compare('==', 'product.property.parentid', $productId),
            $ps->compare('==', 'product.property.type', $type),
        ]));
        foreach ($propManager->search($ps) as $op) {
            $propManager->delete($op->getId());
        }

        if ($value === null || $value === '') {
            return;
        }

        $prop = $propManager->create();
        $prop->setParentId($productId);
        $prop->setType($type);
        $prop->setValue($value);
        $prop->setLanguageId(null);
        $propManager->save($prop);
    }

    private function saveMarketplaces(\Aimeos\MShop\ContextIface $context, string $productId, array $marketplaces): void
    {
        $propManager = MShop::create($context, 'product/property');
        $ps = $propManager->filter();
        $ps->setConditions($ps->and([
            $ps->compare('==', 'product.property.parentid', $productId),
            $ps->compare('==', 'product.property.type', 'marketplaces'),
        ]));
        foreach ($propManager->search($ps) as $op) {
            $propManager->delete($op->getId());
        }

        $list = array_values(array_unique(array_filter(array_map('trim', $marketplaces))));
        if (empty($list)) {
            return;
        }

        $prop = $propManager->create();
        $prop->setParentId($productId);
        $prop->setType('marketplaces');
        $prop->setValue(implode(',', $list));
        $prop->setLanguageId(null);
        $propManager->save($prop);
    }

    private function clearLists(\Aimeos\MShop\ContextIface $context, string $productId, array $domains): void
    {
        $listManager = MShop::create($context, 'product/lists');
        $ps = $listManager->filter();
        $conds = [$ps->compare('==', 'product.lists.parentid', $productId)];
        if (count($domains) === 1) {
            $conds[] = $ps->compare('==', 'product.lists.domain', $domains[0]);
        } else {
            $conds[] = $ps->or(array_map(fn ($d) => $ps->compare('==', 'product.lists.domain', $d), $domains));
        }
        $ps->setConditions($ps->and($conds));
        foreach ($listManager->search($ps) as $list) {
            $listManager->delete($list->getId());
        }
    }

    private function attachMedia(\Aimeos\MShop\ContextIface $context, string $productId, string $url): void
    {
        $ext = strtolower(pathinfo($url, PATHINFO_EXTENSION));
        $mimeMap = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
        $mime = $mimeMap[$ext] ?? 'image/jpeg';

        $mediaManager = MShop::create($context, 'media');
        $media = $mediaManager->create();
        $media->setUrl($url);
        $media->setPreview($url);
        $media->setMimeType($mime);
        $media->setType('default');
        $media->setLabel(pathinfo($url, PATHINFO_FILENAME));
        $mediaManager->save($media);

        $listManager = MShop::create($context, 'product/lists');
        $list = $listManager->create();
        $list->setParentId($productId);
        $list->setRefId($media->getId());
        $list->setDomain('media');
        $list->setType('default');
        $listManager->save($list);
    }
}
