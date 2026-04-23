<?php

namespace App\Enums;

/**
 * Áreas de destino del formulario físico "Solicitud de materiales y repuestos".
 */
enum MaterialRequestDestinationArea: string
{
    case Presidencia = 'presidencia';
    case Administracion = 'administracion';
    case Mantenimiento = 'mantenimiento';
    case ServiciosGenerales = 'servicios_generales';
    case Vigilancia = 'vigilancia';
    case Almacen = 'almacen';
    case Produccion = 'produccion';
    case Montaje = 'montaje';
    case Otros = 'otros';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
