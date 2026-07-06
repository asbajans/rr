<?php

namespace App\Providers;

use App\Events\OrderReceived;
use App\Events\ProductUpdated;
use App\Listeners\SendProductWebhook;
use App\Listeners\SplitOrderByVendor;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        ProductUpdated::class => [
            SendProductWebhook::class,
        ],
        OrderReceived::class => [
            SplitOrderByVendor::class,
        ],
    ];

    public function boot(): void
    {
        //
    }
}
