<?php

namespace App\Http\Middleware;

use App\Models\ApiKey;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateWithApiKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $key = $request->bearerToken()
            ?? $request->header('X-API-Key')
            ?? $request->query('api_key');

        if (!$key) {
            return response()->json(['error' => 'API key required'], 401);
        }

        $apiKey = ApiKey::where('key', hash('sha256', $key))
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->first();

        if (!$apiKey || !$apiKey->store->is_active) {
            return response()->json(['error' => 'Invalid or expired API key'], 401);
        }

        if ($apiKey->allowed_ips) {
            $ips = array_map('trim', explode(',', $apiKey->allowed_ips));
            if (!in_array($request->ip(), $ips, true)) {
                return response()->json(['error' => 'IP not allowed'], 403);
            }
        }

        $signature = $request->header('X-Signature');
        $timestamp = $request->header('X-Timestamp');
        if ($signature && $timestamp) {
            $internalKey = env('RAHAT_INTERNAL_KEY');
            if (!$internalKey) {
                return response()->json(['error' => 'HMAC verification not configured'], 500);
            }

            $path = ltrim($request->path(), '/');
            $payload = sprintf("%s\n%s\n%s\n%s",
                $request->method(),
                $path,
                $timestamp,
                $request->getContent()
            );

            $expected = hash_hmac('sha256', $payload, $internalKey);
            if (!hash_equals($expected, $signature)) {
                return response()->json(['error' => 'Invalid HMAC signature'], 401);
            }
        }

        $apiKey->touch('last_used_at');

        $request->merge(['site_code' => $apiKey->store->site_code]);
        $request->attributes->set('store', $apiKey->store);

        return $next($request);
    }
}
