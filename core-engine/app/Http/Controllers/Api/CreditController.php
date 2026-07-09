<?php

namespace App\Http\Controllers\Api;

use App\Models\CreditLog;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class CreditController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        return CreditLog::where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->limit(100)
            ->get();
    }

    public function stats(Request $request)
    {
        $user = $request->user();

        return [
            'current_credits' => $user->ai_credits,
            'total_consumed' => $user->total_credits_consumed,
            'total_granted' => CreditLog::where('user_id', $user->id)
                ->where('action', 'grant')
                ->sum('amount'),
        ];
    }
}