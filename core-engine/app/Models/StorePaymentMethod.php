<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StorePaymentMethod extends Model
{
    protected $table = 'store_payment_methods';

    protected $fillable = [
        'store_id',
        'method',
        'is_active',
        'config',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function setConfigAttribute($value)
    {
        $this->attributes['config'] = is_array($value) || is_object($value)
            ? json_encode($value)
            : ($value ?? '{}');
    }

    public function getConfigAttribute($value)
    {
        if (is_array($value)) {
            return $value;
        }
        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            return is_array($decoded) ? $decoded : [];
        }
        return [];
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public static function availableMethods(): array
    {
        return [
            'stripe' => 'Stripe',
            'bank_transfer' => 'Banka Havalesi',
            'crypto' => 'Kripto (USDT TRC20)',
            'iyzico' => 'iyzico',
            'paytr' => 'PayTR',
        ];
    }
}
