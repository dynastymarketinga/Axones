<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Product extends Model
{
    protected $fillable = [
        'client_id',
        'name',
        'cpe',
        'barcode',
        'mps',
        'print_type',
        'structure',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
