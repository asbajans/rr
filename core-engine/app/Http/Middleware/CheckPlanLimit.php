<?php

namespace App\Http\Middleware;

use Aimeos\MShop;
use Closure;
use Illuminate\Http\Request;

class CheckPlanLimit
{
    public function handle(Request $request, Closure $next, string $resource = 'product')
    {
        $user = $request->user();
        $store = $user?->store;

        if (!$store) {
            return $next($request);
        }

        $plan = $store->plan;
        if (!$plan) {
            return $next($request);
        }

        if ($resource === 'product') {
            $context = app('aimeos.context')->get();
            $manager = MShop::create($context, 'product');
            $filter = $manager->filter();
            $count = $manager->search($filter)->count();

            if ($plan->product_limit >= 0 && $count >= $plan->product_limit) {
                return response()->json([
                    'error' => 'Product limit reached. Upgrade your plan to add more products.',
                    'limit' => $plan->product_limit,
                    'current' => $count,
                ], 403);
            }
        }

        return $next($request);
    }
}
