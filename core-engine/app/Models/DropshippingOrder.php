<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DropshippingOrder extends Model
{
    const STATUS_PENDING = 'pending';
    const STATUS_PROCESSING = 'processing';
    const STATUS_SHIPPED = 'shipped';
    const STATUS_DELIVERED = 'delivered';
    const STATUS_CANCELLED = 'cancelled';
    const STATUS_RETURNED = 'returned';

    const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_PROCESSING,
        self::STATUS_SHIPPED,
        self::STATUS_DELIVERED,
        self::STATUS_CANCELLED,
        self::STATUS_RETURNED,
    ];

    const STATUS_FLOW = [
        self::STATUS_PENDING => [self::STATUS_PROCESSING, self::STATUS_CANCELLED],
        self::STATUS_PROCESSING => [self::STATUS_SHIPPED, self::STATUS_CANCELLED],
        self::STATUS_SHIPPED => [self::STATUS_DELIVERED, self::STATUS_RETURNED],
        self::STATUS_DELIVERED => [self::STATUS_RETURNED],
        self::STATUS_CANCELLED => [],
        self::STATUS_RETURNED => [],
    ];

    protected $fillable = [
        'external_id',
        'marketplace',
        'status',
        'vendor_id',
        'customer_name',
        'customer_email',
        'customer_phone',
        'shipping_address',
        'items',
        'subtotal',
        'shipping',
        'tax',
        'grand_total',
        'currency',
        'ordered_at',
        'tracking_number',
        'tracking_company',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'items' => 'array',
            'subtotal' => 'decimal:2',
            'shipping' => 'decimal:2',
            'tax' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'ordered_at' => 'datetime',
        ];
    }

    public function vendor()
    {
        return $this->belongsTo(Store::class, 'vendor_id');
    }

    public function statusHistory()
    {
        return $this->hasMany(OrderStatusHistory::class);
    }

    public function canTransitionTo(string $newStatus): bool
    {
        return in_array($newStatus, self::STATUS_FLOW[$this->status] ?? []);
    }

    public function transitionTo(string $newStatus, ?string $note = null, ?int $userId = null): bool
    {
        if (!$this->canTransitionTo($newStatus)) {
            return false;
        }

        $from = $this->status;
        $this->status = $newStatus;
        $this->save();

        $this->statusHistory()->create([
            'from_status' => $from,
            'to_status' => $newStatus,
            'note' => $note,
            'user_id' => $userId,
        ]);

        return true;
    }

    public static function statusLabel(string $status): string
    {
        return match ($status) {
            self::STATUS_PENDING => 'Beklemede',
            self::STATUS_PROCESSING => 'Hazırlanıyor',
            self::STATUS_SHIPPED => 'Kargoda',
            self::STATUS_DELIVERED => 'Teslim Edildi',
            self::STATUS_CANCELLED => 'İptal Edildi',
            self::STATUS_RETURNED => 'İade Edildi',
            default => $status,
        };
    }

    public static function statusColor(string $status): string
    {
        return match ($status) {
            self::STATUS_PENDING => 'bg-yellow-100 text-yellow-700',
            self::STATUS_PROCESSING => 'bg-blue-100 text-blue-700',
            self::STATUS_SHIPPED => 'bg-purple-100 text-purple-700',
            self::STATUS_DELIVERED => 'bg-green-100 text-green-700',
            self::STATUS_CANCELLED => 'bg-red-100 text-red-700',
            self::STATUS_RETURNED => 'bg-orange-100 text-orange-700',
            default => 'bg-zinc-100 text-zinc-700',
        };
    }
}
