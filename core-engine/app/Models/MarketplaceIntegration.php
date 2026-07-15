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
                'fields' => ['username' => 'API Kullanıcı Adı', 'password' => 'API Şifre', 'merchant_id' => 'Satıcı ID (Merchant ID)'],
            ],
            'pazarama' => [
                'label' => 'Pazarama',
                'fields' => ['client_id' => 'Client ID', 'client_secret' => 'Client Secret', 'api_key' => 'API Key'],
            ],
            'n11' => [
                'label' => 'N11',
                'fields' => ['appkey' => 'App Key', 'appsecret' => 'App Secret', 'shipment_template' => 'Kargo Şablonu (N11 panelinden oluşturulan teslimat şablonu adı)'],
            ],
            'amazon' => [
                'label' => 'Amazon TR (SP-API)',
                'fields' => [
                    'refresh_token' => 'LWA Refresh Token',
                    'lwa_client_id' => 'LWA Client ID',
                    'lwa_client_secret' => 'LWA Client Secret',
                    'aws_access_key' => 'AWS Access Key',
                    'aws_secret_key' => 'AWS Secret Key',
                    'seller_id' => 'Seller ID',
                    'marketplace_id' => 'Marketplace ID (varsayılan TR)',
                ],
            ],
        ];
    }
}
