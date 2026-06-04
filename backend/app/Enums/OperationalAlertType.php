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
    /** Solicitud de insumos / sustratos planilla OT pendiente de despacho en almacén. */
    case MaterialRequestPendingWarehouse = 'material_request_pending_warehouse';

    /** Tipos mostrados en /alertas (desperdicio y escasez de material). */
    public static function materialOperationalValues(): array
    {
        return [
            self::OtMaterialShortage->value,
            self::ScrapThresholdExceeded->value,
            self::MaterialLowStock->value,
        ];
    }

    /** Campana y bandeja de notificaciones para roles de inventario / almacén. */
    public static function warehouseNotificationValues(): array
    {
        return [
            self::MaterialRequestPendingWarehouse->value,
            self::InventoryReturnPending->value,
        ];
    }

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
