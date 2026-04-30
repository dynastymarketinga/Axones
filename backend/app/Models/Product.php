<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Product extends Model
{
    protected $fillable = [
        'client_id',
        'name',
        'cpe',
        'mps',
        'print_type',
        'structure',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /** Tints allowed for planilla when this product is selected (pivot; vacío = no filtrar en API). */
    public function inkMaterials(): BelongsToMany
    {
        return $this->belongsToMany(Material::class, 'product_ink_material')
            ->withTimestamps();
    }

    /** Sustratos vinculados explícitamente para maestro de materiales. */
    public function substrateMaterials(): BelongsToMany
    {
        return $this->belongsToMany(Material::class, 'material_product')
            ->withTimestamps();
    }
}
