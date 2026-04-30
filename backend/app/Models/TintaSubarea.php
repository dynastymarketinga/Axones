<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TintaSubarea extends Model
{
    protected $fillable = [
        'material_id',
        'subarea',
    ];

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }
}
