<?php

namespace App\Support;

/**
 * Cálculos automáticos del área de montaje en la planilla OT.
 * - Desarrollo (mm) = frecuencia × N° repetición
 * - Ancho montaje (mm) = ancho corte × N° bandas
 */
final class MontajePlanillaMetrics
{
    /**
     * Sugiere desarrollo/ancho montaje solo si el campo viene vacío (respeta valores manuales).
     *
     * @param  array<string, mixed>  $form
     * @return array<string, mixed>
     */
    public static function applyAutoFields(array $form): array
    {
        if (trim((string) ($form['desarrollo'] ?? '')) === '') {
            $desarrollo = self::computeDesarrollo(
                $form['frecuencia'] ?? null,
                $form['numRepeticion'] ?? null,
            );
            if ($desarrollo !== '') {
                $form['desarrollo'] = $desarrollo;
            }
        }

        if (trim((string) ($form['anchoMontaje'] ?? '')) === '') {
            $anchoMontaje = self::computeAnchoMontaje(
                $form['anchoCorteMontaje'] ?? null,
                $form['numBandas'] ?? null,
            );
            if ($anchoMontaje !== '') {
                $form['anchoMontaje'] = $anchoMontaje;
            }
        }

        return $form;
    }

    public static function computeDesarrollo(mixed $frecuencia, mixed $numRepeticion): string
    {
        $freq = self::parseMetricParts($frecuencia);
        $rep = self::parsePositiveInt($numRepeticion);
        if ($freq === null || $rep === null) {
            return '';
        }

        return self::formatMetricValue($freq['nominal'] * $rep, $freq['tolerance'] * $rep);
    }

    public static function computeAnchoMontaje(mixed $anchoCorteMontaje, mixed $numBandas): string
    {
        $ancho = self::parseMetricParts($anchoCorteMontaje);
        $bandas = self::parsePositiveInt($numBandas);
        if ($ancho === null || $bandas === null) {
            return '';
        }

        return self::formatMetricValue($ancho['nominal'] * $bandas, $ancho['tolerance'] * $bandas);
    }

    /**
     * @return array{nominal: float, tolerance: float}|null
     */
    private static function parseMetricParts(mixed $raw): ?array
    {
        $s = trim(str_replace(',', '.', (string) $raw));
        if ($s === '') {
            return null;
        }

        if (preg_match('/^(\d+(?:\.\d+)?)\s*±\s*(\d+(?:\.\d+)?)$/u', $s, $m)) {
            return ['nominal' => (float) $m[1], 'tolerance' => (float) $m[2]];
        }

        if (preg_match('/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/u', $s, $m)) {
            $low = (float) $m[1];
            $high = (float) $m[2];

            return ['nominal' => ($low + $high) / 2, 'tolerance' => abs($high - $low) / 2];
        }

        if (preg_match('/^(\d+(?:\.\d+)?)$/u', $s, $m)) {
            return ['nominal' => (float) $m[1], 'tolerance' => 0.0];
        }

        return null;
    }

    private static function parsePositiveInt(mixed $raw): ?int
    {
        $s = trim((string) $raw);
        if ($s === '' || ! preg_match('/^\d+$/', $s)) {
            return null;
        }
        $n = (int) $s;

        return $n > 0 ? $n : null;
    }

    private static function formatMetricValue(float $nominal, float $tolerance): string
    {
        $n = self::formatNumber($nominal);
        if ($tolerance <= 0) {
            return $n;
        }

        return $n.'±'.self::formatNumber($tolerance);
    }

    private static function formatNumber(float $value): string
    {
        if (abs($value - round($value)) < 1e-9) {
            return (string) (int) round($value);
        }

        $s = number_format($value, 3, '.', '');
        $s = rtrim(rtrim($s, '0'), '.');

        return $s;
    }
}
