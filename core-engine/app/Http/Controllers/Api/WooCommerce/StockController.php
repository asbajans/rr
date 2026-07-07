<?php

namespace App\Http\Controllers\Api\WooCommerce;

use Aimeos\MShop;
use App\Events\ProductUpdated;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class StockController extends Controller
{
    private function context(): \Aimeos\MShop\ContextIface
    {
        return app('aimeos.context')->get();
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'stocks' => 'required|array',
            'stocks.*.sku' => 'required|string',
            'stocks.*.quantity' => 'required|integer|min:0',
        ]);

        $context = $this->context();
        $manager = \Aimeos\MShop::create($context, 'product');
        $results = [];

        foreach ($validated['stocks'] as $data) {
            try {
                $item = $manager->find($data['sku']);
            } catch (\Aimeos\MShop\Exception $e) {
                continue;
            }

            $item->setPropertyValue('stock', (int) $data['quantity'], 'stock');
            $manager->save($item);

            ProductUpdated::dispatch($item);
            $results[] = $data['sku'];
        }

        return response()->json(['updated' => $results]);
    }

    public function show(Request $request, string $sku)
    {
        try {
            $context = $this->context();
            $manager = \Aimeos\MShop::create($context, 'product');
            $item = $manager->find($sku);
        } catch (\Aimeos\MShop\Exception $e) {
            return response()->json(['error' => 'Product not found'], 404);
        }

        return response()->json([
            'sku' => $item->getCode(),
            'stock' => (int) $item->getPropertyValue('stock', 'stock'),
        ]);
    }
}
