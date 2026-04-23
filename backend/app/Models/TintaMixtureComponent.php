<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TintaMixtureComponent extends Model
{
    protected $fillable = [
        'tinta_mixture_id',
        'material_id',
        'quantity',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
        ];
    }

    public function tintaMixture(): BelongsTo
    {
        return $this->belongsTo(TintaMixture::class);
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }
}
