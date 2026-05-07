<?php

namespace App\Enums;

enum WorkOrderPriority: string
{
    case Normal = 'normal';
    case Alta = 'alta';
    case Urgente = 'urgente';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
