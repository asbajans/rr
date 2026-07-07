<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Subscription extends Model
{
    protected $fillable = [
        'store_id',
        'plan_id',
        'stripe_id',
        'stripe_status',
        'payment_method',
        'quantity',
        'trial_ends_at',
        'ends_at',
        'renews_at',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'trial_ends_at' => 'datetime',
            'ends_at' => 'datetime',
            'renews_at' => 'datetime',
            'quantity' => 'integer',
        ];
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function plan()
    {
        return $this->belongsTo(Plan::class);
    }

    public function isActive(): bool
    {
        return in_array($this->status, ['active', 'trial']);
    }

    public function isOnTrial(): bool
    {
        return $this->status === 'trial' && $this->trial_ends_at?->isFuture();
    }

    public function isExpired(): bool
    {
        return $this->ends_at?->isPast() || $this->status === 'expired';
    }

    public function isCanceled(): bool
    {
        return $this->status === 'canceled';
    }
}
