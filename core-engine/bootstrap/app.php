<?php

use Illuminate\Foundation\Application;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__ . '/../routes/api.php',
    )
    ->withMiddleware(function ($middleware) {
        $middleware->alias([
            'auth.api-key' => \App\Http\Middleware\AuthenticateWithApiKey::class,
            'domain.store' => \App\Http\Middleware\ResolveStoreFromDomain::class,
        ]);

        $middleware->api(prepend: [
            \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
        ]);
    })
    ->withExceptions(function ($exceptions) {
        //
    })->create();
