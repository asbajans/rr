<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExternalFeed extends Model
{
    protected $fillable = [
        'store_id',
        'name',
        'feed_url',
        'file_format',
        'auth_type',
        'auth_credentials',
        'pricing_mode',
        'currency',
        'default_gram_weight',
        'default_milyem',
        'default_profit_margin',
        'price_multiplier',
        'default_category',
        'default_category_id',
        'default_is_b2b_enabled',
        'default_quantity',
        'default_marketplaces',
        'field_mapping',
        'auto_sync',
        'update_interval',
        'last_sync_at',
        'last_sync_result',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'auth_credentials' => 'array',
            'default_marketplaces' => 'array',
            'field_mapping' => 'array',
            'last_sync_result' => 'array',
            'auto_sync' => 'boolean',
            'is_active' => 'boolean',
            'default_is_b2b_enabled' => 'boolean',
            'price_multiplier' => 'decimal:2',
            'default_gram_weight' => 'decimal:4',
            'default_milyem' => 'integer',
            'default_profit_margin' => 'decimal:2',
            'default_quantity' => 'integer',
            'last_sync_at' => 'datetime',
        ];
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function defaultCategory()
    {
        return $this->belongsTo(Category::class, 'default_category_id');
    }

    public function syncLogs()
    {
        return $this->hasMany(FeedSyncLog::class);
    }
}
