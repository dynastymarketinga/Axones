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

    /** Productos vinculados a sustratos (inventario área material). */
    public function substrateProducts(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'material_product')
            ->withTimestamps();
    }

    public function tintaSubareas(): HasMany
    {
        return $this->hasMany(TintaSubarea::class);
    }
}
