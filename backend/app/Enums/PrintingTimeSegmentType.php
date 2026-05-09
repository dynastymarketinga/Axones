<?php

namespace App\Enums;

enum PrintingTimeSegmentType: string
{
    case Mount = 'mount';
    case Demount = 'demount';
    case Production = 'production';
    case Downtime = 'downtime';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
