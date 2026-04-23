<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MaterialRequest extends Model
{
    protected $fillable = [
        'work_order_id',
        'document_date',
        'requested_by',
        'originating_area',
        'destination_areas',
        'machine_code',
        'authorized_by',
        'authorized_at',
        'dispatched_by',
        'dispatched_at',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'document_date' => 'date',
            'destination_areas' => 'array',
            'authorized_at' => 'datetime',
            'dispatched_at' => 'datetime',
        ];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function authorizer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'authorized_by');
    }

    public function dispatcher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dispatched_by');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(MaterialRequestLine::class);
    }
}
