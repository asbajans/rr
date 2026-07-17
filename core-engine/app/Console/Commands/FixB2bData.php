<?php

namespace App\Console\Commands;

use App\Models\B2bListedProduct;
use App\Models\Store;
use Illuminate\Console\Command;

class FixB2bData extends Command
{
    protected $signature = 'rahatio:fix-b2b-data {--restore-owner=100 : Move N of atabay non-clone products back to owner so owner has shareable inventory}';
    protected $description = 'Rebuild b2b_cloned flags from b2b_listed_products (source of truth) and optionally restore owner inventory';

    public function handle(): int
    {
        $context = app('aimeos.context')->get();
        $productManager = \Aimeos\MShop::create($context, 'product');
        $propManager = \Aimeos\MShop::create($context, 'product/property');

        // 1. Collect the set of product ids that are legitimately B2B clones
        $listed = B2bListedProduct::all();
        $legitCloneIds = [];
        foreach ($listed as $lp) {
            $legitCloneIds[$lp->product_id] = $lp->original_store_id;
        }
        $this->info('Legit B2B clones (in b2b_listed_products): ' . count($legitCloneIds));

        // 2. Scan all products: remove bogus b2b_cloned, keep legit ones
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
                // Remove bogus clone flags
                foreach ($existing as $op) {
                    $propManager->delete($op->getId());
                    $removed++;
                }
                continue;
            }

            // Legit clone: ensure the value matches the original store
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

        $this->info("Scanned {$total} products. Removed bogus clone flags: {$removed}, kept: {$kept}, added missing: {$added}");

        // 3. Optionally restore owner inventory so owner has products to share via B2B
        $restore = (int) $this->option('restore-owner');
        if ($restore > 0) {
            $owner = Store::where('site_code', 'default')->first();
            $atabay = Store::where('site_code', 'atabay')->orWhere('email', 'like', '%atabay%')->first();
            if (!$owner) {
                $this->warn('Owner store (site_code=default) not found, skipping restore.');
            } elseif (!$atabay) {
                $this->warn('Atabay store not found, skipping restore.');
            } else {
                // products currently owned by atabay (store_id property) and NOT clones
                $owned = [];
                $ps2 = $propManager->filter();
                $ps2->setConditions($ps2->and([
                    $ps2->compare('==', 'product.property.type', 'store_id'),
                    $ps2->compare('==', 'product.property.value', (string) $atabay->id),
                ]));
                $ps2->slice(0, 100000);
                foreach ($propManager->search($ps2) as $op) {
                    $owned[] = $op->getParentId();
                }

                $moved = 0;
                foreach ($owned as $pid) {
                    if ($moved >= $restore) break;
                    if (isset($legitCloneIds[$pid])) continue; // never move clones
                    // update store_id property to owner
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
                    // enable B2B sharing so other stores can discover owner's products
                    \App\Models\ProductB2bSetting::updateOrCreate(
                        ['store_id' => $owner->id, 'product_id' => $pid],
                        ['is_b2b_enabled' => true, 'b2b_discount' => null, 'b2b_price' => null]
                    );
                }
                $this->info("Moved {$moved} atabay products to owner (store_id={$owner->id}) and enabled B2B sharing.");
            }
        }

        return Command::SUCCESS;
    }
}
