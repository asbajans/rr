<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyInternalKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $key = $request->header('X-Internal-Key')
            ?? $request->bearerToken();

        $expected = (string) env('RAHAT_INTERNAL_KEY');

        if (!$key || $expected === '' || !hash_equals($expected, (string) $key)) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        return $next($request);
    }
}
