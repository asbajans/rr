<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\StorePaymentMethod;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;

class PaymentMethodController extends Controller
{
    private function getStore(Request $request): \App\Models\Store
    {
        $store = $request->user()->store;
        if (!$store) throw ValidationException::withMessages(['store' => 'No store assigned']);
        return $store;
    }

    public function index(Request $request)
    {
        $store = $this->getStore($request);
        $methods = StorePaymentMethod::where('store_id', $store->id)->get();
        $available = StorePaymentMethod::availableMethods();
        $result = [];

        foreach ($available as $key => $label) {
            $existing = $methods->firstWhere('method', $key);
            $result[] = [
                'method' => $key,
                'label' => $label,
                'is_active' => $existing?->is_active ?? false,
                'config' => $existing?->config ?? $this->defaultConfig($key),
                'id' => $existing?->id ?? null,
            ];
        }

        return response()->json(['data' => $result]);
    }

    public function update(Request $request, string $method)
    {
        $store = $this->getStore($request);

        $validated = $request->validate([
            'is_active' => 'required|boolean',
            'config' => 'nullable|array',
        ]);

        if (!array_key_exists($method, StorePaymentMethod::availableMethods())) {
            return response()->json(['error' => 'Invalid payment method'], 422);
        }

        $paymentMethod = StorePaymentMethod::updateOrCreate(
            ['store_id' => $store->id, 'method' => $method],
            [
                'is_active' => $validated['is_active'],
                'config' => $validated['config'] ?? $this->defaultConfig($method),
            ]
        );

        return response()->json($paymentMethod);
    }

    public function show(Request $request, string $method)
    {
        $store = $this->getStore($request);

        if (!array_key_exists($method, StorePaymentMethod::availableMethods())) {
            return response()->json(['error' => 'Invalid payment method'], 422);
        }

        $paymentMethod = StorePaymentMethod::where('store_id', $store->id)
            ->where('method', $method)
            ->first();

        if (!$paymentMethod) {
            return response()->json([
                'method' => $method,
                'is_active' => false,
                'config' => $this->defaultConfig($method),
            ]);
        }

        return response()->json($paymentMethod);
    }

    public function checkoutMethods(Request $request, string $siteCode)
    {
        $store = \App\Models\Store::where('site_code', $siteCode)->first();
        if (!$store) {
            return response()->json(['error' => 'Store not found'], 404);
        }

        $methods = StorePaymentMethod::where('store_id', $store->id)
            ->where('is_active', true)
            ->get()
            ->map(function ($m) {
                $label = StorePaymentMethod::availableMethods()[$m->method] ?? $m->method;
                $public = $m->method === 'strike' ? ['publishable_key' => $m->config['publishable_key'] ?? null] : [];
                return [
                    'method' => $m->method,
                    'label' => $label,
                    'public' => $public,
                ];
            });

        return response()->json(['data' => $methods]);
    }

    private function defaultConfig(string $method): array
    {
        return match ($method) {
            'stripe' => ['publishable_key' => '', 'secret_key' => '', 'webhook_secret' => ''],
            'bank_transfer' => ['bank_name' => '', 'iban' => '', 'account_holder' => '', 'account_number' => ''],
            'crypto' => ['wallet_address' => '', 'network' => 'TRC20'],
            'iyzico' => ['api_key' => '', 'secret_key' => '', 'base_url' => 'https://api.iyzipay.com'],
            'paytr' => ['merchant_id' => '', 'merchant_key' => '', 'merchant_salt' => ''],
            default => [],
        };
    }
}
