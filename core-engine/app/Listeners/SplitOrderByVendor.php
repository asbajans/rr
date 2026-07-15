<?php

namespace App\Listeners;

use App\Events\OrderReceived;
use App\Models\DropshippingOrder;
use Aimeos\MShop;
use Illuminate\Support\Facades\DB;

class SplitOrderByVendor
{
    public function handle(OrderReceived $event): void
    {
        $data = $event->orderData;

        $grouped = [];

        foreach ($data['items'] as $item) {
            $vendorId = $this->getVendorIdForSku($item['sku']);

            if (!$vendorId) {
                continue;
            }

            $key = (string) $vendorId;

            if (!isset($grouped[$key])) {
                $grouped[$key] = [
                    'vendor_id' => $vendorId,
                    'items' => [],
                    'subtotal' => 0,
                ];
            }

            $lineTotal = $item['unitPrice'] * $item['quantity'];
            $grouped[$key]['items'][] = $item;
            $grouped[$key]['subtotal'] += $lineTotal;
        }

        DB::transaction(function () use ($grouped, $data) {
            foreach ($grouped as $group) {
                $ratio = $group['subtotal'] / ($data['totals']['subtotal'] ?: 1);

                DropshippingOrder::create([
                    'external_id' => $data['externalId'] . '-' . $group['vendor_id'],
                    'marketplace' => $data['marketplace'],
                    'status' => 'pending',
                    'vendor_id' => $group['vendor_id'],
                    'customer_name' => $data['customer']['name'],
                    'customer_email' => $data['customer']['email'],
                    'customer_phone' => $data['customer']['phone'] ?? null,
                    'shipping_address' => $data['customer']['address'] ?? null,
                    'items' => $group['items'],
                    'subtotal' => $group['subtotal'],
                    'shipping' => round(($data['totals']['shipping'] ?? 0) * $ratio, 2),
                    'tax' => round(($data['totals']['tax'] ?? 0) * $ratio, 2),
                    'grand_total' => round(($data['totals']['grandTotal'] ?? 0) * $ratio, 2),
                    'currency' => $data['items'][0]['currency'] ?? 'TRY',
                    'ordered_at' => $data['createdAt'] ?? now(),
                ]);
            }
        });
    }

    private function getVendorIdForSku(string $sku): ?int
    {
        try {
            $context = app('aimeos.context')->get();
            $manager = MShop::create($context, 'product');
            $item = $manager->find($sku);
            $propManager = MShop::create($context, 'product/property');
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $item->getId()),
                $ps->compare('==', 'product.property.type', 'vendor'),
            ]));
            foreach ($propManager->search($ps) as $prop) {
                return (int) $prop->getValue();
            }
        } catch (\Exception $e) {
            logger()->warning("Vendor lookup failed for SKU {$sku}: {$e->getMessage()}");
        }

        return null;
    }
}
