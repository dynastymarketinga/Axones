<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAreaRole
{
    private const FULL_ACCESS_ROLES = ['boss', 'admin', 'jefe_supremo', 'superadmin', 'jefe_operaciones'];

    private const ROLE_BY_AREA = [
        'inventory' => ['inventory', 'inventario', 'inventory_chief', 'jefe_inventario', 'jefe_almacen', 'planificador', 'supervisor'],
        'printing' => ['printing', 'impresion', 'planificador', 'supervisor'],
        'laminacion' => ['laminacion', 'planificador', 'supervisor'],
        'corte' => ['corte', 'planificador', 'supervisor'],
        'tintas' => ['tintas', 'planificador', 'supervisor'],
        'montaje' => ['montaje', 'planificador', 'supervisor'],
        /** @deprecated Usar planilla_read / planilla_write; se mantiene por compatibilidad. */
        'planilla' => ['printing', 'impresion', 'laminacion', 'corte', 'tintas', 'calidad', 'planificador', 'supervisor'],
        /** Lectura de planilla técnica + resumen producción (incluye operadores de impresión). */
        'planilla_read' => ['printing', 'impresion', 'laminacion', 'corte', 'tintas', 'calidad', 'quality', 'planificador', 'supervisor'],
        /** Escritura planilla completa y PATCH de OT; excluye operadores que solo usan control de impresión. */
        'planilla_write' => ['laminacion', 'corte', 'tintas', 'calidad', 'quality', 'planificador', 'supervisor'],
    ];

    public function handle(Request $request, Closure $next, string $area): Response
    {
        $user = $request->user();
        $role = strtolower(trim((string) ($user?->role ?? '')));

        if (in_array($role, self::FULL_ACCESS_ROLES, true)) {
            return $next($request);
        }

        $allowedRoles = self::ROLE_BY_AREA[strtolower(trim($area))] ?? [];
        if (! in_array($role, $allowedRoles, true)) {
            return response()->json([
                'message' => 'No autorizado para esta área.',
            ], 403);
        }

        return $next($request);
    }
}
