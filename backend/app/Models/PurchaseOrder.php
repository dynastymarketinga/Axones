<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseOrder extends Model
{
    protected $fillable = [
        'supplier_id',
        'code',
        'status',
        'ordered_at',
        'notes',
        'tax_applies',
        'manually_closed_at',
        'manually_closed_by',
        'manual_close_reason',
        'is_active',
        'deactivated_at',
        'deactivation_reason',
        'last_change_reason',
    ];

    protected function casts(): array
    {
        return [
            'ordered_at' => 'date',
            'tax_applies' => 'boolean',
            'manually_closed_at' => 'datetime',
            'is_active' => 'boolean',
            'deactivated_at' => 'datetime',
        ];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseOrderLine::class);
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(PurchaseReceipt::class);
    }

    public function manuallyClosedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manually_closed_by');
    }
}
