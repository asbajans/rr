<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductB2bSetting extends Model
{
    protected $table = 'product_b2b_settings';

    protected $fillable = [
        'store_id',
        'product_id',
        'is_b2b_enabled',
        'b2b_discount',
        'b2b_price',
    ];

    protected function casts(): array
    {
        return [
            'is_b2b_enabled' => 'boolean',
            'b2b_discount' => 'decimal:2',
            'b2b_price' => 'decimal:2',
        ];
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }
}
