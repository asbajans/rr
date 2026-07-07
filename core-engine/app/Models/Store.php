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
        'stripe_account_id',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function apiKeys()
    {
        return $this->hasMany(ApiKey::class);
    }

    public function plan()
    {
        return $this->belongsTo(Plan::class);
    }

    public function subscription()
    {
        return $this->hasOne(Subscription::class)->latestOfMany();
    }

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class);
    }

    public function productCount(): int
    {
        return 0;
    }

    public function canCreateProduct(): bool
    {
        if (!$this->plan) return false;
        if ($this->plan->product_limit < 0) return true;
        return $this->productCount() < $this->plan->product_limit;
    }

    public function canCreateStore(): bool
    {
        if (!$this->plan) return false;
        return true;
    }
}
