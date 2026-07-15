<?php

namespace App\Events;

use Aimeos\MShop\Product\Item\Iface;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;

class ProductUpdated
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public Iface $product,
        public ?int $storeId = null
    ) {}
}
