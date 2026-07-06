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

    public function hasAiCredits(int $required): bool
    {
        return $this->ai_credits >= $required;
    }

    public function consumeAiCredits(int $amount): void
    {
        $this->decrement('ai_credits', $amount);
    }
}
