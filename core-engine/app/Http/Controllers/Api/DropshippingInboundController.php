<?php

namespace App\Http\Controllers\Api;

use App\Models\DropshippingOrder;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class DropshippingInboundController extends Controller
{
    public function upsert(Request $request)
    {
        $validated = $request->validate([
            'externalId' => 'required|string',
            'marketplace' => 'required|string',
            'vendorId' => 'required|integer|exists:stores,id',
            'status' => 'required|string',
            'customer' => 'required|array',
            'customer.name' => 'required|string',
            'customer.email' => 'required|email',
            'customer.phone' => 'nullable|string',
            'customer.address' => 'nullable|string',
            'items' => 'required|array',
            'items.*.sku' => 'required|string',
            'items.*.name' => 'required|string',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unitPrice' => 'required|numeric|min:0',
            'totals' => 'required|array',
            'totals.grandTotal' => 'required|numeric|min:0',
            'totals.subTotal' => 'nullable|numeric|min:0',
            'totals.shipping' => 'nullable|numeric|min:0',
            'totals.tax' => 'nullable|numeric|min:0',
            'createdAt' => 'required|date',
        ]);

        $status = $this->mapStatus($validated['status']);
        $items = $validated['items'];
        $subtotal = $validated['totals']['subTotal']
            ?? collect($items)->sum(fn($i) => ($i['unitPrice'] * $i['quantity']));
        $shipping = $validated['totals']['shipping'] ?? 0;
        $tax = $validated['totals']['tax'] ?? 0;
        $grand = $validated['totals']['grandTotal'];

        $order = DropshippingOrder::where('external_id', $validated['externalId'])
            ->where('marketplace', $validated['marketplace'])
            ->where('vendor_id', $validated['vendorId'])
            ->first();

        if (!$order) {
            $order = DropshippingOrder::create([
                'external_id' => $validated['externalId'],
                'marketplace' => $validated['marketplace'],
                'status' => $status,
                'vendor_id' => $validated['vendorId'],
                'customer_name' => $validated['customer']['name'],
                'customer_email' => $validated['customer']['email'],
                'customer_phone' => $validated['customer']['phone'] ?? null,
                'shipping_address' => $validated['customer']['address'] ?? null,
                'items' => $items,
                'subtotal' => $subtotal,
                'shipping' => $shipping,
                'tax' => $tax,
                'grand_total' => $grand,
                'currency' => 'TRY',
                'ordered_at' => $validated['createdAt'],
            ]);

            return response()->json(['received' => true, 'created' => true, 'id' => $order->id], 201);
        }

        // Keep store-side status progression; only override on terminal marketplace
        // states or when the local order is still untouched (pending).
        $applyStatus = in_array($status, ['delivered', 'cancelled', 'returned']) || $order->status === 'pending';

        $order->update([
            'customer_name' => $validated['customer']['name'],
            'customer_email' => $validated['customer']['email'],
            'customer_phone' => $validated['customer']['phone'] ?? null,
            'shipping_address' => $validated['customer']['address'] ?? null,
            'items' => $items,
            'subtotal' => $subtotal,
            'shipping' => $shipping,
            'tax' => $tax,
            'grand_total' => $grand,
            'ordered_at' => $validated['createdAt'],
            ...($applyStatus ? ['status' => $status] : []),
        ]);

        return response()->json(['received' => true, 'created' => false, 'id' => $order->id], 200);
    }

    private function mapStatus(string $raw): string
    {
        $map = [
            'created' => 'pending',
            'unpaid' => 'pending',
            'new' => 'pending',
            'accepted' => 'processing',
            'approved' => 'processing',
            'picking' => 'processing',
            'invoiced' => 'processing',
            'paid' => 'processing',
            'shipped' => 'shipped',
            'delivered' => 'delivered',
            'cancelled' => 'cancelled',
            'rejected' => 'cancelled',
            'returned' => 'returned',
        ];

        return $map[strtolower(trim($raw))] ?? 'pending';
    }
}
