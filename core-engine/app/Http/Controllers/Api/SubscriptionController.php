<?php

namespace App\Http\Controllers\Api;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Stripe\StripeClient;
use Stripe\Webhook;

class SubscriptionController extends Controller
{
    private function stripe(): StripeClient
    {
        $secret = config('services.stripe.secret');
        if (empty($secret)) {
            abort(400, 'Stripe yapılandırması eksik. Lütfen STRIPE_SECRET ortam değişkenini ayarlayın.');
        }
        return new StripeClient($secret);
    }

    public function index(Request $request)
    {
        $store = $request->user()->store;
        if (!$store) {
            return response()->json(['subscription' => null, 'plan' => null]);
        }

        $subscription = $store->subscription;

        return response()->json([
            'subscription' => $subscription,
            'plan' => $store->plan,
        ]);
    }

    public function checkout(Request $request)
    {
        $request->validate([
            'plan_id' => 'required|exists:plans,id',
        ]);

        $store = $request->user()->store;
        if (!$store) {
            return response()->json(['error' => 'No store assigned.'], 400);
        }

        $plan = Plan::findOrFail($request->plan_id);
        if ($plan->price <= 0) {
            $store->update(['plan_id' => $plan->id]);
            Subscription::updateOrCreate(
                ['store_id' => $store->id],
                [
                    'plan_id' => $plan->id,
                    'status' => 'active',
                    'payment_method' => 'free',
                ]
            );
            return response()->json(['message' => 'Free plan activated.']);
        }

        $stripe = $this->stripe();
        $session = $stripe->checkout->sessions->create([
            'mode' => 'subscription',
            'payment_method_types' => ['card'],
            'line_items' => [[
                'price_data' => [
                    'currency' => 'try',
                    'product_data' => ['name' => $plan->name],
                    'recurring' => ['interval' => 'month'],
                    'unit_amount' => (int) ($plan->price * 100),
                ],
                'quantity' => 1,
            ]],
            'metadata' => [
                'store_id' => (string) $store->id,
                'plan_id' => (string) $plan->id,
            ],
            'success_url' => $request->input('success_url', env('APP_FRONTEND_URL', 'https://rahatio.com.tr') . '/dashboard/billing?success=1'),
            'cancel_url' => $request->input('cancel_url', env('APP_FRONTEND_URL', 'https://rahatio.com.tr') . '/dashboard/billing?canceled=1'),
        ]);

        return response()->json(['url' => $session->url]);
    }

    public function portal(Request $request)
    {
        $store = $request->user()->store;
        if (!$store) {
            return response()->json(['error' => 'No store assigned.'], 400);
        }

        $subscription = $store->subscription;
        if (!$subscription || !$subscription->stripe_id) {
            return response()->json(['error' => 'No active Stripe subscription.'], 400);
        }

        $stripe = $this->stripe();
        $session = $stripe->billingPortal->sessions->create([
            'customer' => $subscription->stripe_id,
            'return_url' => $request->input('return_url', env('APP_FRONTEND_URL', 'https://rahatio.com.tr') . '/dashboard/billing'),
        ]);

        return response()->json(['url' => $session->url]);
    }

