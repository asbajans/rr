<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyInternalKey
{
    public function handle(Request $request, Closure $next): Response
    {
        error_log('VIR reached method=' . $request->method() . ' uri=' . $request->getRequestUri());
        $key = $request->header('X-Internal-Key')
            ?? $request->bearerToken();

        $expected = getenv('RAHAT_INTERNAL_KEY');
        if ($expected === false || $expected === '') {
            $expected = (string) env('RAHAT_INTERNAL_KEY');
        }

        if (!$key || $expected === '' || !hash_equals($expected, (string) $key)) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        return $next($request);
    }
}
