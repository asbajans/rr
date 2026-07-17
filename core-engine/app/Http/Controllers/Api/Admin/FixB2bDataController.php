<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\B2bListedProduct;
use App\Models\Store;
use App\Models\User;
use Illuminate\Http\Request;

class FixB2bDataController extends Controller
{
    public function run(Request $request)
    {
        $context = app('aimeos.context')->get();
        $productManager = \Aimeos\MShop::create($context, 'product');
        $propManager = \Aimeos\MShop::create($context, 'product/property');

        $listed = B2bListedProduct::all();
        $legitCloneIds = [];
        foreach ($listed as $lp) {
            $legitCloneIds[$lp->product_id] = $lp->original_store_id;
        }

        $search = $productManager->filter();
        $search->slice(0, 100000);
        $total = 0;
        $removed = 0;
        $kept = 0;
        $added = 0;

        foreach ($productManager->search($search) as $item) {
            $total++;
            $pid = $item->getId();
            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $pid),
                $ps->compare('==', 'product.property.type', 'b2b_cloned'),
            ]));
            $existing = [];
            foreach ($propManager->search($ps) as $op) {
                $existing[$op->getId()] = $op;
            }
            $legit = $legitCloneIds[$pid] ?? null;
            if ($legit === null) {
                foreach ($existing as $op) {
                    $propManager->delete($op->getId());
                    $removed++;
                }
                continue;
            }
            $ok = false;
            foreach ($existing as $op) {
                if ((string) $op->getValue() === (string) $legit) {
                    $ok = true;
                    $kept++;
                } else {
                    $propManager->delete($op->getId());
                    $removed++;
                }
            }
            if (!$ok) {
                $prop = $propManager->create();
                $prop->setParentId($pid);
                $prop->setType('b2b_cloned');
                $prop->setValue((string) $legit);
                $prop->setLanguageId(null);
                $propManager->save($prop);
                $added++;
            }
        }

        $restore = (int) ($request->input('restore', 120));
        $moved = 0;
        $atabay = Store::where('email', 'like', '%atabay%')->first();
        $ownerUser = User::where('email', 'owner@test.com')->first();
        $owner = $ownerUser?->store;

        if ($atabay && $owner) {
            $ps2 = $propManager->filter();
            $ps2->setConditions($ps2->and([
                $ps2->compare('==', 'product.property.type', 'store_id'),
                $ps2->compare('==', 'product.property.value', (string) $atabay->id),
            ]));
            $ps2->slice(0, 100000);
            $owned = [];
            foreach ($propManager->search($ps2) as $op) {
                $owned[] = $op->getParentId();
            }
            foreach ($owned as $pid) {
                if ($moved >= $restore) break;
                if (isset($legitCloneIds[$pid])) continue;
                $ps3 = $propManager->filter();
                $ps3->setConditions($ps3->and([
                    $ps3->compare('==', 'product.property.parentid', $pid),
                    $ps3->compare('==', 'product.property.type', 'store_id'),
                ]));
                foreach ($propManager->search($ps3) as $op) {
                    $op->setValue((string) $owner->id);
                    $propManager->save($op);
                    $moved++;
                    break;
                }
                \App\Models\ProductB2bSetting::updateOrCreate(
                    ['store_id' => $owner->id, 'product_id' => $pid],
                    ['is_b2b_enabled' => true, 'b2b_discount' => null, 'b2b_price' => null]
                );
            }
        }

        return response()->json([
            'total' => $total,
            'removed_bogus_clones' => $removed,
            'kept_clones' => $kept,
            'added_clones' => $added,
            'moved_to_owner' => $moved,
            'owner_store_id' => $owner?->id,
            'atabay_store_id' => $atabay?->id,
        ]);
    }
}
