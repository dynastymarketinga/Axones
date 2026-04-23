<?php

namespace App\Enums;

enum DeliveryNoteStatus: string
{
    case Draft = 'draft';
    case Dispatched = 'dispatched';
    case Cancelled = 'cancelled';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
