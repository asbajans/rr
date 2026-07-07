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
        $items = $manager->search($search, ['price', 'media', 'text'], $total);

        $products = [];
        foreach ($items as $item) {
            $data = $item->toArray();

            $prices = $item->getRefItems('price');
            $data['price'] = null;
            $data['currency'] = 'TRY';
            if (!empty($prices)) {
                $price = reset($prices);
                $data['price'] = $price->getValue();
                $data['currency'] = $price->getCurrencyId();
            }

            $medias = $item->getRefItems('media');
            $data['image'] = null;
            if (!empty($medias)) {
                $media = reset($medias);
                $data['image'] = $media->getUrl();
            }

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
            $item = $manager->get($id, ['price', 'media', 'text']);
        } catch (\Aimeos\MShop\Exception $e) {
            return response()->json(['error' => 'Product not found'], 404);
        }

        $data = $item->toArray();

        $prices = $item->getRefItems('price');
        $data['price'] = null;
        $data['currency'] = 'TRY';
        if (!empty($prices)) {
            $price = reset($prices);
            $data['price'] = $price->getValue();
            $data['currency'] = $price->getCurrencyId();
        }

        $medias = $item->getRefItems('media');
        $data['image'] = null;
        if (!empty($medias)) {
            $media = reset($medias);
            $data['image'] = $media->getUrl();
        }

        return response()->json($data);
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
            $priceManager = MShop::create($context, 'price');
            $price = $priceManager->create();
            $price->setParentId($item->getId());
            $price->setValue((float) $validated['price']);
            $price->setCurrencyId($validated['currency'] ?? 'TRY');
            $price->setType('default');
            $priceManager->save($price);
        }

        if (isset($validated['stock'])) {
            $stockManager = MShop::create($context, 'stock');
            $stockItem = $stockManager->create();
            $stockItem->setProductId($item->getId());
            $stockItem->setStock((float) $validated['stock']);
            $stockManager->save($stockItem);
        }

        if (!empty($validated['media_url'])) {
            $this->attachMedia($context, $item->getId(), $validated['media_url']);
        }

        $saved = $manager->get($item->getId(), ['price', 'media']);
        $data = $saved->toArray();

        $prices = $saved->getRefItems('price');
        $data['price'] = null;
        $data['currency'] = 'TRY';
        if (!empty($prices)) {
            $price = reset($prices);
            $data['price'] = $price->getValue();
            $data['currency'] = $price->getCurrencyId();
        }

        $medias = $saved->getRefItems('media');
        $data['image'] = null;
        if (!empty($medias)) {
            $media = reset($medias);
            $data['image'] = $media->getUrl();
        }

        return response()->json($data, 201);
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
            $priceManager = MShop::create($context, 'price');
            $priceSearch = $priceManager->filter();
            $priceSearch->setConditions($priceSearch->compare('==', 'price.parentid', $item->getId()));
            $priceItems = $priceManager->search($priceSearch);
            foreach ($priceItems as $oldPrice) {
                $priceManager->delete($oldPrice->getId());
            }

            if ($validated['price'] !== null) {
                $price = $priceManager->create();
                $price->setParentId($item->getId());
                $price->setValue((float) $validated['price']);
                $price->setCurrencyId($validated['currency'] ?? 'TRY');
                $price->setType('default');
                $priceManager->save($price);
            }
        }

        if (array_key_exists('stock', $validated ?? [])) {
            $stockManager = MShop::create($context, 'stock');
            $stockSearch = $stockManager->filter();
            $stockSearch->setConditions($stockSearch->compare('==', 'stock.productid', $item->getId()));
            $stockItems = $stockManager->search($stockSearch);
            foreach ($stockItems as $oldStock) {
                $stockManager->delete($oldStock->getId());
            }

            $stockItem = $stockManager->create();
            $stockItem->setProductId($item->getId());
            $stockItem->setStock((float) $validated['stock']);
            $stockManager->save($stockItem);
        }

        if (array_key_exists('media_url', $validated ?? [])) {
            $listManager = MShop::create($context, 'product/lists');
            $listSearch = $listManager->filter();
            $listSearch->setConditions($listSearch->and([
                $listSearch->compare('==', 'product.lists.parentid', $item->getId()),
                $listSearch->compare('==', 'product.lists.domain', 'media'),
            ]));
            $oldLists = $listManager->search($listSearch);
            foreach ($oldLists as $ol) {
                $listManager->delete($ol->getId());
            }

            if (!empty($validated['media_url'])) {
                $this->attachMedia($context, $item->getId(), $validated['media_url']);
            }
        }

        $saved = $manager->get($item->getId(), ['price', 'media']);
        $data = $saved->toArray();

        $prices = $saved->getRefItems('price');
        $data['price'] = null;
        $data['currency'] = 'TRY';
        if (!empty($prices)) {
            $price = reset($prices);
            $data['price'] = $price->getValue();
            $data['currency'] = $price->getCurrencyId();
        }

        $medias = $saved->getRefItems('media');
        $data['image'] = null;
        if (!empty($medias)) {
            $media = reset($medias);
            $data['image'] = $media->getUrl();
        }

        return response()->json($data);
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
