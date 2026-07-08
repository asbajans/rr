<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Variation extends Model
{
    protected $fillable = ['store_id', 'name', 'type'];

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function options()
    {
        return $this->hasMany(VariationOption::class)->orderBy('sort_order');
    }
}
