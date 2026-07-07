<?php

namespace App\Http\Middleware;

use App\Models\Store;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveStoreFromDomain
{
    public function handle(Request $request, Closure $next): Response
    {
        $host = $request->getHost();

        // Platform domain'lerini pas geç (rahatio.com.tr ve alt domainleri)
        $platformDomains = ['rahatio.com.tr', 'www.rahatio.com.tr', 'app.rahatio.com.tr', 'api.rahatio.com.tr'];
        if (in_array($host, $platformDomains)) {
            return $next($request);
        }

        $store = Store::where('domain', $host)
            ->where('is_active', true)
            ->first();

        if (!$store) {
            return response()->json(['error' => 'No store found for this domain'], 404);
        }

        $request->merge(['site_code' => $store->site_code]);
        $request->attributes->set('store', $store);

        putenv('AIMEOS_SITE_CODE=' . $store->site_code);

        return $next($request);
    }
}
