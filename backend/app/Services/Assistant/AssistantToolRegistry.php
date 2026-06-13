<?php

namespace App\Services\Assistant;

use App\Exceptions\Assistant\AssistantApiException;
use App\Support\AssistantSpaRoutes;
use App\Support\AssistantToolResult;

/**
 * Catálogo de 15 tools en PHP, espejo 1:1 de bot/src/tools/*.ts.
 * Nombres y forma de salida deben coincidir con la versión TypeScript:
 * cambios aquí requieren cambios allá.
 */
final class AssistantToolRegistry
{
    private const WORK_ORDER_CODE_RE = '/^OT-\d{4}-\d{1,6}$/i';

    private const ENTITY_TYPES = [
        'work_order', 'material', 'alert', 'material_request',
        'area_request', 'client_order', 'delivery_note', 'bobina',
    ];

    /** @var array<string, AssistantTool>|null */
    private ?array $cache = null;

    /** @return array<string, AssistantTool> */
    public function all(): array
    {
        if ($this->cache !== null) {
            return $this->cache;
        }
        $tools = [
            $this->pingTool(),
            $this->dashboardSummaryTool(),
            $this->getWorkOrderTool(),
            $this->listWorkOrdersTool(),
            $this->getPendingAlertsTool(),
            $this->listLowStockMaterialsTool(),
            $this->getMaterialRequestTool(),
            $this->listMaterialRequestsPendingTool(),
            $this->areaRequestsCountsTool(),
            $this->analyzeScrapTool(),
            $this->analyzeProductionTimeTool(),
            $this->workOrderProductionSummaryTool(),
            $this->compareDashboardPeriodsTool(),
            $this->resolveEntityTool(),
            $this->suggestChipsTool(),
        ];
        $byName = [];
        foreach ($tools as $t) {
            $byName[$t->name] = $t;
        }

        return $this->cache = $byName;
    }

    public function find(string $name): ?AssistantTool
    {
        return $this->all()[$name] ?? null;
    }

    /** @return array<int, array{name:string,description:string,input_schema:array<string,mixed>}> */
    public function anthropicSchemas(): array
    {
        $out = [];
        foreach ($this->all() as $tool) {
            $out[] = [
                'name' => $tool->name,
                'description' => $tool->description,
                'input_schema' => $tool->inputSchema,
            ];
        }

        return $out;
    }

    private function pingTool(): AssistantTool
    {
        return new AssistantTool(
            name: 'axones_ping',
            title: 'Salud de la API Axones',
            description: 'Comprueba que la API Axones responde. Útil para validar configuración antes de cualquier consulta.',
            inputSchema: ['type' => 'object', 'properties' => new \stdClass(), 'additionalProperties' => false],
            isAnalysis: false,
            handler: function (array $_args, AssistantInternalApiClient $api): AssistantToolResult {
                try {
                    $data = $api->get('/ping');

                    return AssistantToolResult::ok([
                        'summary' => 'El sistema está en línea y respondiendo.',
                        'data' => $data,
                    ]);
                } catch (\Throwable $e) {
                    return AssistantToolResult::fromException($e);
                }
            },
        );
    }

    private function dashboardSummaryTool(): AssistantTool
    {
        return new AssistantTool(
            name: 'axones_dashboard_summary',
            title: 'Resumen general',
            description: 'KPIs del panel: producción del mes, mermas, alertas no leídas, OT por etapa, stock bajo y movimientos del día.',
            inputSchema: ['type' => 'object', 'properties' => new \stdClass(), 'additionalProperties' => false],
            isAnalysis: false,
            handler: function (array $_args, AssistantInternalApiClient $api): AssistantToolResult {
                try {
                    $data = $api->get('/dashboard/summary');
                    $summary = sprintf(
                        'OT pendientes de producción: %d · Alertas sin leer: %d · Solicitudes pendientes: %d',
                        (int) ($data['work_orders_pending_production'] ?? 0),
                        (int) ($data['operational_alerts_unread'] ?? 0),
                        (int) ($data['material_requests_pending'] ?? 0),
                    );
                    $low = is_array($data['materials_low_stock'] ?? null)
                        ? array_slice($data['materials_low_stock'], 0, 5)
                        : [];
                    $dots = [];
                    foreach ($low as $m) {
                        $id = (int) ($m['id'] ?? 0);
                        if ($id <= 0) {
                            continue;
                        }
                        $dots[] = [
                            'type' => 'material',
                            'id' => $id,
                            'label' => trim(($m['sku'] ?? '').' '.($m['name'] ?? '')),
                            'href' => AssistantSpaRoutes::hrefFor('material', $id),
                        ];
                    }

                    return AssistantToolResult::ok([
                        'summary' => $summary,
                        'data' => $data,
                        'dots' => $dots,
                        'follow_up_chips' => [
                            ['label' => 'Ver alertas pendientes', 'tool' => 'axones_get_pending_alerts'],
                            ['label' => 'Ver stock bajo', 'tool' => 'axones_list_low_stock_materials'],
                            ['label' => 'Solicitudes de material pendientes', 'tool' => 'axones_list_material_requests_pending'],
                        ],
                    ]);
                } catch (\Throwable $e) {
                    return AssistantToolResult::fromException($e);
                }
            },
        );
    }

