<?php

namespace App\Http\Controllers\Api;

use Aimeos\MShop;
use App\Models\B2bListedProduct;
use App\Models\B2bRequest;
use App\Models\ProductB2bSetting;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;

class B2bController extends Controller
{
    private function context(): \Aimeos\MShop\ContextIface
    {
        return app('aimeos.context')->get();
    }

    private function getUserStore(Request $request): Store
    {
        $store = $request->user()->store;
        if (!$store) {
            throw ValidationException::withMessages(['store' => 'No store assigned']);
        }
        return $store;
    }

    private function enrichProduct(string $productId, string $currency = 'TRY'): ?array
    {
        try {
            $context = $this->context();
            $manager = MShop::create($context, 'product');
            $item = $manager->get($productId);
        } catch (\Exception $e) {
            return null;
        }

        $data = [
            'id' => $item->getId(),
            'code' => $item->getCode(),
            'label' => $item->getLabel(),
            'status' => $item->getStatus(),
            'price' => null,
            'currency' => $currency,
            'stock' => null,
            'image' => null,
            'images' => [],
            'marketplace_data' => [],
            'marketplaces' => [],
            'category' => null,
            'brand' => null,
        ];

        try {
            $priceManager = MShop::create($context, 'price');
            $listManager = MShop::create($context, 'product/lists');
            $ls = $listManager->filter();
            $ls->setConditions($ls->and([
                $ls->compare('==', 'product.lists.parentid', $productId),
                $ls->compare('==', 'product.lists.domain', 'price'),
            ]));
            foreach ($listManager->search($ls) as $li) {
                $priceItem = $priceManager->get($li->getRefId());
                $data['price'] = $priceItem->getValue();
                $data['currency'] = $priceItem->getCurrencyId();
                break;
            }
        } catch (\Throwable $e) {}

        try {
            $propManager = MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $productId),
                $ps->compare('==', 'product.property.type', 'stock'),
            ]));
            foreach ($propManager->search($ps) as $prop) {
                $data['stock'] = (int) $prop->getValue();
                break;
            }
        } catch (\Throwable $e) {}

        try {
            $mediaManager = MShop::create($context, 'media');
            $listManager2 = MShop::create($context, 'product/lists');
            $ls2 = $listManager2->filter();
            $ls2->setConditions($ls2->and([
                $ls2->compare('==', 'product.lists.parentid', $productId),
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
        } catch (\Throwable $e) {}

        // marketplace_data
        try {
            $propManager = MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $productId),
                $ps->compare('==', 'product.property.type', 'marketplace_data'),
            ]));
            foreach ($propManager->search($ps) as $prop) {
                $val = $prop->getValue();
                if (!empty($val)) {
                    $data['marketplace_data'] = json_decode($val, true) ?? [];
                }
                break;
            }
        } catch (\Throwable $e) {}

        // marketplaces
        try {
            $propManager = MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $productId),
                $ps->compare('==', 'product.property.type', 'marketplaces'),
            ]));
            foreach ($propManager->search($ps) as $prop) {
                $val = $prop->getValue();
                if (!empty($val)) {
                    $data['marketplaces'] = array_filter(array_map('trim', explode(',', $val)));
                }
                break;
            }
        } catch (\Throwable $e) {}

        // category and brand
        try {
            $propManager = MShop::create($context, 'product/property');
            foreach (['category', 'brand'] as $type) {
                $ps = $propManager->filter();
                $ps->setConditions($ps->and([
                    $ps->compare('==', 'product.property.parentid', $productId),
                    $ps->compare('==', 'product.property.type', $type),
                ]));
                foreach ($propManager->search($ps) as $prop) {
                    $data[$type] = $prop->getValue();
                    break;
                }
            }
        } catch (\Throwable $e) {}

        return $data;
    }

    public function discover(Request $request)
    {
        $store = $this->getUserStore($request);

        $query = ProductB2bSetting::where('is_b2b_enabled', true)
            ->where('store_id', '!=', $store->id)
            ->with('store');

        if ($request->has('search')) {
            $search = $request->input('search');
            $productIds = [];
            try {
                $context = $this->context();
                $manager = MShop::create($context, 'product');
                $filter = $manager->filter();
                $filter->setConditions($filter->like('product.label', '%' . $search . '%'));
                $filter->setSortations([$filter->sort('-', 'product.id')]);
                $filter->slice(0, 100);
                foreach ($manager->search($filter) as $item) {
                    $productIds[] = $item->getId();
                }
            } catch (\Throwable $e) {}
            if (!empty($productIds)) {
                $query->whereIn('product_id', $productIds);
            } else {
                return response()->json(['data' => [], 'total' => 0]);
            }
        }

        $perPage = min((int) $request->input('per_page', 24), 100);
        $paginator = $query->paginate($perPage);

        $result = [];
        $context = $this->context();

        foreach ($paginator->items() as $setting) {
            // Verify product exists in Aimeos and belongs to the seller's store
            $product = $this->enrichProduct($setting->product_id);
            if (!$product) continue;

            // Verify product belongs to the seller's store (multi-tenant isolation)
            if (!$this->isProductOwnedByStore($context, $setting->product_id, (string) $setting->store_id)) {
                continue;
            }

            // Skip products without basic data (label, image)
            if (empty($product['label']) || empty($product['image'])) {
                continue;
            }

            $storeInfo = $setting->store;
            $existingRequest = B2bRequest::where('from_store_id', $store->id)
                ->where('to_store_id', $storeInfo->id)
                ->where('product_id', $setting->product_id)
                ->first();

            $result[] = [
                'id' => $setting->product_id,
                'product' => $product,
                'store' => [
                    'id' => $storeInfo->id,
                    'name' => $storeInfo->name,
                    'site_code' => $storeInfo->site_code,
                ],
                'b2b_discount' => $setting->b2b_discount,
                'b2b_price' => $setting->b2b_price,
                'my_request_status' => $existingRequest?->status,
                'my_request_id' => $existingRequest?->id,
            ];
        }

        return response()->json([
            'data' => $result,
            'total' => count($result),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
        ]);
    }

    public function updateSettings(Request $request)
    {
        $store = $this->getUserStore($request);

        $validated = $request->validate([
            'product_id' => 'required|string|max:36',
            'is_b2b_enabled' => 'required|boolean',
            'b2b_discount' => 'nullable|numeric|min:0|max:100',
            'b2b_price' => 'nullable|numeric|min:0',
        ]);

        $setting = ProductB2bSetting::updateOrCreate(
            ['store_id' => $store->id, 'product_id' => $validated['product_id']],
            [
                'is_b2b_enabled' => $validated['is_b2b_enabled'],
                'b2b_discount' => $validated['b2b_discount'],
                'b2b_price' => $validated['b2b_price'],
            ]
        );

        return response()->json($setting);
    }

    public function bulkSetB2b(Request $request)
    {
        $store = $this->getUserStore($request);

        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|string|max:36',
            'is_b2b_enabled' => 'required|boolean',
        ]);

        $updated = 0;
        foreach ($validated['ids'] as $productId) {
            ProductB2bSetting::updateOrCreate(
                ['store_id' => $store->id, 'product_id' => $productId],
                [
                    'is_b2b_enabled' => $validated['is_b2b_enabled'],
                    'b2b_discount' => null,
                    'b2b_price' => null,
                ]
            );
            $updated++;
        }

        return response()->json(['updated' => $updated]);
    }

    public function getSettings(Request $request, ?string $productId = null)
    {
        $store = $this->getUserStore($request);

        $query = ProductB2bSetting::where('store_id', $store->id);

        if ($productId) {
            $query->where('product_id', $productId);
        }

        $settings = $query->get();

        if ($productId) {
            $setting = $settings->first();
            if (!$setting) {
                return response()->json([
                    'is_b2b_enabled' => false,
                    'b2b_discount' => null,
                    'b2b_price' => null,
                ]);
            }
            return response()->json($setting);
        }

        $result = [];
        foreach ($settings as $setting) {
            $product = $this->enrichProduct($setting->product_id);
            if (!$product) continue;
            $result[] = [
                'id' => $setting->product_id,
                'product' => $product,
                'b2b_discount' => $setting->b2b_discount,
                'b2b_price' => $setting->b2b_price,
                'is_b2b_enabled' => $setting->is_b2b_enabled,
            ];
        }

        return response()->json(['data' => $result]);
    }

    public function requests(Request $request)
    {
        $store = $this->getUserStore($request);
        $type = $request->input('type', 'incoming');

        $query = $type === 'incoming'
            ? B2bRequest::where('to_store_id', $store->id)->with('fromStore')
            : B2bRequest::where('from_store_id', $store->id)->with('toStore');

        if ($request->has('status')) {
            $query->where('status', $request->input('status'));
        }

        $query->orderBy('created_at', 'desc');
        $perPage = min((int) $request->input('per_page', 20), 100);
        $paginator = $query->paginate($perPage);

        $result = [];
        foreach ($paginator->items() as $req) {
            $product = $this->enrichProduct($req->product_id);
            $relatedStore = $type === 'incoming' ? $req->fromStore : $req->toStore;

            $result[] = [
                'id' => $req->id,
                'product_id' => $req->product_id,
                'product' => $product,
                'from_store' => $req->fromStore ? [
                    'id' => $req->fromStore->id,
                    'name' => $req->fromStore->name,
                    'site_code' => $req->fromStore->site_code,
                ] : null,
                'to_store' => $req->toStore ? [
                    'id' => $req->toStore->id,
                    'name' => $req->toStore->name,
                    'site_code' => $req->toStore->site_code,
                ] : null,
                'status' => $req->status,
                'note' => $req->note,
                'created_at' => $req->created_at,
            ];
        }

        return response()->json([
            'data' => $result,
            'total' => $paginator->total(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
        ]);
    }

    public function createRequest(Request $request)
    {
        $store = $this->getUserStore($request);

        $validated = $request->validate([
            'product_id' => 'required|string|max:36',
            'to_store_id' => 'required|integer|exists:stores,id',
            'note' => 'nullable|string|max:1000',
        ]);

        if ($store->id === (int) $validated['to_store_id']) {
            throw ValidationException::withMessages(['to_store_id' => 'Cannot request your own product']);
        }

        $existing = B2bRequest::where('from_store_id', $store->id)
            ->where('to_store_id', $validated['to_store_id'])
            ->where('product_id', $validated['product_id'])
            ->whereIn('status', ['pending', 'approved'])
            ->first();

        if ($existing) {
            return response()->json([
                'error' => 'You already have a ' . $existing->status . ' request for this product',
                'status' => $existing->status,
            ], 409);
        }

        $b2bRequest = B2bRequest::create([
            'from_store_id' => $store->id,
            'to_store_id' => $validated['to_store_id'],
            'product_id' => $validated['product_id'],
            'status' => 'pending',
            'note' => $validated['note'] ?? null,
        ]);

        return response()->json($b2bRequest, 201);
    }

    public function updateRequest(Request $request, int $id)
    {
        $store = $this->getUserStore($request);

        $b2bRequest = B2bRequest::where('id', $id)->where('to_store_id', $store->id)->first();
        if (!$b2bRequest) {
            return response()->json(['error' => 'Request not found'], 404);
        }

        $validated = $request->validate([
            'status' => 'required|in:approved,rejected',
        ]);

        $b2bRequest->update(['status' => $validated['status']]);

        return response()->json($b2bRequest);
    }

    public function cloneProduct(Request $request, int $requestId)
    {
        $store = $this->getUserStore($request);

        $b2bRequest = B2bRequest::where('id', $requestId)
            ->where('from_store_id', $store->id)
            ->where('status', 'approved')
            ->first();

        if (!$b2bRequest) {
            return response()->json(['error' => 'Approved request not found'], 404);
        }

        $alreadyListed = B2bListedProduct::where('store_id', $store->id)
            ->where('original_product_id', $b2bRequest->product_id)
            ->exists();

        if ($alreadyListed) {
            return response()->json(['error' => 'Product already listed in your store'], 409);
        }

        try {
            $context = $this->context();
            $manager = MShop::create($context, 'product');
            $original = $manager->get($b2bRequest->product_id);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Original product not found'], 404);
        }

        $newCode = $original->getCode() . '-B2B-' . $store->id;
        $item = $manager->create();
        $item->setCode($newCode);
        $item->setLabel($original->getLabel() . ' (B2B)');
        $item->setStatus(1);
        $manager->save($item);

        try {
            $propManager = MShop::create($context, 'product/property');
            $sp = $propManager->create();
            $sp->setParentId($item->getId());
            $sp->setType('store_id');
            $sp->setValue((string) $store->id);
            $sp->setLanguageId(null);
            $propManager->save($sp);

            $bp = $propManager->create();
            $bp->setParentId($item->getId());
            $bp->setType('b2b_cloned');
            $bp->setValue((string) $b2bRequest->to_store_id);
            $bp->setLanguageId(null);
            $propManager->save($bp);

            // Copy marketplace data from original
            $this->copyMarketplaceData($context, $original->getId(), $item->getId());
            // Copy marketplaces property
            $this->copyMarketplaces($context, $original->getId(), $item->getId());
            // Copy category and brand
            $this->copyCategoryBrand($context, $original->getId(), $item->getId());
        } catch (\Throwable $e) {}

        try {
            $priceManager = MShop::create($context, 'price');
            $listManager = MShop::create($context, 'product/lists');
            $ls = $listManager->filter();
            $ls->setConditions($ls->and([
                $ls->compare('==', 'product.lists.parentid', $original->getId()),
                $ls->compare('==', 'product.lists.domain', 'price'),
            ]));

            $b2bSetting = ProductB2bSetting::where('store_id', $b2bRequest->to_store_id)
                ->where('product_id', $b2bRequest->product_id)
                ->first();

            foreach ($listManager->search($ls) as $li) {
                $origPrice = $priceManager->get($li->getRefId());
                $price = $priceManager->create();
                $price->setValue($b2bSetting?->b2b_price ?? $origPrice->getValue());
                $price->setCurrencyId($origPrice->getCurrencyId());
                $price->setType('default');
                $priceManager->save($price);

                $nl = $listManager->create();
                $nl->setParentId($item->getId());
                $nl->setRefId($price->getId());
                $nl->setDomain('price');
                $nl->setType('default');
                $listManager->save($nl);
                break;
            }
        } catch (\Throwable $e) {}

        try {
            $propManager = MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $original->getId()),
                $ps->compare('==', 'product.property.type', 'stock'),
            ]));
            foreach ($propManager->search($ps) as $op) {
                $prop = $propManager->create();
                $prop->setParentId($item->getId());
                $prop->setValue($op->getValue());
                $prop->setType('stock');
                $prop->setLanguageId(null);
                $propManager->save($prop);
                break;
            }
        } catch (\Throwable $e) {}

        try {
            $mediaManager = MShop::create($context, 'media');
            $listManager2 = MShop::create($context, 'product/lists');
            $ls2 = $listManager2->filter();
            $ls2->setConditions($ls2->and([
                $ls2->compare('==', 'product.lists.parentid', $original->getId()),
                $ls2->compare('==', 'product.lists.domain', 'media'),
            ]));
            foreach ($listManager2->search($ls2) as $ml) {
                $origMedia = $mediaManager->get($ml->getRefId());
                $media = $mediaManager->create();
                $media->setUrl($origMedia->getUrl());
                $media->setPreview($origMedia->getPreview());
                $media->setMimeType($origMedia->getMimeType());
                $media->setType('default');
                $media->setLabel($origMedia->getLabel());
                $mediaManager->save($media);

                $nl = $listManager2->create();
                $nl->setParentId($item->getId());
                $nl->setRefId($media->getId());
                $nl->setDomain('media');
                $nl->setType('default');
                $listManager2->save($nl);
            }
        } catch (\Throwable $e) {}

        try {
            $textManager = MShop::create($context, 'text');
            $listManager3 = MShop::create($context, 'product/lists');
            $ls3 = $listManager3->filter();
            $ls3->setConditions($ls3->and([
                $ls3->compare('==', 'product.lists.parentid', $original->getId()),
                $ls3->compare('==', 'product.lists.domain', 'text'),
            ]));
            foreach ($listManager3->search($ls3) as $tl) {
                $origText = $textManager->get($tl->getRefId());
                $text = $textManager->create();
                $text->setContent($origText->getContent());
                $text->setType($origText->getType());
                $text->setLanguageId($origText->getLanguageId());
                $text->setLabel($origText->getLabel());
                $textManager->save($text);

                $nl = $listManager3->create();
                $nl->setParentId($item->getId());
                $nl->setRefId($text->getId());
                $nl->setDomain('text');
                $nl->setType($tl->getType());
                $listManager3->save($nl);
            }
        } catch (\Throwable $e) {}

        B2bListedProduct::create([
            'store_id' => $store->id,
            'original_store_id' => $b2bRequest->to_store_id,
            'product_id' => $item->getId(),
            'original_product_id' => $b2bRequest->product_id,
            'b2b_request_id' => $b2bRequest->id,
        ]);

        return response()->json([
            'message' => 'Product cloned successfully',
            'product_id' => $item->getId(),
            'code' => $newCode,
        ]);
    }

    /**
     * Copy marketplace_data property from original to clone
     */
    private function copyMarketplaceData(\Aimeos\MShop\ContextIface $context, string $fromProductId, string $toProductId): void
    {
        try {
            $propManager = \Aimeos\MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $fromProductId),
                $ps->compare('==', 'product.property.type', 'marketplace_data'),
            ]));
            foreach ($propManager->search($ps) as $op) {
                $prop = $propManager->create();
                $prop->setParentId($toProductId);
                $prop->setType('marketplace_data');
                $prop->setValue($op->getValue());
                $prop->setLanguageId(null);
                $propManager->save($prop);
                break;
            }
        } catch (\Throwable $e) {}
    }

    /**
     * Copy marketplaces property from original to clone
     */
    private function copyMarketplaces(\Aimeos\MShop\ContextIface $context, string $fromProductId, string $toProductId): void
    {
        try {
            $propManager = \Aimeos\MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $fromProductId),
                $ps->compare('==', 'product.property.type', 'marketplaces'),
            ]));
            foreach ($propManager->search($ps) as $op) {
                $prop = $propManager->create();
                $prop->setParentId($toProductId);
                $prop->setType('marketplaces');
                $prop->setValue($op->getValue());
                $prop->setLanguageId(null);
                $propManager->save($prop);
                break;
            }
        } catch (\Throwable $e) {}
    }

    /**
     * Copy category and brand properties from original to clone
     */
    private function copyCategoryBrand(\Aimeos\MShop\ContextIface $context, string $fromProductId, string $toProductId): void
    {
        try {
            $propManager = \Aimeos\MShop::create($context, 'product/property');
            foreach (['category', 'brand'] as $type) {
                $ps = $propManager->filter();
                $ps->setConditions($ps->and([
                    $ps->compare('==', 'product.property.parentid', $fromProductId),
                    $ps->compare('==', 'product.property.type', $type),
                ]));
                foreach ($propManager->search($ps) as $op) {
                    $prop = $propManager->create();
                    $prop->setParentId($toProductId);
                    $prop->setType($type);
                    $prop->setValue($op->getValue());
                    $prop->setLanguageId(null);
                    $propManager->save($prop);
                    break;
                }
            }
        } catch (\Throwable $e) {}
    }

    public function listedProducts(Request $request)
    {
        $store = $this->getUserStore($request);

        $listed = B2bListedProduct::where('store_id', $store->id)
            ->with('originalStore')
            ->orderBy('created_at', 'desc')
            ->get();

        $result = [];
        foreach ($listed as $lp) {
            $product = $this->enrichProduct($lp->product_id);
            $original = $this->enrichProduct($lp->original_product_id);
            $result[] = [
                'id' => $lp->id,
                'product' => $product,
                'original_product' => $original,
                'original_store' => $lp->originalStore ? [
                    'id' => $lp->originalStore->id,
                    'name' => $lp->originalStore->name,
                    'site_code' => $lp->originalStore->site_code,
                ] : null,
                'created_at' => $lp->created_at,
            ];
        }

        return response()->json(['data' => $result]);
    }

    private function isProductOwnedByStore(\Aimeos\MShop\ContextIface $context, string $productId, string $storeId): bool
    {
        try {
            $propManager = \Aimeos\MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $productId),
                $ps->compare('==', 'product.property.type', 'store_id'),
            ]));
            foreach ($propManager->search($ps) as $prop) {
                return (string) $prop->getValue() === (string) $storeId;
            }
        } catch (\Throwable $e) {}
        return false;
    }
}
