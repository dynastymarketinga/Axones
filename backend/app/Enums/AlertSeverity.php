<?php

namespace App\Enums;

enum AlertSeverity: string
{
    case Info = 'info';
    case Warning = 'warning';
    case Critical = 'critical';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
