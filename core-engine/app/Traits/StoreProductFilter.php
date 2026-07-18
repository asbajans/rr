<?php

namespace App\Traits;

use Aimeos\MShop;

trait StoreProductFilter
{
    /**
     * Get product IDs owned by a specific store.
     */
    private function getProductIdsByStore(\Aimeos\MShop\ContextIface $context, string $storeId): array
    {
        $propManager = MShop::create($context, 'product/property');
        $search = $propManager->filter();
        $search->setConditions($search->and([
            $search->compare('==', 'product.property.type', 'store_id'),
            $search->compare('==', 'product.property.value', $storeId),
        ]));
        $search->slice(0, 100000);
        $ids = [];
        foreach ($propManager->search($search) as $prop) {
            $ids[] = $prop->getParentId();
        }
        return $ids;
    }

    /**
     * Check if a product is owned by a specific store.
     */
    private function isProductOwnedByStore(\Aimeos\MShop\ContextIface $context, string $productId, string $storeId): bool
    {
        $propManager = MShop::create($context, 'product/property');
        $search = $propManager->filter();
        $search->setConditions($search->and([
            $search->compare('==', 'product.property.parentid', $productId),
            $search->compare('==', 'product.property.type', 'store_id'),
        ]));
        foreach ($propManager->search($search) as $prop) {
            return (string) $prop->getValue() === (string) $storeId;
        }
        return false;
    }
}