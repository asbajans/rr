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

        $products = [];
        foreach ($items as $item) {
            $data = ['id' => $item->getId(), 'code' => $item->getCode(), 'label' => $item->getLabel(), 'status' => $item->getStatus()];
            $data['price'] = null;
            $data['currency'] = 'TRY';
            $data['image'] = null;
            $products[] = $data;
        }

        return response()->json([
            'data' => $products,
            'total' => $total,
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

        return response()->json($item->toArray());
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
        ]);

        $context = $this->context();
        $manager = MShop::create($context, 'product');
        $item = $manager->create();
        $item->setCode($validated['code']);
        $item->setLabel($validated['label']);
        $item->setStatus($validated['status'] ?? 1);
        $manager->save($item);

        if (isset($validated['price'])) {
            try {
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
            } catch (\Throwable $e) {
                return response()->json(['error' => 'Price save failed: ' . $e->getMessage()], 500);
            }
        }

        if (isset($validated['stock'])) {
            try {
                $propManager = MShop::create($context, 'product/property');
                $prop = $propManager->create();
                $prop->setParentId($item->getId());
                $prop->setValue((string) (int) $validated['stock']);
                $prop->setType('stock');
                $prop->setLanguageId(null);
                $propManager->save($prop);
            } catch (\Throwable $e) {
                return response()->json(['error' => 'Stock save failed: ' . $e->getMessage()], 500);
            }
        }

        if (!empty($validated['media_url'])) {
            try {
                $this->attachMedia($context, $item->getId(), $validated['media_url']);
            } catch (\Throwable $e) {
                return response()->json(['error' => 'Media save failed: ' . $e->getMessage()], 500);
            }
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
        ]);

        $context = $this->context();
        $manager = MShop::create($context, 'product');

        try {
            $item = $manager->get($id);
        } catch (\Aimeos\MShop\Exception $e) {
            return response()->json(['error' => 'Product not found'], 404);
        }

        if (isset($validated['label'])) {
            $item->setLabel($validated['label']);
        }
        if (array_key_exists('status', $validated ?? [])) {
            $item->setStatus((int) $validated['status']);
        }
        $manager->save($item);

        if (array_key_exists('price', $validated ?? [])) {
            try {
                $listManager = MShop::create($context, 'product/lists');
                $ps = $listManager->filter();
                $ps->setConditions($ps->and([
                    $ps->compare('==', 'product.lists.parentid', $item->getId()),
                    $ps->compare('==', 'product.lists.domain', 'price'),
                ]));
                $oldLists = $listManager->search($ps);
                $priceManager = MShop::create($context, 'price');
                foreach ($oldLists as $ol) {
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
            } catch (\Throwable $e) {
                return response()->json(['error' => 'Price update failed: ' . $e->getMessage()], 500);
            }
        }

        if (array_key_exists('stock', $validated ?? [])) {
            try {
                $propManager = MShop::create($context, 'product/property');
                $ps = $propManager->filter();
                $ps->setConditions($ps->and([
                    $ps->compare('==', 'product.property.parentid', $item->getId()),
                    $ps->compare('==', 'product.property.type', 'stock'),
                ]));
                foreach ($propManager->search($ps) as $op) {
                    $propManager->delete($op->getId());
                }
                $prop = $propManager->create();
                $prop->setParentId($item->getId());
                $prop->setValue((string) (int) $validated['stock']);
                $prop->setType('stock');
                $prop->setLanguageId(null);
                $propManager->save($prop);
            } catch (\Throwable $e) {
                return response()->json(['error' => 'Stock update failed: ' . $e->getMessage()], 500);
            }
        }

        if (array_key_exists('media_url', $validated ?? [])) {
            try {
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
                }
            } catch (\Throwable $e) {
                return response()->json(['error' => 'Media update failed: ' . $e->getMessage()], 500);
            }
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
