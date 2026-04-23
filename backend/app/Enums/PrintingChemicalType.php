<?php

namespace App\Enums;

enum PrintingChemicalType: string
{
    case Alcohol = 'alcohol';

    /** Metoxipropanol / Metoxil */
    case Metoxil = 'metoxil';

    /** N-Propil acetato / NPA */
    case Npa = 'npa';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
