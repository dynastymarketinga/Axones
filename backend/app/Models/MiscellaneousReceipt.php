<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MiscellaneousReceipt extends Model
{
    protected static function booted(): void
    {
        static::deleting(function (MiscellaneousReceipt $receipt) {
            $receipt->load('attachments');
            foreach ($receipt->attachments as $attachment) {
                if (Storage::disk($attachment->disk)->exists($attachment->path)) {
                    Storage::disk($attachment->disk)->delete($attachment->path);
                }
            }
        });
    }

    protected $fillable = [
        'material_id',
        'quantity',
        'user_id',
        'invoice_reference',
        'notes',
        'received_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'received_at' => 'datetime',
        ];
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(MiscellaneousReceiptAttachment::class);
    }
}
