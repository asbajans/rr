<?php

namespace App\Console\Commands;

use App\Models\Store;
use Illuminate\Console\Command;

class BackfillProductStore extends Command
{
    protected $signature = 'rahatio:backfill-product-store {--store-id= : Store ID to assign to existing products} {--attach-users : Attach the store to users without one}';
    protected $description = 'Assign store_id property to Aimeos products that lack one';

    public function handle(): int
    {
        $storeId = $this->option('store-id');
        if (!$storeId) {
            $store = Store::where('site_code', 'default')->first() ?: Store::first();
            if (!$store) {
                $this->error('No store found. Create a store first.');
                return Command::FAILURE;
            }
            $storeId = $store->id;
        }

        $this->info("Backfilling products with store_id = {$storeId}");

        $context = app('aimeos.context')->get();
        $productManager = \Aimeos\MShop::create($context, 'product');
        $propManager = \Aimeos\MShop::create($context, 'product/property');

        $search = $productManager->filter();
        $search->slice(0, 100000);
        $total = 0;
        $count = 0;

        foreach ($productManager->search($search) as $item) {
            $total++;
            $pid = $item->getId();

            $ps = $propManager->filter();
            $ps->setConditions($ps->and([
                $ps->compare('==', 'product.property.parentid', $pid),
                $ps->compare('==', 'product.property.type', 'store_id'),
            ]));
            $has = false;
            foreach ($propManager->search($ps) as $op) {
                $has = true;
                break;
            }
            if ($has) {
                continue;
            }

            $prop = $propManager->create();
            $prop->setParentId($pid);
            $prop->setType('store_id');
            $prop->setValue((string) $storeId);
            $prop->setLanguageId(null);
            $propManager->save($prop);
            $count++;
        }

        $this->info("Scanned {$total} products, assigned store_id to {$count}.");

        if ($this->option('attach-users')) {
            $store = Store::find($storeId);
            if ($store) {
                $users = \App\Models\User::whereNull('store_id')->orWhere('store_id', 0)->get();
                $u = 0;
                foreach ($users as $user) {
                    $user->store_id = $store->id;
                    $user->save();
                    $u++;
                }
                $this->info("Attached store {$storeId} to {$u} user(s) without a store.");
            }
        }

        return Command::SUCCESS;
    }
}
