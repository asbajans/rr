<?php

namespace App\Http\Controllers\Api;

use App\Models\CustomerAddress;
use App\Models\Store;
use App\Models\StorePaymentMethod;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class CheckoutController extends Controller
{
    private function getStore(string $siteCode): Store
    {
        $store = Store::where('site_code', $siteCode)->first();
        if (!$store) abort(404, 'Store not found');
        return $store;
    }

    public function addresses(Request $request, string $siteCode)
    {
        $store = $this->getStore($siteCode);
        $userId = $request->input('user_id', $request->cookie('guest_id', session()->getId()));

        $addresses = CustomerAddress::forUser($userId)
            ->where('store_id', $store->id)
            ->orderByDesc('is_default')
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $addresses]);
    }

    public function storeAddress(Request $request, string $siteCode)
    {
        $store = $this->getStore($siteCode);

        $validated = $request->validate([
            'full_name' => 'required|string|max:255',
            'phone' => 'required|string|max:20',
            'country' => 'sometimes|string|max:100',
            'city' => 'required|string|max:100',
            'district' => 'nullable|string|max:100',
            'zip' => 'nullable|string|max:20',
            'address_line' => 'required|string|max:1000',
            'is_default' => 'boolean',
            'user_id' => 'nullable|string',
        ]);

        $userId = $validated['user_id']
            ?? $request->cookie('guest_id')
            ?? session()->getId();

        $address = CustomerAddress::create([
            'store_id' => $store->id,
            'user_id' => $userId,
            'full_name' => $validated['full_name'],
            'phone' => $validated['phone'],
            'country' => $validated['country'] ?? 'Türkiye',
            'city' => $validated['city'],
            'district' => $validated['district'] ?? null,
            'zip' => $validated['zip'] ?? null,
            'address_line' => $validated['address_line'],
            'is_default' => $validated['is_default'] ?? false,
        ]);

        if ($address->is_default) {
            CustomerAddress::where('store_id', $store->id)
                ->where('user_id', $userId)
                ->where('id', '!=', $address->id)
                ->update(['is_default' => false]);
        }

        return response()->json($address, 201);
    }

    public function deleteAddress(Request $request, string $siteCode, CustomerAddress $address)
    {
        $store = $this->getStore($siteCode);
        if ($address->store_id !== $store->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }
        $address->delete();
        return response()->json(['message' => 'Address deleted']);
    }

    public function checkout(Request $request, string $siteCode)
    {
        $store = $this->getStore($siteCode);

        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|string',
            'items.*.sku' => 'required|string',
            'items.*.name' => 'required|string',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'customer' => 'required|array',
            'customer.name' => 'required|string|max:255',
            'customer.email' => 'required|email|max:255',
            'customer.phone' => 'required|string|max:20',
            'address_id' => 'nullable|exists:customer_addresses,id',
            'shipping' => 'nullable|array',
            'shipping.full_name' => 'required_without:address_id|string|max:255',
            'shipping.phone' => 'required_without:address_id|string|max:20',
            'shipping.city' => 'required_without:address_id|string|max:100',
            'shipping.address_line' => 'required_without:address_id|string|max:1000',
            'payment_method' => 'required|string',
            'note' => 'nullable|string|max:1000',
        ]);

        if (!empty($validated['address_id'])) {
            $address = CustomerAddress::findOrFail($validated['address_id']);
            $shipping = $address->toArray();
        } else {
            $shipping = $validated['shipping'];
        }

        try {
            $context = \Aimeos\Context::get();
            $localeManager = \Aimeos\MShop::create($context, 'locale');
            $localeItem = $localeManager->bootstrap($store->site_code ?? 'default', '', '', false);

            $context->setLocale($localeItem);
            $orderManager = \Aimeos\MShop::create($context, 'order');

            $orderBaseManager = \Aimeos\MShop::create($context, 'order/base');
            $orderBaseItem = $orderBaseManager->create();
            $orderBaseItem->setCustomerId($validated['customer']['email']);
            $orderBaseItem->setComment($validated['note'] ?? '');

            $priceManager = \Aimeos\MShop::create($context, 'price');
            $productManager = \Aimeos\MShop::create($context, 'product');

            $total = 0;

            foreach ($validated['items'] as $item) {
                $productItem = $productManager->find($item['sku']);
                if (!$productItem) {
                    continue;
                }

                $priceItem = $priceManager->create();
                $priceItem->setValue($item['unit_price']);
                $priceItem->setCosts(0);
                $priceItem->setTaxRate(20);
                $priceItem->setCurrencyId($context->currency() ?? 'TRY');

                $orderBaseProduct = $orderBaseManager->createProduct();
                $orderBaseProduct->copyFrom($productItem);
                $orderBaseProduct->setQuantity($item['quantity']);
                $orderBaseProduct->setPrice($priceItem);

                $orderBaseItem->addProduct($orderBaseProduct);
                $total += $item['unit_price'] * $item['quantity'];
            }

            $totalPrice = $priceManager->create();
            $totalPrice->setValue($total);
            $totalPrice->setCosts(0);
            $totalPrice->setTaxRate(20);
            $totalPrice->setCurrencyId($context->currency() ?? 'TRY');
            $orderBaseItem->setPrice($totalPrice);

            $orderBaseItem = $orderBaseManager->save($orderBaseItem);

            $orderItem = $orderManager->create();
            $orderItem->setBaseId($orderBaseItem->getId());
            $orderItem->setType(\Aimeos\MShop\Order\Item\Iface::TYPE_WEB);
            $orderItem->setStatus(0);
            $orderItem->setPaymentStatus(0);
            $orderItem->setDeliveryStatus(0);

            $orderItem = $orderManager->save($orderItem);

            return response()->json([
                'success' => true,
                'order_id' => $orderItem->getId(),
                'order_base_id' => $orderBaseItem->getId(),
                'total' => $total,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function paymentMethods(Request $request, string $siteCode)
    {
        $store = $this->getStore($siteCode);

        $methods = StorePaymentMethod::where('store_id', $store->id)
            ->where('is_active', true)
            ->get()
            ->map(fn($m) => [
                'method' => $m->method,
                'label' => StorePaymentMethod::availableMethods()[$m->method] ?? $m->method,
            ]);

        return response()->json(['data' => $methods]);
    }
}