    public function assignPlan(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->is_admin) {
            return response()->json(['error' => 'Yetkisiz. Yalnızca süper admin paket atayabilir.'], 403);
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'plan_id' => 'required|exists:plans,id',
        ]);

        $target = User::findOrFail($validated['user_id']);
        $store = $target->store;
        if (!$store) {
            return response()->json(['error' => 'Kullanıcının mağazası yok.'], 400);
        }

        $plan = Plan::findOrFail($validated['plan_id']);

        $store->update(['plan_id' => $plan->id]);
        $subscription = Subscription::updateOrCreate(
            ['store_id' => $store->id],
            [
                'plan_id' => $plan->id,
                'status' => 'active',
                'payment_method' => 'admin_assigned',
                'renews_at' => now()->addMonth(),
                'ends_at' => null,
            ]
        );

        return response()->json([
            'message' => "{$target->name} kullanıcısına '{$plan->name}' paketi (ücretsiz) atandı.",
            'subscription' => $subscription->load('plan'),
        ]);
    }

    public function cancel(Request $request)
    {
        $store = $request->user()->store;
        if (!$store) {
            return response()->json(['error' => 'No store assigned.'], 400);
        }

        $subscription = $store->subscription;
        if (!$subscription) {
            return response()->json(['error' => 'No active subscription.'], 400);
        }

        if ($subscription->payment_method !== 'free') {
            $stripe = $this->stripe();
            $stripe->subscriptions->cancel($subscription->stripe_id);
        }

        $subscription->update([
            'status' => 'canceled',
            'ends_at' => now(),
        ]);

        return response()->json(['message' => 'Subscription canceled.']);
    }

    // Credit purchase: e.g. 50 credits = ₺50, 200 credits = ₺150, 500 credits = ₺300
    public function purchaseCredits(Request $request)
    {
        $request->validate([
            'credits' => 'required|integer|in:50,200,500',
            'success_url' => 'nullable|string',
            'cancel_url' => 'nullable|string',
        ]);

        $user = $request->user();
        $credits = (int) $request->credits;

        $priceMap = [50 => 50, 200 => 150, 500 => 300];
        $amount = $priceMap[$credits] ?? 50;
        $amountCents = $amount * 100;

        $stripe = $this->stripe();
        $session = $stripe->checkout->sessions->create([
            'mode' => 'payment',
            'payment_method_types' => ['card'],
            'line_items' => [[
                'price_data' => [
                    'currency' => 'try',
                    'product_data' => ['name' => "$credits AI Kredisi"],
                    'unit_amount' => $amountCents,
                ],
                'quantity' => 1,
            ]],
            'metadata' => [
                'user_id' => (string) $user->id,
                'credits' => (string) $credits,
                'type' => 'credit_purchase',
            ],
            'success_url' => $request->input('success_url', env('APP_FRONTEND_URL', 'https://rahatio.com.tr') . '/dashboard/credits?success=1'),
            'cancel_url' => $request->input('cancel_url', env('APP_FRONTEND_URL', 'https://rahatio.com.tr') . '/dashboard/credits?canceled=1'),
        ]);

        return response()->json(['url' => $session->url]);
    }

    public function webhook(Request $request)
    {
        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');
        $endpointSecret = config('services.stripe.webhook_secret');

        if ($endpointSecret) {
            try {
                Webhook::constructEvent($payload, $sigHeader, $endpointSecret);
            } catch (\Exception $e) {
                return response()->json(['error' => 'Invalid signature.'], 400);
            }
        }

        $event = json_decode($payload);
        $session = $event->data->object ?? null;

        if (!$session) {
            return response()->json(['error' => 'Invalid event.'], 400);
        }

        $storeId = $session->metadata->store_id ?? null;
        $planId = $session->metadata->plan_id ?? null;

        switch ($event->type) {
            case 'checkout.session.completed':
                if ($session->metadata->type === 'credit_purchase') {
                    $userId = $session->metadata->user_id ?? null;
                    $credits = (int) ($session->metadata->credits ?? 0);
                    if ($userId && $credits > 0) {
                        $user = User::find($userId);
                        if ($user) {
                            $user->grantAiCredits($credits, 'Stripe ile satın alma');
                        }
                    }
                } elseif ($storeId && $planId) {
                    $store = \App\Models\Store::find($storeId);
                    if ($store) {
                        $store->update(['plan_id' => $planId]);
                        Subscription::updateOrCreate(
                            ['store_id' => $storeId],
                            [
                                'plan_id' => $planId,
                                'stripe_id' => $session->customer ?? $session->id,
                                'stripe_status' => 'active',
                                'status' => 'active',
                                'renews_at' => now()->addMonth(),
                            ]
                        );
                    }
                }
                break;

            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                $stripeSubscriptionId = $session->id;
                $subscription = Subscription::where('stripe_id', $stripeSubscriptionId)->first();
                if ($subscription) {
                    $status = match ($session->status) {
                        'active', 'trialing' => 'active',
                        'past_due' => 'past_due',
                        'canceled' => 'canceled',
                        'unpaid' => 'unpaid',
                        default => $subscription->status,
                    };
                    $subscription->update(['status' => $status]);
                }
                break;
        }

        return response()->json(['status' => 'ok']);
    }
}
