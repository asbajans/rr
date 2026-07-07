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

        try {
            $context = $this->context();
            $manager = MShop::create($context, 'product');
            $item = $manager->create();
            $item->setCode($validated['code']);
            $item->setLabel($validated['label']);
            $item->setStatus($validated['status'] ?? 1);
            if (isset($validated['stock'])) {
                $propManager = MShop::create($context, 'product/property');
                $prop = $propManager->create();
                $prop->setParentId($item->getId());
                $prop->setValue((string) (int) $validated['stock']);
                $prop->setType('stock');
                $prop->setLanguageId(null);
                $propManager->save($prop);
            }
            $manager->save($item);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Product create failed: ' . $e->getMessage()], 500);
        }

        try {
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

            if (!empty($validated['media_url'])) {
                $this->attachMedia($context, $item->getId(), $validated['media_url']);
            }

            $saved = $manager->get($item->getId(), ['price', 'media']);
            $data = $saved->toArray();
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Product setup failed: ' . $e->getMessage()], 500);
        }

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
            $listManager = MShop::create($context, 'product/lists');
            $priceListSearch = $listManager->filter();
            $priceListSearch->setConditions($priceListSearch->and([
                $priceListSearch->compare('==', 'product.lists.parentid', $item->getId()),
                $priceListSearch->compare('==', 'product.lists.domain', 'price'),
            ]));
            $oldLists = $listManager->search($priceListSearch);
            $priceManager = MShop::create($context, 'price');
            foreach ($oldLists as $oldList) {
                $priceManager->delete($oldList->getRefId());
                $listManager->delete($oldList->getId());
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
            $propSearch = $propManager->filter();
            $propSearch->setConditions($propSearch->and([
                $propSearch->compare('==', 'product.property.parentid', $item->getId()),
                $propSearch->compare('==', 'product.property.type', 'stock'),
            ]));
            $oldProps = $propManager->search($propSearch);
            foreach ($oldProps as $oldProp) {
                $propManager->delete($oldProp->getId());
            }

            $prop = $propManager->create();
            $prop->setParentId($item->getId());
            $prop->setValue((string) (int) $validated['stock']);
            $prop->setType('stock');
            $prop->setLanguageId(null);
            $propManager->save($prop);
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
