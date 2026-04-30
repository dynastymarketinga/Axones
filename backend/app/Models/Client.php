<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Client extends Model
{
    protected $fillable = [
        'name',
        'rif',
        'state',
        'city',
        'address',
        'email',
        'phone',
    ];

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function clientOrders(): HasMany
    {
        return $this->hasMany(ClientOrder::class);
    }
}