    private function getWorkOrderTool(): AssistantTool
    {
        return new AssistantTool(
            name: 'axones_get_work_order',
            title: 'Detalle de una orden de trabajo',
            description: "Detalle de OT por id numérico o por código 'OT-AAAA-NNNNN'. Incluye estado, etapa de tablero, cliente y producto.",
            inputSchema: [
                'type' => 'object',
                'properties' => [
                    'identifier' => [
                        'oneOf' => [['type' => 'integer', 'minimum' => 1], ['type' => 'string', 'minLength' => 1]],
                        'description' => "Id numérico o código 'OT-AAAA-NNNNN'.",
                    ],
                ],
                'required' => ['identifier'],
                'additionalProperties' => false,
            ],
            isAnalysis: false,
            handler: function (array $args, AssistantInternalApiClient $api): AssistantToolResult {
                $identifier = $args['identifier'] ?? null;
                if ($identifier === null) {
                    return AssistantToolResult::fail("Falta 'identifier'.");
                }
                try {
                    $id = null;
                    if (is_int($identifier) || (is_string($identifier) && ctype_digit(trim($identifier)))) {
                        $id = (int) $identifier;
                    } elseif (is_string($identifier) && preg_match(self::WORK_ORDER_CODE_RE, trim($identifier))) {
                        $code = strtoupper(trim($identifier));
                        $list = $api->get('/work-orders', ['q' => $code, 'per_page' => 5]);
                        $rows = is_array($list['data'] ?? null) ? $list['data'] : [];
                        $found = null;
                        foreach ($rows as $row) {
                            if (strtoupper((string) ($row['code'] ?? '')) === $code) {
                                $found = $row;
                                break;
                            }
                        }
                        $found ??= $rows[0] ?? null;
                        if ($found === null) {
                            return AssistantToolResult::fail("No encontré ninguna OT con código {$code}.");
                        }
                        $id = (int) $found['id'];
                    } else {
                        return AssistantToolResult::fail("Identificador inválido. Use id numérico o código 'OT-AAAA-NNNNN'.");
                    }

                    $data = $api->get("/work-orders/{$id}");
                    $summary = trim(sprintf(
                        '%s · estado %s · etapa %s · cliente %s',
                        (string) ($data['code'] ?? "OT #{$id}"),
                        (string) ($data['status'] ?? '—'),
                        (string) ($data['board_stage'] ?? '—'),
                        (string) ($data['client']['name'] ?? '—'),
                    ));

                    return AssistantToolResult::ok([
                        'summary' => $summary,
                        'data' => $data,
                        'dots' => [[
                            'type' => 'work_order',
                            'id' => (int) $data['id'],
                            'label' => (string) ($data['code'] ?? "OT #{$data['id']}"),
                            'href' => AssistantSpaRoutes::hrefFor('work_order', (int) $data['id']),
                        ]],
                        'follow_up_chips' => [
                            ['label' => 'Resumen de producción', 'tool' => 'axones_work_order_production_summary', 'params' => ['work_order_id' => (int) $data['id']]],
                            ['label' => 'Alertas de esta OT', 'tool' => 'axones_get_pending_alerts', 'params' => ['work_order_id' => (int) $data['id']]],
                        ],
                    ]);
                } catch (\Throwable $e) {
                    return AssistantToolResult::fromException($e);
                }
            },
        );
    }

