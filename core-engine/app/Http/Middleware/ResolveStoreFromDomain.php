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

        $store = Store::where('domain', $host)
            ->where('is_active', true)
            ->first();

        if (!$store) {
            abort(404, 'No store found for this domain');
        }

        $request->merge(['site_code' => $store->site_code]);
        $request->attributes->set('store', $store);

        putenv('AIMEOS_SITE_CODE=' . $store->site_code);

        return $next($request);
    }
}
