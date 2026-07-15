<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustHosts as Middleware;

class TrustHosts extends Middleware
{
    public function handle($request, $next)
    {
        error_log('TrustHosts method=' . $request->method() . ' host=' . $request->getHost() . ' trusted=' . json_encode($this->hosts()));
        return parent::handle($request, $next);
    }

    public function hosts(): array
    {
        return [
            $this->allSubdomainsOfApplicationUrl(),
            'rahatio.com.tr',
            'www.rahatio.com.tr',
            'app.rahatio.com.tr',
            'api.rahatio.com.tr',
            // Internal Docker service hostnames (service-to-service calls)
            'rahatio-core',
            'rahatio-ai',
            'rahatio-integration',
            'rahatio-frontend',
        ];
    }
}
