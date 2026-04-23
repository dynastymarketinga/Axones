<?php

namespace App\Enums;

/**
 * Programación mínima (PDF §3.A): columna antes de “programación” = pendiente por OT.
 */
enum WorkOrderSchedulingStatus: string
{
    /** Aún no entra al tablero de programación (pendiente de orden de trabajo / cola previa). */
    case PendingProgramming = 'pending_programming';

    /** Ya asignada o visible en programación. */
    case InProgramming = 'in_programming';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
