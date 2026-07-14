<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Trusted Proxies
    |--------------------------------------------------------------------------
    |
    | Cloudflare terminates TLS at the edge and forwards requests to the origin
    | over HTTP. Without trusting the proxy, the app sees the request as HTTP
    | and issues a scheme redirect (e.g. http://api.rahatio.com.tr), which
    | breaks the browser's cross-origin auth flow (mixed-content / CORS).
    |
    | Setting this to '*' makes Laravel honor X-Forwarded-Proto / X-Forwarded-For
    | so isSecure() reflects the real HTTPS connection from Cloudflare.
    */

    'proxies' => '*',

];
