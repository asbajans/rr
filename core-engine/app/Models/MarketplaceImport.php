<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketplaceImport extends Model
{
    protected $fillable = [
        'store_id',
        'marketplace',
        'config',
        'max_pages',
        'status',
        'summary',
        'error',
    ];

    protected $casts = [
        'config' => 'array',
        'summary' => 'array',
    ];

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }
}
