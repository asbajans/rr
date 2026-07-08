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
            'config' => 'array',
        ];
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
