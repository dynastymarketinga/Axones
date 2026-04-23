<?php

namespace App\Enums;

enum OperationalAlertType: string
{
    case OtMaterialShortage = 'ot_material_shortage';
    case ScrapThresholdExceeded = 'scrap_threshold_exceeded';
    case MountTimeExceeded = 'mount_time_exceeded';
    case DowntimeExceeded = 'downtime_exceeded';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
