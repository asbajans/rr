<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MarketplaceCategory extends Model
{
    use HasFactory;

    protected $table = 'marketplace_categories';

    protected $fillable = [
        'store_id',
        'marketplace',
        'marketplace_category_id',
        'name',
        'parent_id',
        'level',
        'path',
    ];

    protected $casts = [
        'store_id' => 'integer',
        'level' => 'integer',
    ];

    public function store()
    {
        return $this->belongsTo(Store::class);
    }
}
