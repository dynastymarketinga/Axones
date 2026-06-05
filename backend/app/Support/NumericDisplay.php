<?php

namespace App\Support;

final class NumericDisplay
{
    /**
     * Muestra cantidades sin ceros decimales innecesarios (p. ej. 300 en lugar de 300.000).
     */
    public static function formatQuantity(string|int|float|null $value, int $maxFractionDigits = 3): string
    {
        $raw = trim((string) ($value ?? ''));
        if ($raw === '') {
            return '0';
        }

        $normalized = str_replace(',', '.', $raw);
        if (! is_numeric($normalized)) {
            return $raw;
        }

        $n = (float) $normalized;
        if (abs($n - round($n)) < 1e-9) {
            return (string) (int) round($n);
        }

        $fixed = number_format($n, $maxFractionDigits, '.', '');
        $fixed = preg_replace('/(\.\d*?)0+$/', '$1', $fixed) ?? $fixed;

        return rtrim($fixed, '.');
    }
}
