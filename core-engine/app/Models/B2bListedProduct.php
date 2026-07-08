<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class B2bListedProduct extends Model
{
    protected $table = 'b2b_listed_products';

    protected $fillable = [
        'store_id',
        'original_store_id',
        'product_id',
        'original_product_id',
        'b2b_request_id',
    ];

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function originalStore()
    {
        return $this->belongsTo(Store::class, 'original_store_id');
    }

    public function request()
    {
        return $this->belongsTo(B2bRequest::class, 'b2b_request_id');
    }
}
