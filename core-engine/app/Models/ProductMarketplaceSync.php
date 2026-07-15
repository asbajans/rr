<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductMarketplaceSync extends Model
{
    protected $table = 'product_marketplace_sync';

    protected $fillable = [
        'store_id',
        'product_id',
        'marketplace',
        'status',
        'marketplace_product_id',
        'error_message',
        'checked_at',
    ];

    protected function casts(): array
    {
        return [
            'checked_at' => 'datetime',
        ];
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public static function markPending(int $storeId, string $productId, array $marketplaces): void
    {
        foreach ($marketplaces as $mp) {
            self::updateOrCreate(
                ['store_id' => $storeId, 'product_id' => $productId, 'marketplace' => $mp],
                ['status' => 'pending', 'error_message' => null, 'checked_at' => null]
            );
        }
    }

    public static function markRemoved(int $storeId, string $productId, array $activeMarketplaces): void
    {
        self::where('store_id', $storeId)
            ->where('product_id', $productId)
            ->whereNotIn('marketplace', $activeMarketplaces)
            ->where('status', '!=', 'none')
            ->update(['status' => 'none', 'marketplace_product_id' => null, 'error_message' => null]);
    }

    public static function syncResult(
        int $storeId,
        string $productId,
        string $marketplace,
        bool $success,
        ?string $marketplaceProductId = null,
        ?string $error = null
    ): void {
        self::updateOrCreate(
            ['store_id' => $storeId, 'product_id' => $productId, 'marketplace' => $marketplace],
            [
                'status' => $success ? 'synced' : 'error',
                'marketplace_product_id' => $marketplaceProductId,
                'error_message' => $error,
                'checked_at' => now(),
            ]
        );
    }
}
