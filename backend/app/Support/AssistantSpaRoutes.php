<?php

namespace App\Support;

/**
 * Port en PHP de bot/src/util/spa-routes.ts. Construye rutas SPA para los
 * "dots" que devuelven las tools del asistente. No incluye dominio: la SPA
 * navega con rutas relativas. Si en el futuro se quisiera hacer absolutas, se
 * resolvería en el frontend con su propia base.
 */
final class AssistantSpaRoutes
{
    public static function hrefFor(string $type, int|string $id): string
    {
        $sid = rawurlencode((string) $id);

        return match ($type) {
            'work_order' => "/ordenes-trabajo/{$sid}",
            'material' => "/materiales/{$sid}",
            'alert' => "/alertas?focus={$sid}",
            'material_request' => "/solicitudes-material/{$sid}",
            'area_request' => "/solicitudes-area?focus={$sid}",
            'client_order' => "/ordenes-cliente/{$sid}",
            'delivery_note' => "/notas-entrega/{$sid}",
            'bobina' => "/bobinas/{$sid}",
            default => '/'.rawurlencode($type)."/{$sid}",
        };
    }
}
