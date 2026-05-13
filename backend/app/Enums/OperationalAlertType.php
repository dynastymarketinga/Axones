<?php

namespace App\Enums;

enum OperationalAlertType: string
{
    case OtMaterialShortage = 'ot_material_shortage';
    case ScrapThresholdExceeded = 'scrap_threshold_exceeded';
    case MountTimeExceeded = 'mount_time_exceeded';
    case DowntimeExceeded = 'downtime_exceeded';
    /** Devolución a inventario registrada (impresión u otros flujos): aviso en campana para almacén/inventario. */
    case InventoryReturnPending = 'inventory_return_pending';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
