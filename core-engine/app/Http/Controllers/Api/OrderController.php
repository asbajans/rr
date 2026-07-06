<?php

namespace App\Http\Controllers\Api;

use App\Events\OrderReceived;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class OrderController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'externalId' => 'required|string',
            'marketplace' => 'required|string',
            'status' => 'required|string',
            'customer' => 'required|array',
            'customer.name' => 'required|string',
            'customer.email' => 'required|email',
            'items' => 'required|array',
            'items.*.sku' => 'required|string',
            'items.*.name' => 'required|string',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unitPrice' => 'required|numeric|min:0',
            'totals' => 'required|array',
            'totals.grandTotal' => 'required|numeric|min:0',
            'createdAt' => 'required|date',
        ]);

        OrderReceived::dispatch($validated);

        return response()->json([
            'received' => true,
            'externalId' => $validated['externalId'],
            'marketplace' => $validated['marketplace'],
        ], 201);
    }
}