    private function listWorkOrdersTool(): AssistantTool
    {
        return new AssistantTool(
            name: 'axones_list_work_orders',
            title: 'Listar órdenes de trabajo',
            description: "Lista OT con filtros básicos: 'cuántas OT están en impresión', 'OT abiertas del cliente X', etc.",
            inputSchema: [
                'type' => 'object',
                'properties' => [
                    'status' => ['type' => 'string', 'enum' => ['open', 'in_progress', 'completed', 'cancelled']],
                    'board_stage' => ['type' => 'string', 'enum' => ['impresion', 'laminacion', 'corte', 'montaje', 'completada']],
                    'scheduling_status' => ['type' => 'string', 'enum' => ['pending_programming', 'in_programming', 'scheduled']],
                    'search' => ['type' => 'string', 'minLength' => 1, 'description' => 'Texto libre (código, referencia, producto, cliente).'],
                    'per_page' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 100],
                    'page' => ['type' => 'integer', 'minimum' => 1],
                ],
                'additionalProperties' => false,
            ],
            isAnalysis: false,
            handler: function (array $args, AssistantInternalApiClient $api): AssistantToolResult {
                try {
                    $data = $api->get('/work-orders', [
                        'status' => $args['status'] ?? null,
                        'board_stage' => $args['board_stage'] ?? null,
                        'scheduling_status' => $args['scheduling_status'] ?? null,
                        'q' => $args['search'] ?? null,
                        'per_page' => $args['per_page'] ?? 20,
                        'page' => $args['page'] ?? null,
                    ]);
                    $rows = is_array($data['data'] ?? null) ? $data['data'] : [];
                    $total = (int) ($data['meta']['total'] ?? $data['total'] ?? count($rows));
                    $dots = [];
                    foreach (array_slice($rows, 0, 10) as $w) {
                        $id = (int) ($w['id'] ?? 0);
                        if ($id <= 0) {
                            continue;
                        }
                        $dots[] = [
                            'type' => 'work_order',
                            'id' => $id,
                            'label' => (string) ($w['code'] ?? "OT #{$id}"),
                            'href' => AssistantSpaRoutes::hrefFor('work_order', $id),
                        ];
                    }

                    return AssistantToolResult::ok([
                        'summary' => "Se encontraron {$total} OT (mostrando ".count($rows).').',
                        'data' => $data,
                        'dots' => $dots,
                    ]);
                } catch (\Throwable $e) {
                    return AssistantToolResult::fromException($e);
                }
            },
        );
    }

    private function getPendingAlertsTool(): AssistantTool
    {
        return new AssistantTool(
            name: 'axones_get_pending_alerts',
            title: 'Alertas operativas pendientes',
            description: 'Lista alertas operativas. Por defecto solo no leídas. Permite filtrar por OT, severidad o tipo.',
            inputSchema: [
                'type' => 'object',
                'properties' => [
                    'work_order_id' => ['type' => 'integer', 'minimum' => 1],
                    'severity' => ['type' => 'string', 'minLength' => 1],
                    'alert_type' => ['type' => 'string', 'minLength' => 1],
                    'include_acknowledged' => ['type' => 'boolean', 'description' => 'Si true incluye reconocidas; por defecto solo no leídas.'],
                    'per_page' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 100],
                ],
                'additionalProperties' => false,
            ],
            isAnalysis: false,
            handler: function (array $args, AssistantInternalApiClient $api): AssistantToolResult {
                try {
                    $data = $api->get('/alerts', [
                        'unread' => ($args['include_acknowledged'] ?? false) ? null : 'true',
                        'work_order_id' => $args['work_order_id'] ?? null,
                        'severity' => $args['severity'] ?? null,
                        'alert_type' => $args['alert_type'] ?? null,
                        'per_page' => $args['per_page'] ?? 30,
                    ]);
                    $rows = is_array($data['data'] ?? null) ? $data['data'] : [];
                    $total = (int) ($data['meta']['total'] ?? $data['total'] ?? count($rows));
                    $dots = [];
                    foreach (array_slice($rows, 0, 10) as $a) {
                        $id = (int) ($a['id'] ?? 0);
                        if ($id <= 0) {
                            continue;
                        }
                        $dots[] = [
                            'type' => 'alert',
                            'id' => $id,
                            'label' => (string) ($a['message'] ?? "Alerta #{$id} (".($a['alert_type'] ?? '?').')'),
                            'href' => AssistantSpaRoutes::hrefFor('alert', $id),
                        ];
                    }

                    return AssistantToolResult::ok([
                        'summary' => "Se encontraron {$total} alertas (mostrando ".count($rows).').',
                        'data' => $data,
                        'dots' => $dots,
                    ]);
                } catch (\Throwable $e) {
                    return AssistantToolResult::fromException($e);
                }
            },
        );
    }

    private function listLowStockMaterialsTool(): AssistantTool
    {
        return new AssistantTool(
            name: 'axones_list_low_stock_materials',
            title: 'Materiales con stock bajo',
            description: 'Lista materiales bajo mínimo (toma del dashboard). Opcionalmente filtra por inventory_area.',
            inputSchema: [
                'type' => 'object',
                'properties' => [
                    'area' => ['type' => 'string', 'minLength' => 1, 'description' => "Inventory_area exacta (ej. 'sustratos', 'tintas')."],
                ],
                'additionalProperties' => false,
            ],
            isAnalysis: false,
            handler: function (array $args, AssistantInternalApiClient $api): AssistantToolResult {
                try {
                    $data = $api->get('/dashboard/summary');
                    $items = is_array($data['materials_low_stock'] ?? null) ? $data['materials_low_stock'] : [];
                    $area = isset($args['area']) ? strtolower(trim((string) $args['area'])) : null;
                    if ($area !== null && $area !== '') {
                        $items = array_values(array_filter($items, static fn ($m): bool => strtolower((string) ($m['inventory_area'] ?? '')) === $area));
                    }
                    $dots = [];
                    foreach (array_slice($items, 0, 10) as $m) {
                        $id = (int) ($m['id'] ?? 0);
                        if ($id <= 0) {
                            continue;
                        }
                        $dots[] = [
                            'type' => 'material',
                            'id' => $id,
                            'label' => trim(($m['sku'] ?? '').' '.($m['name'] ?? '')),
                            'href' => AssistantSpaRoutes::hrefFor('material', $id),
                        ];
                    }
                    $suffix = $area !== null && $area !== '' ? " en {$area}" : '';

                    return AssistantToolResult::ok([
                        'summary' => 'Materiales bajo mínimo: '.count($items).$suffix.'.',
                        'data' => ['count' => count($items), 'items' => $items],
                        'dots' => $dots,
                    ]);
                } catch (\Throwable $e) {
                    return AssistantToolResult::fromException($e);
                }
            },
        );
    }

    private function getMaterialRequestTool(): AssistantTool
    {
        return new AssistantTool(
            name: 'axones_get_material_request',
            title: 'Detalle de solicitud de material',
            description: 'Detalle de una solicitud de material por id.',
            inputSchema: [
                'type' => 'object',
                'properties' => ['id' => ['type' => 'integer', 'minimum' => 1]],
                'required' => ['id'],
                'additionalProperties' => false,
            ],
            isAnalysis: false,
            handler: function (array $args, AssistantInternalApiClient $api): AssistantToolResult {
                $id = isset($args['id']) ? (int) $args['id'] : 0;
                if ($id <= 0) {
                    return AssistantToolResult::fail("Falta 'id' válido.");
                }
                try {
                    $data = $api->get("/material-requests/{$id}");
                    $summary = sprintf(
                        'Solicitud #%d · estado %s · área %s',
                        (int) ($data['id'] ?? $id),
                        (string) ($data['status'] ?? '—'),
                        (string) ($data['area'] ?? '—'),
                    );

                    return AssistantToolResult::ok([
                        'summary' => $summary,
                        'data' => $data,
                        'dots' => [[
                            'type' => 'material_request',
                            'id' => (int) ($data['id'] ?? $id),
                            'label' => "Solicitud #{$id}",
                            'href' => AssistantSpaRoutes::hrefFor('material_request', $id),
                        ]],
                    ]);
                } catch (\Throwable $e) {
                    return AssistantToolResult::fromException($e);
                }
            },
        );
    }

    private function listMaterialRequestsPendingTool(): AssistantTool
    {
        return new AssistantTool(
            name: 'axones_list_material_requests_pending',
            title: 'Solicitudes de material pendientes',
            description: 'Lista solicitudes de material en estado pending o partial.',
            inputSchema: [
                'type' => 'object',
                'properties' => [
                    'area' => ['type' => 'string', 'minLength' => 1],
                    'per_page' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 100],
                ],
                'additionalProperties' => false,
            ],
            isAnalysis: false,
            handler: function (array $args, AssistantInternalApiClient $api): AssistantToolResult {
                try {
                    $collected = [];
                    foreach (['pending', 'partial'] as $status) {
                        $res = $api->get('/material-requests', [
                            'status' => $status,
                            'area' => $args['area'] ?? null,
                            'per_page' => $args['per_page'] ?? 50,
                        ]);
                        if (is_array($res['data'] ?? null)) {
                            foreach ($res['data'] as $row) {
                                $collected[] = $row;
                            }
                        }
                    }
                    $dots = [];
                    foreach (array_slice($collected, 0, 10) as $r) {
                        $id = (int) ($r['id'] ?? 0);
                        if ($id <= 0) {
                            continue;
                        }
                        $dots[] = [
                            'type' => 'material_request',
                            'id' => $id,
                            'label' => "Solicitud #{$id} · ".self::humanMaterialRequestStatus($r['status'] ?? null),
                            'href' => AssistantSpaRoutes::hrefFor('material_request', $id),
                        ];
                    }

                    $count = count($collected);

                    return AssistantToolResult::ok([
                        'summary' => $count === 1
                            ? 'Hay 1 solicitud pendiente de despacho.'
                            : "Hay {$count} solicitudes pendientes de despacho.",
                        'data' => ['count' => count($collected), 'items' => $collected],
                        'dots' => $dots,
                    ]);
                } catch (\Throwable $e) {
                    return AssistantToolResult::fromException($e);
                }
            },
        );
    }

    private function areaRequestsCountsTool(): AssistantTool
    {
        return new AssistantTool(
            name: 'axones_area_requests_counts',
            title: 'Contadores de solicitudes entre áreas',
            description: 'Agregado de solicitudes entre áreas por área y estado. Endpoint: GET /api/area-requests/counts.',
            inputSchema: ['type' => 'object', 'properties' => new \stdClass(), 'additionalProperties' => false],
            isAnalysis: false,
            handler: function (array $_args, AssistantInternalApiClient $api): AssistantToolResult {
                try {
                    $data = $api->get('/area-requests/counts');
                    $pending = 0;
                    foreach ($data as $v) {
                        if (is_int($v)) {
                            $pending += $v;
                        } elseif (is_array($v) && isset($v['pending']) && is_int($v['pending'])) {
                            $pending += $v['pending'];
                        }
                    }

                    return AssistantToolResult::ok([
                        'summary' => $pending === 1
                            ? 'Hay 1 solicitud entre áreas pendiente.'
                            : "Hay {$pending} solicitudes entre áreas pendientes.",
                        'data' => $data,
                    ]);
                } catch (AssistantApiException $e) {
                    if ($e->status === 404) {
                        return AssistantToolResult::fail('Endpoint /area-requests/counts no disponible en esta instalación.');
                    }

                    return AssistantToolResult::fromException($e);
                } catch (\Throwable $e) {
                    return AssistantToolResult::fromException($e);
                }
            },
        );
    }

    private function analyzeScrapTool(): AssistantTool
    {
        return new AssistantTool(
            name: 'axones_analyze_scrap',
            title: 'Analizar desperdicio (scrap) por filtros',
            description: 'Datos de scrap por OT/área en un rango. El modelo debe interpretarlos sin inventar cifras.',
            inputSchema: [
                'type' => 'object',
                'properties' => [
                    'from' => ['type' => 'string', 'pattern' => '^\\d{4}-\\d{2}-\\d{2}$'],
                    'to' => ['type' => 'string', 'pattern' => '^\\d{4}-\\d{2}-\\d{2}$'],
                    'client_id' => ['type' => 'integer', 'minimum' => 1],
                    'product_id' => ['type' => 'integer', 'minimum' => 1],
                    'substrate_group' => ['type' => 'string', 'minLength' => 1],
                    'layout' => ['type' => 'string', 'enum' => ['detail', 'by_work_order', 'by_area', 'history_kg']],
                ],
                'required' => ['from', 'to'],
                'additionalProperties' => false,
            ],
            isAnalysis: true,
            handler: function (array $args, AssistantInternalApiClient $api): AssistantToolResult {
                try {
                    $data = $api->get('/reports/scrap-by-filters', [
                        'from' => $args['from'] ?? null,
                        'to' => $args['to'] ?? null,
                        'client_id' => $args['client_id'] ?? null,
                        'product_id' => $args['product_id'] ?? null,
                        'substrate_group' => $args['substrate_group'] ?? null,
                        'layout' => $args['layout'] ?? 'by_area',
                    ]);
                    $rows = is_array($data['rows'] ?? null) ? count($data['rows']) : 0;

                    return AssistantToolResult::ok([
                        'summary' => "Mermas del {$args['from']} al {$args['to']}: {$rows} registros.",
                        'data' => $data,
                    ]);
                } catch (\Throwable $e) {
                    return AssistantToolResult::fromException($e);
                }
            },
        );
    }

    private function analyzeProductionTimeTool(): AssistantTool
    {
        return new AssistantTool(
            name: 'axones_analyze_production_time',
            title: 'Analizar tiempos de producción por área',
            description: 'Tiempos por área (impresión, laminación, corte, montaje, tintas) en un rango.',
            inputSchema: [
                'type' => 'object',
                'properties' => [
                    'from' => ['type' => 'string', 'pattern' => '^\\d{4}-\\d{2}-\\d{2}$'],
                    'to' => ['type' => 'string', 'pattern' => '^\\d{4}-\\d{2}-\\d{2}$'],
                    'live' => ['type' => 'boolean', 'description' => 'Si true incluye segmentos abiertos.'],
                ],
                'required' => ['from', 'to'],
                'additionalProperties' => false,
            ],
            isAnalysis: true,
            handler: function (array $args, AssistantInternalApiClient $api): AssistantToolResult {
                try {
                    $data = $api->get('/reports/production-time-by-area', [
                        'from' => $args['from'] ?? null,
                        'to' => $args['to'] ?? null,
                        'live' => ($args['live'] ?? false) ? 'true' : null,
                    ]);
                    $rows = is_array($data['rows'] ?? null) ? count($data['rows']) : 0;

                    return AssistantToolResult::ok([
                        'summary' => "Tiempos por área {$args['from']} → {$args['to']} · filas {$rows}",
                        'data' => $data,
                    ]);
                } catch (\Throwable $e) {
                    return AssistantToolResult::fromException($e);
                }
            },
        );
    }

    private function workOrderProductionSummaryTool(): AssistantTool
    {
        return new AssistantTool(
            name: 'axones_work_order_production_summary',
            title: 'Resumen de producción de una OT',
            description: "Resumen consolidado (tiempos por área, materiales, scrap) de una OT. Requiere rol con planilla_read.",
            inputSchema: [
                'type' => 'object',
                'properties' => ['work_order_id' => ['type' => 'integer', 'minimum' => 1]],
                'required' => ['work_order_id'],
                'additionalProperties' => false,
            ],
            isAnalysis: true,
            handler: function (array $args, AssistantInternalApiClient $api): AssistantToolResult {
                $id = (int) ($args['work_order_id'] ?? 0);
                if ($id <= 0) {
                    return AssistantToolResult::fail("Falta 'work_order_id' válido.");
                }
                try {
                    $data = $api->get("/work-orders/{$id}/production-summary");

                    return AssistantToolResult::ok([
                        'summary' => "Resumen de producción de OT #{$id}.",
                        'data' => $data,
                        'dots' => [[
                            'type' => 'work_order',
                            'id' => $id,
                            'label' => "OT #{$id}",
                            'href' => AssistantSpaRoutes::hrefFor('work_order', $id),
                        ]],
                    ]);
                } catch (\Throwable $e) {
                    return AssistantToolResult::fromException($e);
                }
            },
        );
    }

    private function compareDashboardPeriodsTool(): AssistantTool
    {
        return new AssistantTool(
            name: 'axones_compare_dashboard_periods',
            title: 'Comparar dashboard entre dos momentos',
            description: "Snapshot del dashboard actual; con 'baseline' calcula deltas numéricos vs un mapa previo de métricas.",
            inputSchema: [
                'type' => 'object',
                'properties' => [
                    'baseline' => [
                        'type' => 'object',
                        'description' => 'Mapa métrica→valor previo. Si se omite, solo devuelve snapshot.',
                        'additionalProperties' => ['type' => 'number'],
                    ],
                    'baseline_label' => ['type' => 'string', 'minLength' => 1],
                    'current_label' => ['type' => 'string', 'minLength' => 1],
                ],
                'additionalProperties' => false,
            ],
            isAnalysis: true,
            handler: function (array $args, AssistantInternalApiClient $api): AssistantToolResult {
                try {
                    $current = $api->get('/dashboard/summary');
                    $currentNums = self::pickComparable($current);
                    $baseline = is_array($args['baseline'] ?? null) ? $args['baseline'] : null;
                    if ($baseline === null) {
                        return AssistantToolResult::ok([
                            'summary' => 'Resumen actual guardado. Vuelve a consultar más tarde para comparar cambios.',
                            'data' => ['current' => $currentNums, 'current_label' => $args['current_label'] ?? 'ahora'],
                        ]);
                    }
                    $deltas = [];
                    foreach ($currentNums as $k => $c) {
                        if (! isset($baseline[$k]) || ! is_numeric($baseline[$k])) {
                            continue;
                        }
                        $b = (float) $baseline[$k];
                        $delta = $c - $b;
                        $pct = $b === 0.0 ? null : ($delta / $b) * 100;
                        $deltas[$k] = ['baseline' => $b, 'current' => $c, 'delta' => $delta, 'pct' => $pct];
                    }
                    $changed = array_filter($deltas, static fn ($d): bool => $d['delta'] !== 0);
                    uasort($changed, static fn ($a, $b): int => (int) abs($b['delta']) <=> (int) abs($a['delta']));
                    $changed = array_slice($changed, 0, 5, true);
                    $parts = [];
                    foreach ($changed as $k => $v) {
                        $parts[] = "{$k}: {$v['baseline']}→{$v['current']} (Δ{$v['delta']})";
                    }
                    $summary = $parts !== []
                        ? 'Cambios principales: '.implode(' · ', $parts)
                        : 'Sin variaciones en las métricas comparables.';

                    return AssistantToolResult::ok([
                        'summary' => $summary,
                        'data' => [
                            'baseline_label' => $args['baseline_label'] ?? 'antes',
                            'current_label' => $args['current_label'] ?? 'ahora',
                            'deltas' => $deltas,
                            'current_full' => $current,
                        ],
                    ]);
                } catch (\Throwable $e) {
                    return AssistantToolResult::fromException($e);
                }
            },
        );
    }

    private function resolveEntityTool(): AssistantTool
    {
        return new AssistantTool(
            name: 'axones_resolve_entity',
            title: "Resolver entidad a 'dot' (link UI)",
            description: "Dado tipo + id/código devuelve {type,id,label,href} para la UI. Soporta código de OT.",
            inputSchema: [
                'type' => 'object',
                'properties' => [
                    'type' => ['type' => 'string', 'enum' => self::ENTITY_TYPES],
                    'identifier' => [
                        'oneOf' => [['type' => 'integer', 'minimum' => 1], ['type' => 'string', 'minLength' => 1]],
                    ],
                ],
                'required' => ['type', 'identifier'],
                'additionalProperties' => false,
            ],
            isAnalysis: false,
            handler: function (array $args, AssistantInternalApiClient $api): AssistantToolResult {
                $type = (string) ($args['type'] ?? '');
                $identifier = $args['identifier'] ?? null;
                if (! in_array($type, self::ENTITY_TYPES, true) || $identifier === null) {
                    return AssistantToolResult::fail("Tipo o identificador inválido.");
                }
                try {
                    $id = $identifier;
                    $label = null;
                    if ($type === 'work_order' && is_string($identifier) && preg_match(self::WORK_ORDER_CODE_RE, trim($identifier))) {
                        $code = strtoupper(trim($identifier));
                        $list = $api->get('/work-orders', ['q' => $code, 'per_page' => 1]);
                        $found = $list['data'][0] ?? null;
                        if ($found === null) {
                            return AssistantToolResult::fail("No encontré OT con código {$code}.");
                        }
                        $id = (int) $found['id'];
                        $label = (string) $found['code'];
                    } elseif (is_string($identifier) && ctype_digit($identifier)) {
                        $id = (int) $identifier;
                    }
                    $label ??= self::humanType($type)." #{$id}";
                    $dot = [
                        'type' => $type,
                        'id' => $id,
                        'label' => $label,
                        'href' => AssistantSpaRoutes::hrefFor($type, $id),
                    ];

                    return AssistantToolResult::ok([
                        'summary' => $label,
                        'data' => $dot,
                        'dots' => [$dot],
                    ]);
                } catch (\Throwable $e) {
                    return AssistantToolResult::fromException($e);
                }
            },
        );
    }

    private function suggestChipsTool(): AssistantTool
    {
        return new AssistantTool(
            name: 'axones_suggest_chips',
            title: 'Sugerir chips contextuales',
            description: 'Dado el contexto (ruta SPA, entidad enfocada, área del usuario) devuelve chips sugeridos. Reglas estáticas.',
            inputSchema: [
                'type' => 'object',
                'properties' => [
                    'route' => ['type' => 'string', 'minLength' => 1],
                    'entity_type' => ['type' => 'string', 'enum' => self::ENTITY_TYPES],
                    'entity_id' => ['oneOf' => [['type' => 'integer', 'minimum' => 1], ['type' => 'string', 'minLength' => 1]]],
                    'area' => ['type' => 'string', 'enum' => ['impresion', 'laminacion', 'corte', 'montaje', 'tintas', 'inventory', 'general']],
                ],
                'additionalProperties' => false,
            ],
            isAnalysis: false,
            handler: function (array $args, AssistantInternalApiClient $_api): AssistantToolResult {
                $chips = self::buildChips($args);

                return AssistantToolResult::ok([
                    'summary' => 'Sugerencias generadas: '.count($chips),
                    'data' => ['chips' => $chips],
                    'follow_up_chips' => $chips,
                ]);
            },
        );
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,float>
     */
    private static function pickComparable(array $data): array
    {
        $keys = [
            'corte_production_month_kg', 'scrap_month_kg', 'rejected_returns_bobinas_month',
            'materials_total', 'inventory_returns_pending', 'material_requests_pending',
            'work_orders_pending_programming', 'work_orders_in_programming',
            'work_orders_pending_production', 'operational_alerts_unread',
            'tinta_mixtures_total', 'movements_today',
        ];
        $out = [];
        foreach ($keys as $k) {
            if (isset($data[$k]) && is_numeric($data[$k])) {
                $out[$k] = (float) $data[$k];
            }
        }

        return $out;
    }

    /**
     * @param array<string,mixed> $input
     * @return array<int, array{label:string,tool:string,params?:array<string,mixed>}>
     */
    private static function buildChips(array $input): array
    {
        $chips = [];
        $entityType = $input['entity_type'] ?? null;
        $entityId = $input['entity_id'] ?? null;
        $area = $input['area'] ?? null;
        $route = $input['route'] ?? null;

        if ($entityType === 'work_order' && $entityId !== null) {
            $woId = is_string($entityId) && ctype_digit($entityId) ? (int) $entityId : $entityId;
            $chips[] = ['label' => 'Resumen de producción', 'tool' => 'axones_work_order_production_summary', 'params' => ['work_order_id' => $woId]];
            $chips[] = ['label' => 'Alertas de esta OT', 'tool' => 'axones_get_pending_alerts', 'params' => ['work_order_id' => $woId]];
            $chips[] = ['label' => 'Ver detalle', 'tool' => 'axones_get_work_order', 'params' => ['identifier' => $woId]];
        }
        if ($entityType === 'material' && $entityId !== null) {
            $chips[] = ['label' => 'Stock bajo en su área', 'tool' => 'axones_list_low_stock_materials'];
        }
        if (is_string($route) && str_starts_with($route, '/alertas')) {
            $chips[] = ['label' => 'Solo no leídas', 'tool' => 'axones_get_pending_alerts'];
            $chips[] = ['label' => 'Resumen general', 'tool' => 'axones_dashboard_summary'];
        }
        if (is_string($route) && str_starts_with($route, '/solicitudes-material')) {
            $chips[] = ['label' => 'Pendientes ahora', 'tool' => 'axones_list_material_requests_pending'];
        }
        if ($area === 'inventory') {
            $chips[] = ['label' => 'Materiales bajo mínimo', 'tool' => 'axones_list_low_stock_materials'];
            $chips[] = ['label' => 'Solicitudes pendientes', 'tool' => 'axones_list_material_requests_pending'];
        } elseif (is_string($area) && $area !== '' && $area !== 'general') {
            $chips[] = ['label' => "Solicitudes en {$area}", 'tool' => 'axones_list_material_requests_pending', 'params' => ['area' => $area]];
        }
        if ($chips === []) {
            $chips = [
                ['label' => 'Resumen general', 'tool' => 'axones_dashboard_summary'],
                ['label' => 'Alertas pendientes', 'tool' => 'axones_get_pending_alerts'],
                ['label' => 'Solicitudes de material pendientes', 'tool' => 'axones_list_material_requests_pending'],
            ];
        }
        $seen = [];
        $out = [];
        foreach ($chips as $c) {
            $key = $c['tool'].'|'.json_encode($c['params'] ?? new \stdClass());
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $out[] = $c;
            if (count($out) >= 6) {
                break;
            }
        }

        return $out;
    }

    private static function humanType(string $type): string
    {
        return match ($type) {
            'work_order' => 'OT',
            'material' => 'Material',
            'alert' => 'Alerta',
            'material_request' => 'Solicitud de material',
            'area_request' => 'Solicitud entre áreas',
            'client_order' => 'Orden de cliente',
            'delivery_note' => 'Nota de entrega',
            'bobina' => 'Bobina',
            default => $type,
        };
    }

    private static function humanMaterialRequestStatus(mixed $status): string
    {
        return match (strtolower(trim((string) $status))) {
            'pending' => 'Pendiente',
            'partial' => 'Despacho parcial',
            'dispatched' => 'Despachada',
            'cancelled' => 'Cancelada',
            default => $status !== null && trim((string) $status) !== '' ? (string) $status : 'Sin estado',
        };
    }
}
