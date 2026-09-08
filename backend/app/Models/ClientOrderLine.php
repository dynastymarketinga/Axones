<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientOrderLine extends Model
{
    protected $fillable = [
        'client_order_id',
        'product_id',
        'material_id',
        'material_imprimir_id',    // Añadido
        'material_laminar_id',     // Añadido
        'material_trilaminar_id',  // Añadido
        'description',
        'quantity',
        'unit',
        'notes',
        'position',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
        ];
    }

    public function clientOrder(): BelongsTo
    {
        return $this->belongsTo(ClientOrder::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }

    public function materialImprimir(): BelongsTo
    {
        return $this->belongsTo(Material::class, 'material_imprimir_id');
    }

    public function materialLaminar(): BelongsTo
    {
        return $this->belongsTo(Material::class, 'material_laminar_id');
    }

    public function materialTrilaminar(): BelongsTo
    {
        return $this->belongsTo(Material::class, 'material_trilaminar_id');
    }
}