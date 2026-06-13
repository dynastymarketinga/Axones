<?php

namespace App\Services\Assistant;

/**
 * Resuelve mensajes de usuario (o chips con tool explícita) a una tool Axones
 * sin LLM. Reglas estáticas: etiquetas de chips, palabras clave y contexto SPA.
 */
final class AssistantLocalIntentRouter
{
    private const WORK_ORDER_CODE_RE = '/\b(OT-\d{4}-\d{1,6})\b/i';

    /**
     * @param  array{
     *     message:string,
     *     context?:array<string,mixed>,
     *     tool?:?string,
     *     tool_params?:?array<string,mixed>,
     *     force_analysis?:bool
     * }  $payload
     * @return array{tool:string,params:array<string,mixed>}|array{message:string}|null
     */
    public function resolve(array $payload): ?array
    {
        $directTool = trim((string) ($payload['tool'] ?? ''));
        if ($directTool !== '' && str_starts_with($directTool, 'axones_')) {
            $params = is_array($payload['tool_params'] ?? null) ? $payload['tool_params'] : [];

            return ['tool' => $directTool, 'params' => $params];
        }

        $message = trim((string) ($payload['message'] ?? ''));
        if ($message === '') {
            return null;
        }

        $normalized = mb_strtolower($message);
        $context = is_array($payload['context'] ?? null) ? $payload['context'] : [];
        $workOrderId = $this->workOrderIdFromContext($context);

        if ($this->isGreeting($normalized)) {
            return ['message' => 'Hola. Soy el asistente de Axones. Consulto datos reales del sistema '
                .'(resumen general, alertas, inventario, solicitudes y órdenes de trabajo). Elige una sugerencia o escribe tu consulta.'];
        }

        if ($this->isHelp($normalized)) {
            return ['message' => 'Puedo consultar: resumen general, alertas pendientes, materiales bajo mínimo, '
                .'solicitudes de material, detalle de una orden (ej. OT-2026-00001) y análisis de mermas o tiempos '
                .'con «Análisis profundo». Todo es solo lectura.'];
        }

        if ($this->isThanks($normalized)) {
            return ['message' => 'De nada. Si necesitas otra consulta, usa las sugerencias o escríbeme.'];
        }

        $chipMatch = $this->matchChipLabel($normalized, $workOrderId, $context);
        if ($chipMatch !== null) {
            return $chipMatch;
        }

        if (preg_match(self::WORK_ORDER_CODE_RE, $message, $matches) === 1) {
            return [
                'tool' => 'axones_get_work_order',
                'params' => ['identifier' => strtoupper($matches[1])],
            ];
        }

        if ($workOrderId !== null && $this->mentions($normalized, ['producción', 'produccion', 'planilla'])) {
            return [
                'tool' => 'axones_work_order_production_summary',
                'params' => ['work_order_id' => $workOrderId],
            ];
        }

        if ($this->mentions($normalized, ['ping', 'api viva', 'está viva', 'esta viva', 'conexión', 'conexion'])) {
            return ['tool' => 'axones_ping', 'params' => []];
        }

        if ($this->mentions($normalized, ['dashboard', 'resumen general', 'resumen del dashboard', 'panel'])) {
            return ['tool' => 'axones_dashboard_summary', 'params' => []];
        }

        if ($this->mentions($normalized, ['alerta', 'alertas', 'no leída', 'no leida', 'pendiente'])) {
            $params = [];
            if ($workOrderId !== null) {
                $params['work_order_id'] = $workOrderId;
            }

            return ['tool' => 'axones_get_pending_alerts', 'params' => $params];
        }

        if ($this->mentions($normalized, ['stock bajo', 'bajo mínimo', 'bajo minimo', 'inventario bajo', 'materiales bajo'])) {
            return ['tool' => 'axones_list_low_stock_materials', 'params' => []];
        }

        if ($this->mentions($normalized, ['solicitud', 'solicitudes', 'material pendiente', 'pedido de material'])) {
            $params = [];
            $area = $context['area'] ?? null;
            if (is_string($area) && $area !== '' && $area !== 'general' && $area !== 'inventory') {
                $params['area'] = $area;
            }

            return ['tool' => 'axones_list_material_requests_pending', 'params' => $params];
        }

        if ($this->mentions($normalized, ['órdenes de trabajo', 'ordenes de trabajo', 'listar ot', 'listar ots', 'buscar ot'])) {
            return ['tool' => 'axones_list_work_orders', 'params' => ['limit' => 10]];
        }

        if ($this->mentions($normalized, ['área', 'area', 'solicitudes por área', 'solicitudes por area', 'conteo'])) {
            return ['tool' => 'axones_area_requests_counts', 'params' => []];
        }

        if ($this->mentions($normalized, ['comparar', 'comparación', 'comparacion', 'período', 'periodo', 'evolución', 'evolucion'])) {
            return ['tool' => 'axones_compare_dashboard_periods', 'params' => []];
        }

        if ((bool) ($payload['force_analysis'] ?? false) || $this->mentions($normalized, ['merma', 'scrap', 'desperdicio'])) {
            $range = $this->defaultDateRange();

            return [
                'tool' => 'axones_analyze_scrap',
                'params' => ['from' => $range['from'], 'to' => $range['to'], 'layout' => 'by_area'],
            ];
        }

        if ($this->mentions($normalized, ['tiempo', 'tiempos', 'producción por área', 'produccion por area'])) {
            $range = $this->defaultDateRange();

            return [
                'tool' => 'axones_analyze_production_time',
                'params' => ['from' => $range['from'], 'to' => $range['to']],
            ];
        }

        if ($workOrderId !== null && $this->mentions($normalized, ['detalle', 'ver ot', 'esta ot', 'esta orden'])) {
            return [
                'tool' => 'axones_get_work_order',
                'params' => ['identifier' => $workOrderId],
            ];
        }

        if (ctype_digit($message)) {
            return [
                'tool' => 'axones_get_work_order',
                'params' => ['identifier' => (int) $message],
            ];
        }

        return null;
    }

