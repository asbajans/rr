<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustHosts as Middleware;

class TrustHosts extends Middleware
{
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
