<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vendor extends Model
{
    protected $fillable = [
        'name',
        'phone_primary',
        'phone_secondary',
        'active',
    ];

    public function clients(): HasMany
    {
        return $this->hasMany(Client::class);
    }

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
        ];
    }
}

