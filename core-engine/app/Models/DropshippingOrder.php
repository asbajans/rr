<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DropshippingOrder extends Model
{
    protected $fillable = [
        'external_id',
        'marketplace',
        'status',
        'vendor_id',
        'customer_name',
        'customer_email',
        'customer_phone',
        'shipping_address',
        'items',
        'subtotal',
        'shipping',
        'tax',
        'grand_total',
        'currency',
        'ordered_at',
    ];

    protected function casts(): array
    {
        return [
            'items' => 'array',
            'subtotal' => 'decimal:2',
            'shipping' => 'decimal:2',
            'tax' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'ordered_at' => 'datetime',
        ];
    }

    public function vendor()
    {
        return $this->belongsTo(Store::class, 'vendor_id');
    }
}
