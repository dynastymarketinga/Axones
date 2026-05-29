<?php

namespace App\Models;

use App\Enums\ClientOrderStatus;
use App\Enums\WorkOrderStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ClientOrder extends Model
{
    protected $fillable = [
        'client_id',
        'code',
        'status',
        'ordered_at',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'ordered_at' => 'date',
        ];
    }

    public static function nextCode(): string
    {
        $prefix = 'OC-CLI-'.now()->format('Y').'-';
        $last = self::query()->where('code', 'like', $prefix.'%')->orderByDesc('id')->value('code');
        $n = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $n, 5, '0', STR_PAD_LEFT);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function workOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(ClientOrderLine::class)->orderBy('position')->orderBy('id');
    }

    /**
     * Primera línea con producto maestro (para resumen y para enlazar product_id a la OT).
     */
    public function firstLineWithProduct(): HasOne
    {
        return $this->hasOne(ClientOrderLine::class)
            ->whereNotNull('product_id')
            ->orderBy('position')
            ->orderBy('id');
    }

    /**
     * OC abiertas sin OT de producción activa (no cancelada).
     */
    public function scopeAwaitingProductionOt(Builder $query): Builder
    {
        return $query
            ->where('status', ClientOrderStatus::Open->value)
            ->whereDoesntHave('workOrders', function (Builder $wo): void {
                $wo->where('status', '!=', WorkOrderStatus::Cancelled->value);
            });
    }
}
