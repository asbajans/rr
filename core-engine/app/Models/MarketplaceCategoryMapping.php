<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MarketplaceCategoryMapping extends Model
{
    protected $table = 'marketplace_category_mappings';

    protected $fillable = [
        'category_id',
        'marketplace',
        'marketplace_category_id',
        'marketplace_category_name',
        'marketplace_parent_id',
    ];

    public function category()
    {
        return $this->belongsTo(Category::class);
    }
}
