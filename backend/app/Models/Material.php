<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Material extends Model
{
    protected $fillable = [
        'sku',
        'name',
        'barcode',
        'inventory_area',
        'tinta_presentacion',
        'unit',
        'min_stock',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'min_stock' => 'decimal:3',
            'quantity_on_hand' => 'decimal:3',
        ];
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }
}
