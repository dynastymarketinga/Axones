<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrintingBobinaUsage extends Model
{
    protected $fillable = [
        'work_order_id',
        'bobina_id',
        'material_id',
        'quantity_used_kg',
        'quantity_finished_kg',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity_used_kg' => 'decimal:3',
            'quantity_finished_kg' => 'decimal:3',
        ];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function bobina(): BelongsTo
    {
        return $this->belongsTo(Bobina::class);
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }
}
