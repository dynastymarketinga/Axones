<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Material extends Model
{
    protected $fillable = [
        'sku',
        'name',
        'barcode',
        'inventory_area',
        'is_active',
        'tinta_presentacion',
        'micras',
        'ancho',
        'unit',
        'min_stock',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'min_stock' => 'decimal:3',
            'quantity_on_hand' => 'decimal:3',
            'micras' => 'decimal:3',
            'ancho' => 'decimal:3',
            'is_active' => 'boolean',
        ];
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'product_ink_material')
            ->withTimestamps();
    }
}
