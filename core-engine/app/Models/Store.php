<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Store extends Model
{
    protected $fillable = [
        'name',
        'site_code',
        'domain',
        'email',
        'is_active',
        'plan_id',
    ];

    public function apiKeys()
    {
        return $this->hasMany(ApiKey::class);
    }

    public function plan()
    {
        return $this->belongsTo(Plan::class);
    }
}
