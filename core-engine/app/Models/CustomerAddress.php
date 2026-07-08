<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerAddress extends Model
{
    protected $fillable = [
        'store_id',
        'user_id',
        'full_name',
        'phone',
        'country',
        'city',
        'district',
        'zip',
        'address_line',
        'is_default',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
        ];
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function scopeForUser($query, string $userId)
    {
        return $query->where('user_id', $userId);
    }
}
