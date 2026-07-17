<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Assign all existing Aimeos products to the default store via store_id property.
        // This backfills tenant isolation for products created before the fix.
        $defaultStoreId = DB::table('stores')->where('site_code', 'default')->value('id') ?: 2;

        $products = DB::table('mshop_product as p')
            ->leftJoin('mshop_product_property as pp', function ($join) {
                $join->on('pp.parentid', '=', 'p.id')
                    ->where('pp.type', '=', 'store_id');
            })
            ->whereNull('pp.parentid')
            ->select('p.id', 'p.siteid')
            ->get();

        $rows = [];
        $now = now();
        foreach ($products as $p) {
            $rows[] = [
                'parentid' => $p->id,
                'siteid' => $p->siteid ?: 'default',
                'type' => 'store_id',
                'langid' => null,
                'value' => (string) $defaultStoreId,
                'ctime' => $now,
                'mtime' => $now,
                'editor' => 'backfill',
            ];
        }

        if (!empty($rows)) {
            DB::table('mshop_product_property')->insert($rows);
        }
    }

    public function down(): void
    {
        DB::table('mshop_product_property')->where('type', 'store_id')->where('editor', 'backfill')->delete();
    }
};
