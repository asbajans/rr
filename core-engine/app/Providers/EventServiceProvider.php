<?php

namespace App\Providers;

use App\Events\ProductUpdated;
use App\Listeners\SendProductWebhook;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        ProductUpdated::class => [
            SendProductWebhook::class,
        ],
    ];

    public function boot(): void
    {
        //
    }
}
