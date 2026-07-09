<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShippingSetting extends Model
{
    protected $fillable = [
        'store_id', 'method', 'flat_rate', 'free_shipping_threshold', 'zones', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'flat_rate' => 'decimal:2',
            'free_shipping_threshold' => 'decimal:2',
            'zones' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }
}