<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderStatusHistory extends Model
{
    protected $fillable = [
        'dropshipping_order_id',
        'from_status',
        'to_status',
        'note',
        'user_id',
    ];

    public function order()
    {
        return $this->belongsTo(DropshippingOrder::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
