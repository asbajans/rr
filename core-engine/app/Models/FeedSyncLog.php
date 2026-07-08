<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FeedSyncLog extends Model
{
    protected $fillable = [
        'feed_id',
        'store_id',
        'status',
        'started_at',
        'completed_at',
        'summary',
    ];

    protected function casts(): array
    {
        return [
            'summary' => 'array',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function feed()
    {
        return $this->belongsTo(ExternalFeed::class);
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }
}
