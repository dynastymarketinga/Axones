<?php

namespace App\Support;

/**
 * Líneas de catálogo de tintas (demo) — nombre, presentación (Superficie/Laminada/…), SKU.
 */
final class DemoTintaCatalogRows
{
    /**
     * @return list<array{name: string, presentacion: string, sku: string}>
     */
    public static function all(): array
    {
        $rows = [
            ['name' => 'AMARILLO', 'presentacion' => 'Superficie', 'sku' => 'BF-1564'],
            ['name' => 'AMARILLO PROCESO', 'presentacion' => 'Laminada', 'sku' => 'BL-1132'],
            ['name' => 'AMARILLO PROCESO', 'presentacion' => 'Superficie', 'sku' => 'TINSUP-0002'],
            ['name' => 'AMARILLO PROCESO', 'presentacion' => 'Laminada', 'sku' => 'TINLAM-0002'],
            ['name' => 'AZUL 293', 'presentacion' => 'Superficie', 'sku' => 'BF-1857'],
            ['name' => 'AZUL BUDARE LAMINACION', 'presentacion' => 'Laminada', 'sku' => 'BL-2260'],
            ['name' => 'AZUL ESPIGA SUPERIOR', 'presentacion' => 'Laminada', 'sku' => 'BL-2164'],
            ['name' => 'AZUL FONDO SUPERIOR', 'presentacion' => 'Laminada', 'sku' => 'BL-2163'],
            ['name' => 'AZUL PROCESO', 'presentacion' => 'Laminada', 'sku' => 'TINLAM-0003'],
            ['name' => 'AZUL PROCESO', 'presentacion' => 'Laminada', 'sku' => 'BL-1535'],
            ['name' => 'AZUL PROCESO FLEXO SUPERFICIE', 'presentacion' => 'Superficie', 'sku' => 'BF-0134'],
            ['name' => 'AZUL REFLEX', 'presentacion' => 'Superficie', 'sku' => 'BF-1570'],
            ['name' => 'BARNIZ SOBRE IMPRE', 'presentacion' => 'Superficie', 'sku' => 'BN-1692'],
            ['name' => 'BEIGE (TINTA FLEX)', 'presentacion' => 'Laminada', 'sku' => '467 8018 (17KG)'],
            ['name' => 'BLANCO', 'presentacion' => 'Laminada', 'sku' => 'BL-2036'],
            ['name' => 'BLANCO', 'presentacion' => 'Prueba Lam.', 'sku' => 'BL-1745'],
            ['name' => 'BLANCO', 'presentacion' => 'Superficie', 'sku' => 'BN-1093'],
            ['name' => 'BLANCO LAMINACION', 'presentacion' => 'Laminada', 'sku' => 'TINLAM-0001'],
            ['name' => 'COMPUESTO DE CERA', 'presentacion' => 'Laminada', 'sku' => 'SP-0915'],
            ['name' => 'CREMA ALVARIGUA', 'presentacion' => 'Laminada', 'sku' => 'BL-2136'],
            ['name' => 'CREMA AMANECER (BARNIVENCA)', 'presentacion' => 'Laminada', 'sku' => '2042'],
            ['name' => 'CREMA AMANECER (FAVICA)', 'presentacion' => 'Laminada', 'sku' => 'FL 1024 (20KG)'],
            ['name' => 'CREMA MARY', 'presentacion' => 'Laminada', 'sku' => 'BL-2169'],
            ['name' => 'CYAN', 'presentacion' => 'Superficie', 'sku' => 'BN-1650'],
            ['name' => 'CYAN', 'presentacion' => 'Laminada', 'sku' => 'BL-1964'],
            ['name' => 'DORADO ALVARIGUA', 'presentacion' => 'Superficie', 'sku' => 'BF-1874'],
            ['name' => 'DORADO ALVARIGUA', 'presentacion' => 'Laminada', 'sku' => 'BL-2134'],
            ['name' => 'EXTENDER', 'presentacion' => 'Laminada', 'sku' => 'TINLAM-0006'],
            ['name' => 'EXTENDER', 'presentacion' => 'Laminada', 'sku' => 'BL-1883'],
            ['name' => 'MAGENTA', 'presentacion' => 'Superficie', 'sku' => 'BF-1718'],
            ['name' => 'MAGENTA', 'presentacion' => 'Laminada', 'sku' => 'BL-1706'],
            ['name' => 'MAGENTA', 'presentacion' => 'Superficie', 'sku' => 'BN-1649'],
            ['name' => 'MAGENTA TRAMA DIGITAL', 'presentacion' => 'Laminada', 'sku' => 'BL-2003'],
            ['name' => 'MARRON AMANECER', 'presentacion' => 'Laminada', 'sku' => '30125 (17KG)'],
            ['name' => 'MARRON P-4725 LAMINACION', 'presentacion' => 'Laminada', 'sku' => 'BL-2210'],
            ['name' => 'MORADO NONNA', 'presentacion' => 'Laminada', 'sku' => 'DL FL 30136'],
            ['name' => 'NARANJA 021', 'presentacion' => 'Laminada', 'sku' => 'BL-0985'],
            ['name' => 'NARANJA 021', 'presentacion' => 'Superficie', 'sku' => 'BF-1757'],
            ['name' => 'NARANJA BUDARE LAMINACION', 'presentacion' => 'Laminada', 'sku' => 'BL-2259'],
            ['name' => 'NARANJA MARY', 'presentacion' => 'Laminada', 'sku' => 'BL-2152'],
            ['name' => 'NEGRO', 'presentacion' => 'Superficie', 'sku' => 'BF-0387'],
            ['name' => 'NEGRO', 'presentacion' => 'Laminada', 'sku' => 'BL-2054'],
            ['name' => 'NEGRO', 'presentacion' => 'Laminada', 'sku' => 'TINLAM-0005'],
            ['name' => 'NEGRO POLYESTER', 'presentacion' => 'Laminada', 'sku' => 'TINLAM-0008'],
            ['name' => 'NEGRO POLYESTER', 'presentacion' => 'Laminada', 'sku' => 'BL-1280'],
            ['name' => 'OCRE ESPIGA MARY', 'presentacion' => 'Laminada', 'sku' => 'BL-2170'],
            ['name' => 'REFLEX', 'presentacion' => 'Laminada', 'sku' => 'BL-1007'],
            ['name' => 'ROJO 485 C', 'presentacion' => 'Laminada', 'sku' => 'BL-2037'],
            ['name' => 'ROJO 485 2X', 'presentacion' => 'Superficie', 'sku' => 'BN-1674'],
            ['name' => 'ROJO 485 2X', 'presentacion' => 'Laminada', 'sku' => 'BL-0897'],
            ['name' => 'ROJO P-485 2X-C', 'presentacion' => 'Laminada', 'sku' => 'TINLAM-0007'],
            ['name' => 'VERDE C', 'presentacion' => 'Laminada', 'sku' => 'BL-1718'],
            ['name' => 'VERDE P 340-C', 'presentacion' => 'Laminada', 'sku' => 'BL-2162'],
            ['name' => 'VERDE 355', 'presentacion' => 'Laminada', 'sku' => 'BL-2119'],
            ['name' => 'VERDE BABO', 'presentacion' => 'Laminada', 'sku' => 'BL-2188'],
            ['name' => 'VERDE DAMASCO', 'presentacion' => 'Laminada', 'sku' => 'BL-2105'],
            ['name' => 'VERDE MARY LAMINACION', 'presentacion' => 'Laminada', 'sku' => 'BL-1913'],
            ['name' => 'VIOLETA PANTONE', 'presentacion' => 'Laminada', 'sku' => 'VIO-PAN-0001'],
        ];

        return $rows;
    }
}
