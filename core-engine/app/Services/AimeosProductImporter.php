<?php

namespace App\Services;

use App\Models\MarketplaceCategory;
use App\Models\Store;

class AimeosProductImporter
{
    /**
     * Import a list of normalized product records into Aimeos.
     *
     * Each record supports: sku, name, description, price, currency,
     * stock, images (array), category.
     */
    public function import(Store $store, array $records, string $source = 'import'): array
    {
        $imported = 0;
        $updated = 0;
        $failed = 0;
        $errors = [];
        $categories = [];
        $knownMarketplaces = ['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon'];

        $context = app('aimeos.context')->get();
        $productManager = \Aimeos\MShop::create($context, 'product');
        $priceManager = \Aimeos\MShop::create($context, 'price');
        $listManager = \Aimeos\MShop::create($context, 'product/lists');
        $mediaManager = \Aimeos\MShop::create($context, 'media');
        $textManager = \Aimeos\MShop::create($context, 'text');
        $propManager = \Aimeos\MShop::create($context, 'product/property');

        foreach ($records as $index => $record) {
            $sku = (string) ($record['sku'] ?? '');
            if ($sku === '') {
                $sku = $source . '-' . $store->id . '-' . $index;
            }
            $sku = mb_substr($sku, 0, 64);

            try {
                $search = $productManager->filter()->add(['product.code' => $sku])->slice(0, 1);
                $existing = $productManager->search($search)->first();

                $item = $existing ?: $productManager->create();
                $item->setCode($sku);
                $item->setLabel(mb_substr((string) ($record['name'] ?? $sku), 0, 255));
                $status = 1;
                if (array_key_exists('stock', $record)) {
                    $status = ($record['stock'] > 0) ? 1 : 0;
                }
                $item->setStatus($status);
                $item = $productManager->save($item);

                if (in_array($source, $knownMarketplaces, true)) {
                    $this->saveMarketplace($context, $item->getId(), $source);
                    $stockVal = (int) ($record['stock'] ?? 0);
                    $this->saveMarketplaceData($context, $item->getId(), [
                        $source => [
                            'category' => (string) ($record['category'] ?? ''),
                            'category_id' => (string) ($record['category_id'] ?? ''),
                            'brand' => (string) ($record['brand'] ?? ''),
                            'on_sale' => $stockVal > 0,
                        ],
                    ]);

                    if (!empty($record['category_id']) && !empty($record['category'])) {
                        $categories[(string) $record['category_id']] = (string) $record['category'];
                    }
                }

                $price = (float) ($record['price'] ?? 0);
                if ($price > 0) {
                    try {
                        $this->clearLists($context, $item->getId(), ['price']);
                        $priceItem = $priceManager->create();
                        $priceItem->setValue($price);
                        $priceItem->setCurrencyId($record['currency'] ?? 'TRY');
                        $priceItem->setType('default');
                        $priceItem = $priceManager->save($priceItem);

                        $list = $listManager->create();
                        $list->setParentId($item->getId());
                        $list->setRefId($priceItem->getId());
                        $list->setDomain('price');
                        $list->setType('default');
                        $listManager->save($list);
                    } catch (\Throwable $e) {
                        $errors[] = "Row $index ($sku) price: " . $e->getMessage();
                    }
                }

                $stock = (int) ($record['stock'] ?? 0);
                try {
                    $this->clearProperties($context, $item->getId(), ['stock']);
                    if ($stock > 0) {
                        $prop = $propManager->create();
                        $prop->setParentId($item->getId());
                        $prop->setValue((string) $stock);
                        $prop->setType('stock');
                        $prop->setLanguageId(null);
                        $propManager->save($prop);
                    }
                } catch (\Throwable $e) {
                    $errors[] = "Row $index ($sku) stock: " . $e->getMessage();
                }

                $images = $record['images'] ?? [];
                if (is_array($images)) {
                    try {
                        $this->clearLists($context, $item->getId(), ['media']);
                        foreach (array_slice($images, 0, 8) as $imageUrl) {
                            if (empty($imageUrl)) {
                                continue;
                            }
                            $imageUrl = mb_substr((string) $imageUrl, 0, 255);
                            $media = $mediaManager->create();
                            $media->setUrl($imageUrl);
                            $media->setPreview($imageUrl);
                            $media->setMimeType('image/jpeg');
                            $media->setType('default');
                            $media->setLabel(mb_substr((string) ($record['name'] ?? $sku), 0, 255));
                            $media = $mediaManager->save($media);

                            $ml = $listManager->create();
                            $ml->setParentId($item->getId());
                            $ml->setRefId($media->getId());
                            $ml->setDomain('media');
                            $ml->setType('default');
                            $listManager->save($ml);
                        }
                    } catch (\Throwable $e) {
                        $errors[] = "Row $index ($sku) media: " . $e->getMessage();
                    }
                }

                if (!empty($record['description'])) {
                    try {
                        $this->clearLists($context, $item->getId(), ['text']);
                        $text = $textManager->create();
                        $text->setContent((string) $record['description']);
                        $text->setType('long');
                        $text->setLanguageId('tr');
                        $text = $textManager->save($text);

                        $tl = $listManager->create();
                        $tl->setParentId($item->getId());
                        $tl->setRefId($text->getId());
                        $tl->setDomain('text');
                        $tl->setType('default');
                        $listManager->save($tl);
                    } catch (\Throwable $e) {
                        $errors[] = "Row $index ($sku) text: " . $e->getMessage();
                    }
                }

                if ($existing) {
                    $updated++;
                } else {
                    $imported++;
                }
            } catch (\Throwable $e) {
                $failed++;
                $errors[] = "Row $index ($sku): " . $e->getMessage();
            }
        }

        if (!empty($categories) && in_array($source, $knownMarketplaces, true)) {
            $rows = [];
            foreach ($categories as $cid => $cname) {
                $rows[] = [
                    'store_id' => $store->id,
                    'marketplace' => $source,
                    'marketplace_category_id' => (string) $cid,
                    'name' => $cname,
                    'parent_id' => null,
                    'level' => 0,
                    'path' => $cname,
                ];
            }
            MarketplaceCategory::upsert(
                $rows,
                ['store_id', 'marketplace', 'marketplace_category_id'],
                ['name', 'parent_id', 'level', 'path']
            );
        }

        return [
            'total' => count($records),
            'imported' => $imported,
            'updated' => $updated,
            'failed' => $failed,
            'errors' => array_slice($errors, 0, 20),
        ];
    }

