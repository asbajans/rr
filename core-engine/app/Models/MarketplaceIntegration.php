<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MarketplaceIntegration extends Model
{
    protected $fillable = [
        'store_id',
        'marketplace',
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

    public static function availableMarketplaces(): array
    {
        return [
            'trendyol' => [
                'label' => 'Trendyol',
                'fields' => ['api_key' => 'API Key', 'api_secret' => 'API Secret', 'supplier_id' => 'Satıcı ID'],
            ],
            'hepsiburada' => [
                'label' => 'Hepsiburada',
                'fields' => ['username' => 'Kullanıcı Adı', 'password' => 'Şifre'],
            ],
        ];
    }
}
