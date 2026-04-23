<?php

namespace App\Enums;

enum QualityOutcome: string
{
    case Pending = 'pending';
    case Pass = 'pass';
    case Fail = 'fail';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
