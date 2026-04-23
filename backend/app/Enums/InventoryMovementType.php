<?php

namespace App\Enums;

enum InventoryMovementType: string
{
    case In = 'in';
    case Out = 'out';
    case AdjustmentAdd = 'adjustment_add';
    case AdjustmentSub = 'adjustment_sub';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
