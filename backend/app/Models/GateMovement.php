<?php

namespace App\Models;

/**
 * Vigilancia — modelo activo; tabla `gate_movements` conservada.
 * API/UI desactivados (Próximamente). Usado por seeders demo.
 */

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GateMovement extends Model
{
    protected $fillable = [
        'direction',
        'notes',
        'photo_path',
        'user_id',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
