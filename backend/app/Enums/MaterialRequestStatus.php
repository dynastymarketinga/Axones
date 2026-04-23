<?php

namespace App\Enums;

enum MaterialRequestStatus: string
{
    case Pending = 'pending';
    case Partial = 'partial';
    case Dispatched = 'dispatched';
    case Cancelled = 'cancelled';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
