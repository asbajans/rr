<?php

namespace App\Http\Controllers\Api\Admin;

use Aimeos\MShop;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class OrderController extends Controller
{
    private function context(): \Aimeos\MShop\ContextIface
    {
        return app('aimeos.context')->get();
    }

    public function index(Request $request)
    {
        $context = $this->context();
        $manager = MShop::create($context, 'order');

        $search = $manager->filter();
        $search->setSortations([$search->sort('-', 'order.id')]);
        $search->slice(0, 50);

        $total = 0;
        $items = $manager->search($search, [], $total);

        return response()->json([
            'data' => array_values($items->toArray()),
            'total' => $total,
        ]);
    }

    public function show(Request $request, string $id)
    {
        try {
            $context = $this->context();
            $manager = MShop::create($context, 'order');
            $item = $manager->get($id);
        } catch (\Aimeos\MShop\Exception $e) {
            return response()->json(['error' => 'Order not found'], 404);
        }

        return response()->json($item->toArray());
    }
}
