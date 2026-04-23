<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkOrderTechnicalDocument extends Model
{
    protected $fillable = [
        'work_order_id',
        'form',
    ];

    protected function casts(): array
    {
        return [
            'form' => 'array',
        ];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }
}
