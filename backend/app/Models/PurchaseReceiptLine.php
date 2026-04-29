<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseReceiptLine extends Model
{
    protected $fillable = [
        'purchase_receipt_id',
        'purchase_order_line_id',
        'material_id',
        'item_type',
        'quantity',
        'unit',
        'micras',
        'ancho_mm',
        'bobina_count',
        'bobina_weight_kg',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'micras' => 'decimal:3',
            'ancho_mm' => 'decimal:3',
            'bobina_weight_kg' => 'decimal:3',
        ];
    }

    public function purchaseReceipt(): BelongsTo
    {
        return $this->belongsTo(PurchaseReceipt::class);
    }

    public function purchaseOrderLine(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderLine::class);
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }
}
