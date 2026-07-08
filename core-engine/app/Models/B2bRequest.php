<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class B2bRequest extends Model
{
    protected $table = 'b2b_requests';

    protected $fillable = [
        'from_store_id',
        'to_store_id',
        'product_id',
        'status',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'status' => 'string',
        ];
    }

    public function fromStore()
    {
        return $this->belongsTo(Store::class, 'from_store_id');
    }

    public function toStore()
    {
        return $this->belongsTo(Store::class, 'to_store_id');
    }
}
