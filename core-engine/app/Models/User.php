<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $fillable = [
        'store_id',
        'name',
        'email',
        'password',
        'ai_credits',
        'total_credits_consumed',
        'is_admin',
        'fcm_token',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function creditLogs()
    {
        return $this->hasMany(CreditLog::class);
    }

    public function isSuperAdmin(): bool
    {
        return $this->is_admin;
    }

    public function hasAiCredits(int $required): bool
    {
        return $this->ai_credits >= $required;
    }

    public function consumeAiCredits(int $amount, ?string $module = null, ?string $note = null): void
    {
        $before = $this->ai_credits;
        $this->decrement('ai_credits', $amount);
        $this->increment('total_credits_consumed', $amount);

        CreditLog::create([
            'user_id' => $this->id,
            'action' => 'consume',
            'module' => $module,
            'amount' => $amount,
            'balance_before' => $before,
            'balance_after' => $this->fresh()->ai_credits,
            'note' => $note,
        ]);
    }

    public function grantAiCredits(int $amount, ?string $note = null): void
    {
        $before = $this->ai_credits;
        $this->increment('ai_credits', $amount);

        CreditLog::create([
            'user_id' => $this->id,
            'action' => 'grant',
            'amount' => $amount,
            'balance_before' => $before,
            'balance_after' => $this->fresh()->ai_credits,
            'note' => $note,
        ]);
    }
}
