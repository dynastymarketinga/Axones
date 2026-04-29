<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAreaRole
{
    private const FULL_ACCESS_ROLES = ['boss', 'admin', 'jefe_supremo', 'superadmin'];

    private const ROLE_BY_AREA = [
        'printing' => ['printing', 'impresion'],
        'laminacion' => ['laminacion'],
        'corte' => ['corte'],
        // Montaje queda reservado a perfiles de planificación/jefatura por ahora.
        'montaje' => [],
        /** @deprecated Usar planilla_read / planilla_write; se mantiene por compatibilidad. */
        'planilla' => ['printing', 'impresion', 'laminacion', 'corte', 'tintas', 'calidad'],
        /** Lectura de planilla técnica + resumen producción (incluye operadores de impresión). */
        'planilla_read' => ['printing', 'impresion', 'laminacion', 'corte', 'tintas', 'calidad', 'quality'],
        /** Escritura planilla completa y PATCH de OT; excluye operadores que solo usan control de impresión. */
        'planilla_write' => ['laminacion', 'corte', 'tintas', 'calidad', 'quality'],
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
