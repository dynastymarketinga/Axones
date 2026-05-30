<?php

namespace App\Models;

use App\Enums\OperationalAlertType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OperationalAlert extends Model
{
    private const FULL_ACCESS_ROLES = ['boss', 'admin', 'jefe_supremo', 'superadmin', 'jefe_operaciones'];

    /**
     * Restringe alertas según rol (área) y oculta solicitudes de reset a roles sin acceso total.
     *
     * @param  Builder<OperationalAlert>  $query
     * @return Builder<OperationalAlert>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        $role = strtolower(trim((string) ($user->role ?? '')));
        $hasFull = in_array($role, self::FULL_ACCESS_ROLES, true);

        $targetArea = match ($role) {
            'printing', 'impresion' => 'impresion',
            'laminacion' => 'laminacion',
            'corte' => 'corte',
            'montaje' => 'montaje',
            'tintas' => 'tintas',
            default => null,
        };

        if (! $hasFull && $targetArea !== null) {
            $query->where(function (Builder $q) use ($targetArea): void {
                $q->where('metadata->target_area', $targetArea)
                    ->orWhereIn('alert_type', OperationalAlertType::materialOperationalValues());
            });
        }

        if (! $hasFull) {
            $query->where('alert_type', '!=', 'password_reset_requested');
        }

        return $query;
    }

    protected $fillable = [
        'alert_type',
        'severity',
        'message',
        'work_order_id',
        'material_id',
        'metadata',
        'acknowledged_at',
        'acknowledged_by',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'acknowledged_at' => 'datetime',
        ];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }

    public function acknowledgedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeUnread($query)
    {
        return $query->whereNull('acknowledged_at');
    }

    /**
     * Desperdicio, escasez en OT y stock bajo (pantalla /alertas).
     *
     * @param  Builder<OperationalAlert>  $query
     * @return Builder<OperationalAlert>
     */
    public function scopeMaterialOperational(Builder $query): Builder
    {
        return $query->whereIn('alert_type', OperationalAlertType::materialOperationalValues());
    }
}
