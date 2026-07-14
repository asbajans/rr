<?php

namespace App\Http\Controllers\Api\Admin;

use Aimeos\MShop;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class ProductController extends Controller
{
    private function context(): \Aimeos\MShop\ContextIface
    {
        return app('aimeos.context')->get();
    }

    public function index(Request $request)
    {
        $context = $this->context();
        $manager = MShop::create($context, 'product');

        $search = $manager->filter();
        $search->setSortations([$search->sort('-', 'product.id')]);

        $total = 0;
        $items = $manager->search($search, [], $total);

        $marketplacesParam = $request->query('marketplaces');
        $statusParam = $request->query('status');
        $priceMin = $request->query('price_min');
        $priceMax = $request->query('price_max');

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
            $stock = $details['stock'];
            $onSale = $stock !== null ? $stock > 0 : $item->getStatus() === 1;

            if ($statusParam !== null && $statusParam !== '') {
                if (($statusParam === '1') !== $onSale) {
                    continue;
                }
            }

            $price = $details['price'];
            if ($priceMin !== null && $priceMin !== '' && $price !== null && $price < (float) $priceMin) {
                continue;
            }
            if ($priceMax !== null && $priceMax !== '' && $price !== null && $price > (float) $priceMax) {
                continue;
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
                'marketplaces' => $marketplaces,
            ];
        }

        return response()->json([
            'data' => $products,
            'total' => count($products),
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

        $data = $item->toArray();
        $data = array_merge($data, $this->productDetails($context, $item));
        $data['marketplaces'] = $this->getMarketplaces($context, $item->getId());

        return response()->json($data);
    }

    private function productDetails(\Aimeos\MShop\ContextIface $context, \Aimeos\MShop\Common\Item\Iface $item): array
    {
        $id = $item->getId();
        $data = ['price' => null, 'currency' => 'TRY', 'stock' => null, 'image' => null];

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
            foreach ($listManager2->search($ls2) as $ml) {
                $mediaItem = $mediaManager->get($ml->getRefId());
                $data['image'] = $mediaItem->getUrl();
                break;
            }
        } catch (\Throwable $e) {
            // media not available
        }

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
            'media_url' => 'nullable|string|max:1024',
            'media_urls' => 'nullable|array|max:6',
            'media_urls.*' => 'nullable|string|max:1024',
            'marketplaces' => 'nullable|array',
            'marketplaces.*' => 'nullable|string|max:32',
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
        $item = $manager->create();
        $item->setCode($validated['code']);
        $item->setLabel($validated['label']);
        $item->setStatus($validated['status'] ?? 1);
        $manager->save($item);

        if (isset($validated['price'])) {
            $priceManager = MShop::create($context, 'price');
            $price = $priceManager->create();
            $price->setValue((float) $validated['price']);
            $price->setCurrencyId($validated['currency'] ?? 'TRY');
            $price->setType('default');
            $priceManager->save($price);

            $listManager = MShop::create($context, 'product/lists');
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

        if (!empty($validated['media_url'])) {
            $this->attachMedia($context, $item->getId(), $validated['media_url']);
        } elseif (!empty($validated['media_urls'])) {
            foreach (array_slice($validated['media_urls'], 0, 6) as $url) {
                if (!empty($url)) {
                    $this->attachMedia($context, $item->getId(), $url);
                }
            }
        }

        if (isset($validated['marketplaces'])) {
            $this->saveMarketplaces($context, $item->getId(), $validated['marketplaces']);
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
            'media_url' => 'nullable|string|max:1024',
            'media_urls' => 'nullable|array|max:6',
            'media_urls.*' => 'nullable|string|max:1024',
            'marketplaces' => 'nullable|array',
            'marketplaces.*' => 'nullable|string|max:32',
        ]);

        $context = $this->context();
        $manager = MShop::create($context, 'product');

        try {
            $item = $manager->get($id);
        } catch (\Aimeos\MShop\Exception $e) {
            return response()->json(['error' => 'Product not found'], 404);
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
                foreach (array_slice($validated['media_urls'], 0, 6) as $url) {
                    if (!empty($url)) {
                        $this->attachMedia($context, $item->getId(), $url);
                    }
                }
            }
        }

        if (array_key_exists('marketplaces', $validated ?? [])) {
            $this->saveMarketplaces($context, $item->getId(), $validated['marketplaces']);
        }

        return response()->json(['id' => $item->getId(), 'code' => $item->getCode(), 'label' => $item->getLabel(), 'status' => $item->getStatus()]);
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
