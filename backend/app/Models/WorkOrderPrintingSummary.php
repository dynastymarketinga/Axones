<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkOrderPrintingSummary extends Model
{
    protected $fillable = [
        'work_order_id',
        'scrap_percent',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'scrap_percent' => 'decimal:3',
        ];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }
}
