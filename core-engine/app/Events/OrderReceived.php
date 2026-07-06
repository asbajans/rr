<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;

class OrderReceived
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public array $orderData
    ) {}
}