    private function saveMarketplace(\Aimeos\MShop\ContextIface $context, string $productId, string $marketplace): void
    {
        $propManager = \Aimeos\MShop::create($context, 'product/property');
        $ps = $propManager->filter();
        $ps->setConditions($ps->and([
            $ps->compare('==', 'product.property.parentid', $productId),
            $ps->compare('==', 'product.property.type', 'marketplaces'),
        ]));
        foreach ($propManager->search($ps) as $op) {
            $propManager->delete($op->getId());
        }

        $prop = $propManager->create();
        $prop->setParentId($productId);
        $prop->setType('marketplaces');
        $prop->setValue($marketplace);
        $prop->setLanguageId(null);
        $propManager->save($prop);
    }

    private function saveMarketplaceData(\Aimeos\MShop\ContextIface $context, string $productId, array $data): void
    {
        $propManager = \Aimeos\MShop::create($context, 'product/property');
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
            $onSale = !empty($v['on_sale']);
            $clean[(string) $k] = [
                'category' => isset($v['category']) ? (string) $v['category'] : '',
                'category_id' => isset($v['category_id']) ? (string) $v['category_id'] : '',
                'brand' => isset($v['brand']) ? (string) $v['brand'] : '',
                'on_sale' => $onSale,
                'status' => $onSale ? 1 : 0,
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

    private function clearLists(\Aimeos\MShop\ContextIface $context, string $productId, array $domains): void
    {
        $listManager = \Aimeos\MShop::create($context, 'product/lists');
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

    private function clearProperties(\Aimeos\MShop\ContextIface $context, string $productId, array $types): void
    {
        $propManager = \Aimeos\MShop::create($context, 'product/property');
        $ps = $propManager->filter();
        $ps->setConditions($ps->and([
            $ps->compare('==', 'product.property.parentid', $productId),
            $ps->or(array_map(fn ($t) => $ps->compare('==', 'product.property.type', $t), $types)),
        ]));
        foreach ($propManager->search($ps) as $prop) {
            $propManager->delete($prop->getId());
        }
    }
}
