<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkOrderLaminacionSummary extends Model
{
    protected $fillable = [
        'work_order_id',
        'scrap_percent',
        'solvent_quantity_kg',
        'solvent_notes',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'scrap_percent' => 'decimal:3',
            'solvent_quantity_kg' => 'decimal:3',
        ];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }
}
