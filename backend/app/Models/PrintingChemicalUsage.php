<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrintingChemicalUsage extends Model
{
    protected $fillable = [
        'work_order_id',
        'chemical_type',
        'quantity_loaded_kg',
        'quantity_return_kg',
        'notes',
    ];

    protected $appends = [
        'quantity_consumed_kg',
    ];

    protected function casts(): array
    {
        return [
            'quantity_loaded_kg' => 'decimal:3',
            'quantity_return_kg' => 'decimal:3',
        ];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function getQuantityConsumedKgAttribute(): string
    {
        return bcsub((string) $this->quantity_loaded_kg, (string) $this->quantity_return_kg, 3);
    }
}
