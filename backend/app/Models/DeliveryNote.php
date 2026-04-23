<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DeliveryNote extends Model
{
    protected $fillable = [
        'sequential_number',
        'code',
        'work_order_id',
        'document_date',
        'driver_name',
        'vehicle_notes',
        'status',
        'user_id',
        'dispatched_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'document_date' => 'date',
            'dispatched_at' => 'datetime',
        ];
    }

    public static function nextSequentialNumber(): int
    {
        $max = (int) self::query()->max('sequential_number');

        return $max + 1;
    }

    public static function nextCode(): string
    {
        $prefix = 'ND-'.now()->format('Y').'-';
        $last = self::query()->where('code', 'like', $prefix.'%')->orderByDesc('id')->value('code');
        $n = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $n, 5, '0', STR_PAD_LEFT);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(DeliveryNoteLine::class);
    }
}
