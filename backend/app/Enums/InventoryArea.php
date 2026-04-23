<?php

namespace App\Enums;

enum InventoryArea: string
{
    case Material = 'material';
    case Tintas = 'tintas';
    case CementerioTintas = 'cementerio_tintas';
    case Quimicos = 'quimicos';
    case BobinasRechazadas = 'bobinas_rechazadas';
    case Miscelaneos = 'miscelaneos';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
