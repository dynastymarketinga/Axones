<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssistantMessage extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'user_role',
        'route_context',
        'user_message',
        'assistant_message',
        'dots',
        'chips',
        'tools_used',
        'model_used',
        'input_tokens',
        'output_tokens',
        'duration_ms',
        'status',
        'error_message',
    ];

    protected $casts = [
        'route_context' => 'array',
        'dots' => 'array',
        'chips' => 'array',
        'tools_used' => 'array',
        'input_tokens' => 'integer',
        'output_tokens' => 'integer',
        'duration_ms' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
