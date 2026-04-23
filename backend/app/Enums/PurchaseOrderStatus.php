<?php

namespace App\Enums;

enum PurchaseOrderStatus: string
{
    case Open = 'open';
    case Partial = 'partial';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
