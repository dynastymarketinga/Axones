<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MiscellaneousReceiptAttachment extends Model
{
    protected $fillable = [
        'miscellaneous_receipt_id',
        'disk',
        'path',
        'original_name',
        'mime_type',
        'size_bytes',
    ];

    public function miscellaneousReceipt(): BelongsTo
    {
        return $this->belongsTo(MiscellaneousReceipt::class);
    }
}
