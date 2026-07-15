<?php

namespace App\Http\Controllers\Api\Admin;

use Aimeos\MShop;
use App\Models\DropshippingOrder;
use App\Models\MarketplaceIntegration;
use App\Models\OrderStatusHistory;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Http;

class OrderController extends Controller
{
    private function context(): \Aimeos\MShop\ContextIface
    {
        return app('aimeos.context')->get();
    }

    /** Push a status/tracking update back to the source marketplace via integration-service. */
    private function pushToMarketplace(DropshippingOrder $order, string $endpoint, array $payload): void
    {
        try {
            $base = rtrim(env('INTEGRATION_SERVICE_URL', 'http://rahatio-integration:3001'), '/');
            if (!$base) {
                return;
            }
            Http::withHeaders([
                'X-Internal-Key' => env('RAHAT_INTERNAL_KEY', ''),
                'Content-Type' => 'application/json',
            ])->timeout(10)->post($base . $endpoint, $payload);
        } catch (\Exception $e) {
            logger()->warning("Marketplace push {$endpoint} failed for order {$order->id}: {$e->getMessage()}");
        }
    }

    private function marketplaceConfig(DropshippingOrder $order): ?array
    {
        $integration = MarketplaceIntegration::where('store_id', $order->vendor_id)
            ->where('marketplace', $order->marketplace)
            ->first();

        return $integration?->config;
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

    public function dropshippingOrders(Request $request)
    {
        $store = $request->user()->store;
        if (!$store) {
            return response()->json(['error' => 'No store assigned'], 403);
        }

        $query = DropshippingOrder::where('vendor_id', $store->id);

        if ($request->status) {
            $query->where('status', $request->status);
        }

        $orders = $query->orderByDesc('created_at')
            ->paginate($request->per_page ?? 20);

        return response()->json($orders);
    }

    public function showDropshipping(Request $request, DropshippingOrder $order)
    {
        $store = $request->user()->store;
        if (!$store || $order->vendor_id !== $store->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $order->load('statusHistory.user');
        return response()->json($order);
    }

    public function updateStatus(Request $request, DropshippingOrder $order)
    {
        $store = $request->user()->store;
        if (!$store || $order->vendor_id !== $store->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'status' => 'required|string|in:' . implode(',', DropshippingOrder::STATUSES),
            'note' => 'nullable|string|max:1000',
        ]);

        $success = $order->transitionTo(
            $validated['status'],
            $validated['note'] ?? null,
            $request->user()->id
        );

        if (!$success) {
            return response()->json([
                'error' => "Cannot transition from '{$order->status}' to '{$validated['status']}'",
                'allowed' => DropshippingOrder::STATUS_FLOW[$order->status] ?? [],
            ], 422);
        }

        if ($config = $this->marketplaceConfig($order)) {
            $this->pushToMarketplace($order, '/orders/status', [
                'marketplace' => $order->marketplace,
                'config' => $config,
                'externalId' => $order->external_id,
                'status' => $validated['status'],
            ]);
        }

        return response()->json($order->fresh()->load('statusHistory.user'));
    }

    public function updateTracking(Request $request, DropshippingOrder $order)
    {
        $store = $request->user()->store;
        if (!$store || $order->vendor_id !== $store->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'tracking_number' => 'required|string|max:255',
            'tracking_company' => 'sometimes|string|max:255',
        ]);

        $order->update($validated);

        if ($config = $this->marketplaceConfig($order)) {
            $this->pushToMarketplace($order, '/orders/tracking', [
                'marketplace' => $order->marketplace,
                'config' => $config,
                'externalId' => $order->external_id,
                'trackingNumber' => $validated['tracking_number'],
                'trackingCompany' => $validated['tracking_company'] ?? null,
            ]);
        }

        return response()->json($order);
    }

    public function statusHistory(Request $request, DropshippingOrder $order)
    {
        $store = $request->user()->store;
        if (!$store || $order->vendor_id !== $store->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        return response()->json([
            'data' => $order->statusHistory()->with('user')->orderByDesc('created_at')->get(),
        ]);
    }

    public function stats(Request $request)
    {
        $store = $request->user()->store;
        if (!$store) {
            return response()->json(['error' => 'No store assigned'], 403);
        }

        $stats = collect(DropshippingOrder::STATUSES)->map(function ($status) use ($store) {
            return [
                'status' => $status,
                'label' => DropshippingOrder::statusLabel($status),
                'color' => DropshippingOrder::statusColor($status),
                'count' => DropshippingOrder::where('vendor_id', $store->id)
                    ->where('status', $status)
                    ->count(),
            ];
        });

        return response()->json(['data' => $stats]);
    }

    public function destroy(Request $request, DropshippingOrder $order)
    {
        $store = $request->user()->store;
        if (!$store || $order->vendor_id !== $store->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $order->delete();

        return response()->json(['deleted' => true, 'id' => $order->id]);
    }
}
