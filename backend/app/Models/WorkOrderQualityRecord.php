<?php

namespace App\Models;

/**
 * Calidad — modelo activo; tabla `work_order_quality_records` conservada.
 * API/UI desactivados (Próximamente). Usado por seeders demo.
 */

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkOrderQualityRecord extends Model
{
    protected $fillable = [
        'work_order_id',
        'outcome',
        'notes',
        'certificate_body',
        'recorded_by',
    ];

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
