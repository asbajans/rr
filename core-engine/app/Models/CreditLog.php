<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CreditLog extends Model
{
    protected $fillable = [
        'user_id', 'action', 'module', 'amount', 'balance_before', 'balance_after', 'note',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}