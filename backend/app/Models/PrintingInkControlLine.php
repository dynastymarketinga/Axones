<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrintingInkControlLine extends Model
{
    protected $fillable = [
        'work_order_id',
        'material_id',
        'position',
        'quantity_original_kg',
        'quantity_solventada_kg',
        'quantity_return_kg',
        'notes',
    ];

    protected $appends = [
        'quantity_consumed_kg',
    ];

    protected function casts(): array
    {
        return [
            'quantity_original_kg' => 'decimal:3',
            'quantity_solventada_kg' => 'decimal:3',
            'quantity_return_kg' => 'decimal:3',
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

    /**
     * Consumo neto (hoja manual): Original + Solventada − Devolución.
     */
    public function getQuantityConsumedKgAttribute(): string
    {
        $sum = bcadd((string) $this->quantity_original_kg, (string) $this->quantity_solventada_kg, 3);

        return bcsub($sum, (string) $this->quantity_return_kg, 3);
    }
}
