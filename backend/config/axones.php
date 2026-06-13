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
    ],

    /*
    |--------------------------------------------------------------------------
    | Asistente Axones (Fase 2)
    |--------------------------------------------------------------------------
    |
    | Copiloto embebido en la SPA. Feature flag OFF por defecto. La API key del
    | LLM vive solo en backend/.env — nunca expuesta al frontend.
    |
    */
    'assistant' => [
        'enabled' => env('AXONES_ASSISTANT_ENABLED', false),
        // local = gratis, sin LLM. anthropic = requiere ANTHROPIC_API_KEY.
        'provider' => env('AXONES_ASSISTANT_PROVIDER', 'local'),
        'anthropic_api_key' => env('ANTHROPIC_API_KEY'),
        'model' => env('AXONES_ASSISTANT_MODEL', 'claude-3-5-haiku-latest'),
        'analysis_model' => env('AXONES_ASSISTANT_ANALYSIS_MODEL', 'claude-sonnet-4-20250514'),
        'max_tokens' => (int) env('AXONES_ASSISTANT_MAX_TOKENS', 2048),
        'daily_limit_per_user' => (int) env('AXONES_ASSISTANT_DAILY_LIMIT', 50),
        'timeout_seconds' => (int) env('AXONES_ASSISTANT_TIMEOUT', 45),
        'allowed_roles' => array_values(array_filter(array_map('trim', explode(',', (string) env(
            'AXONES_ASSISTANT_ALLOWED_ROLES',
            'boss,admin,jefe_supremo,superadmin,jefe_operaciones,planificador,supervisor'
        ))))),
    ],

];
