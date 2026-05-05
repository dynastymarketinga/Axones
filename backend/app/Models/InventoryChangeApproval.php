<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryChangeApproval extends Model
{
    protected $fillable = [
        'entity_type',
        'entity_id',
        'change_payload',
        'reason_text',
        'requested_by',
        'status',
        'decided_by',
        'decided_at',
        'decision_notes',
    ];

    protected function casts(): array
    {
        return [
            'change_payload' => 'array',
            'decided_at' => 'datetime',
        ];
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
