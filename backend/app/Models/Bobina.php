<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Bobina extends Model
{
    protected $fillable = [
        'material_id',
        'inventory_return_id',
        'code',
        'weight_kg',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'weight_kg' => 'decimal:3',
        ];
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }

    public function inventoryReturn(): BelongsTo
    {
        return $this->belongsTo(InventoryReturn::class);
    }
}
