<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryReturn extends Model
{
    protected $fillable = [
        'material_id',
        'work_order_id',
        'destination_area',
        'quantity',
        'status',
        'reason',
        'accepted_by',
        'accepted_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'accepted_at' => 'datetime',
        ];
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function acceptedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accepted_by');
    }
}
