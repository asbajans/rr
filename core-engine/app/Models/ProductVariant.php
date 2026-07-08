<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductVariant extends Model
{
    protected $fillable = [
        'store_id', 'product_id', 'sku', 'price', 'currency',
        'stock', 'attributes', 'image', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'attributes' => 'array',
            'is_active' => 'boolean',
            'price' => 'decimal:2',
            'stock' => 'integer',
        ];
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }
}