    /**
     * @param  array<string,mixed>  $context
     */
    private function workOrderIdFromContext(array $context): ?int
    {
        if (($context['entity_type'] ?? null) !== 'work_order') {
            return null;
        }
        $entityId = $context['entity_id'] ?? null;
        if (is_int($entityId) && $entityId > 0) {
            return $entityId;
        }
        if (is_string($entityId) && ctype_digit($entityId)) {
            return (int) $entityId;
        }

        return null;
    }

    /**
     * @param  array<string,mixed>  $context
     * @return array{tool:string,params:array<string,mixed>}|null
     */
    private function matchChipLabel(string $normalized, ?int $workOrderId, array $context): ?array
    {
        $area = is_string($context['area'] ?? null) ? $context['area'] : null;

        $rules = [
            'resumen de producción' => ['tool' => 'axones_work_order_production_summary', 'wo' => true],
            'alertas de esta ot' => ['tool' => 'axones_get_pending_alerts', 'wo' => true],
            'ver detalle' => ['tool' => 'axones_get_work_order', 'wo' => true],
            'stock bajo en su área' => ['tool' => 'axones_list_low_stock_materials'],
            'solo no leídas' => ['tool' => 'axones_get_pending_alerts'],
            'resumen general' => ['tool' => 'axones_dashboard_summary'],
            'resumen del dashboard' => ['tool' => 'axones_dashboard_summary'],
            'pendientes ahora' => ['tool' => 'axones_list_material_requests_pending'],
            'materiales bajo mínimo' => ['tool' => 'axones_list_low_stock_materials'],
            'solicitudes pendientes' => ['tool' => 'axones_list_material_requests_pending'],
            'alertas pendientes' => ['tool' => 'axones_get_pending_alerts'],
            'solicitudes de material pendientes' => ['tool' => 'axones_list_material_requests_pending'],
        ];

        foreach ($rules as $label => $rule) {
            if ($normalized !== $label) {
                continue;
            }
            $params = [];
            if (! empty($rule['wo'])) {
                if ($workOrderId === null) {
                    return null;
                }
                $tool = (string) $rule['tool'];
                if ($tool === 'axones_work_order_production_summary') {
                    $params['work_order_id'] = $workOrderId;
                } elseif ($tool === 'axones_get_pending_alerts') {
                    $params['work_order_id'] = $workOrderId;
                } else {
                    $params['identifier'] = $workOrderId;
                }

                return ['tool' => $tool, 'params' => $params];
            }

            return ['tool' => (string) $rule['tool'], 'params' => $params];
        }

        if ($area !== null && $area !== '' && $area !== 'general' && $area !== 'inventory') {
            $prefix = "solicitudes en {$area}";
            if ($normalized === $prefix) {
                return [
                    'tool' => 'axones_list_material_requests_pending',
                    'params' => ['area' => $area],
                ];
            }
        }

        return null;
    }

    private function isGreeting(string $normalized): bool
    {
        $greetings = [
            'hola', 'buenos días', 'buenos dias', 'buenas tardes', 'buenas noches',
            'buen día', 'buen dia', 'qué tal', 'que tal', 'saludos', 'hey', 'hi',
        ];
        foreach ($greetings as $greeting) {
            if ($normalized === $greeting || str_starts_with($normalized, $greeting.' ')
                || str_starts_with($normalized, $greeting.'!') || str_starts_with($normalized, $greeting.',')) {
                return true;
            }
        }

        return false;
    }

    private function isHelp(string $normalized): bool
    {
        return $this->mentions($normalized, [
            'ayuda', 'qué puedes', 'que puedes', 'qué sabes', 'que sabes',
            'qué haces', 'que haces', 'cómo funciona', 'como funciona', 'qué puedo preguntar', 'que puedo preguntar',
        ]);
    }

    private function isThanks(string $normalized): bool
    {
        $thanks = ['gracias', 'muchas gracias', 'ok gracias', 'perfecto gracias', 'genial gracias'];
        foreach ($thanks as $t) {
            if ($normalized === $t || str_starts_with($normalized, $t)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<int, string>  $needles
     */
    private function mentions(string $haystack, array $needles): bool
    {
        foreach ($needles as $needle) {
            if (str_contains($haystack, $needle)) {
                return true;
            }
        }

        return false;
    }

    /** @return array{from:string,to:string} */
    private function defaultDateRange(): array
    {
        $to = new \DateTimeImmutable('today');
        $from = $to->sub(new \DateInterval('P7D'));

        return [
            'from' => $from->format('Y-m-d'),
            'to' => $to->format('Y-m-d'),
        ];
    }
}
