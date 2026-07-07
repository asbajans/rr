<?php

namespace App\Http\Controllers\Api\Admin;

use Illuminate\Routing\Controller;

class DashboardController extends Controller
{
    public function index()
    {
        $user = request()->user();

        return response()->json([
            'user' => $user->only(['id', 'name', 'email', 'ai_credits', 'store_id']),
            'store' => $user->store?->only(['id', 'name', 'site_code', 'domain', 'is_active']),
            'stats' => [
                'total_products' => 0,
                'total_orders' => 0,
                'ai_credits' => $user->ai_credits,
            ],
        ]);
    }
}
