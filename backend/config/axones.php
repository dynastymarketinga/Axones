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
        'scrap_percent_threshold' => (float) env('AXONES_SCRAP_ALERT_PERCENT', 5),
        'mount_seconds_threshold' => (int) env('AXONES_MOUNT_ALERT_SECONDS', 3600),
        'downtime_seconds_threshold' => (int) env('AXONES_DOWNTIME_ALERT_SECONDS', 1800),
    ],

    /*
    |--------------------------------------------------------------------------
    | Devoluciones a inventario
    |--------------------------------------------------------------------------
    |
    | Lista separada por comas de roles (campo users.role) que pueden POST
    | /api/inventory-returns/{id}/accept. Vacío o null = cualquier usuario autenticado
    | con acceso a la ruta (compatibilidad con instalaciones existentes).
    |
    */
    'inventory_returns' => [
        'accept_roles' => env('AXONES_INVENTORY_RETURN_ACCEPT_ROLES'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Grupos de sustrato — reporte de desperdicio
    |--------------------------------------------------------------------------
    */
    'scrap_substrate_groups' => [
        [
            'id' => 'bopp',
            'label' => 'BOPP',
            'structure_patterns' => ['bopp'],
            'aliases' => [],
        ],
        [
            'id' => 'polietileno',
            'label' => 'Polietileno',
            'structure_patterns' => [
                'polietileno',
                'politereño',
                'pebd',
                'ldpe',
                'hdpe',
                'lldpe',
                'polyethylene',
            ],
            'aliases' => ['politerlero'],
        ],
        [
            'id' => 'transparente',
            'label' => 'Transparente',
            'structure_patterns' => ['transparente', 'cpp', 'cast', 'opp'],
            'aliases' => [],
        ],
        [
            'id' => 'poliestireno',
            'label' => 'Poliestireno',
            'structure_patterns' => ['poliestireno', 'poliestyrene', 'hips', 'gpps', 'pps'],
            'aliases' => [],
        ],
    ],

];
