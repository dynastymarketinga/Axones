<?php

namespace App\Enums;

/**
 * Columnas del tablero Kanban de programación (public/programacion.html, programacion.js).
 */
enum WorkOrderBoardStage: string
{
    case Nueva = 'nueva';

    case Pendiente = 'pendiente';

    case Montaje = 'montaje';

    case Impresion = 'impresion';

    case Laminacion = 'laminacion';

    case Corte = 'corte';

    case Completada = 'completada';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
