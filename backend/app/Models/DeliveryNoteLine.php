<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeliveryNoteLine extends Model
{
    protected $fillable = [
        'delivery_note_id',
        'corte_bobina_usage_id',
        'work_order_id',
        'product_id',
        'description',
        'quantity_kg',
        'pallet_code',
        'bobbin_count',
    ];

    protected function casts(): array
    {
        return [
            'quantity_kg' => 'decimal:3',
        ];
    }

    public function deliveryNote(): BelongsTo
    {
        return $this->belongsTo(DeliveryNote::class);
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function corteBobinaUsage(): BelongsTo
    {
        return $this->belongsTo(CorteBobinaUsage::class);
    }
}
