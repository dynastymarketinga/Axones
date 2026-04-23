<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Umbrales de alertas operativas (PDF §6 — incidencias)
    |--------------------------------------------------------------------------
    |
    | Valores por defecto; sobreescribibles con variables de entorno AXONES_*.
    |
    */

    'alerts' => [
        'scrap_percent_threshold' => (float) env('AXONES_SCRAP_ALERT_PERCENT', 10),
        'mount_seconds_threshold' => (int) env('AXONES_MOUNT_ALERT_SECONDS', 3600),
        'downtime_seconds_threshold' => (int) env('AXONES_DOWNTIME_ALERT_SECONDS', 1800),
    ],

];
