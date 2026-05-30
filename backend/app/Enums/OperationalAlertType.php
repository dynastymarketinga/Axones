<?php

namespace App\Enums;

enum OperationalAlertType: string
{
    case OtMaterialShortage = 'ot_material_shortage';
    case ScrapThresholdExceeded = 'scrap_threshold_exceeded';
    /** Existencia por debajo del mínimo configurado (inventario). */
    case MaterialLowStock = 'material_low_stock';
    case MountTimeExceeded = 'mount_time_exceeded';
    case DowntimeExceeded = 'downtime_exceeded';
    /** Devolución a inventario registrada (impresión u otros flujos): aviso en campana para almacén/inventario. */
    case InventoryReturnPending = 'inventory_return_pending';

    /** Tipos mostrados en /alertas (desperdicio y escasez de material). */
    public static function materialOperationalValues(): array
    {
        return [
            self::OtMaterialShortage->value,
            self::ScrapThresholdExceeded->value,
            self::MaterialLowStock->value,
        ];
    }

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
