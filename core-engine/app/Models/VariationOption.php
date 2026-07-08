<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VariationOption extends Model
{
    protected $fillable = ['variation_id', 'value', 'sort_order'];

    public function variation()
    {
        return $this->belongsTo(Variation::class);
    }
}
