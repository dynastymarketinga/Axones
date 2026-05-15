<?php

namespace App\Support;

/**
 * Extrae kg terminados del formulario OT (planilla / control de corte).
 * Prioridad alineada con el front (corte-turnos.ts).
 */
final class CortePlanillaSalida
{
    public const ROLLOS_PER_PALETA = 48;

    /**
     * @param  array<string, mixed>  $form
     */
    public static function finishedKgFromForm(array $form): string
    {
        $fromSalida = self::parsePositiveKg($form['kgSalidaCorte'] ?? null);
        if ($fromSalida !== null) {
            return $fromSalida;
        }

        $fromAcum = self::parsePositiveKg($form['corAcumuladoProducidoKg'] ?? null);
        if ($fromAcum !== null) {
            return $fromAcum;
        }

        $fromPaletas = self::sumSalidaKgFromPaletasInForm($form);
        if ($fromPaletas > 0) {
            return number_format($fromPaletas, 3, '.', '');
        }

        return '0.000';
    }

    /**
     * @param  array<string, mixed>  $form
     */
    public static function usedKgFromForm(array $form): string
    {
        $ingresados = self::parseNonNegativeKg($form['kgIngresadosCorte'] ?? null);
        if ($ingresados !== null) {
            return $ingresados;
        }

        return '0.000';
    }

    /**
     * @param  array<string, mixed>  $form
     */
    public static function sumSalidaKgFromPaletasInForm(array $form): float
    {
        $sum = self::sumPaletasArray($form['cor_paletas'] ?? null);

        if ($sum <= 0) {
            $sum = self::sumLegacyPaletas($form['corSalidaPaletasKg'] ?? null);
        }

        if ($sum <= 0) {
            $turno = $form['corTurnoActual'] ?? $form['cor_turno_actual'] ?? null;
            if (is_array($turno)) {
                $sum = self::sumPaletasArray($turno['paletas'] ?? null);
            }
        }

        return $sum;
    }

    private static function parsePositiveKg(mixed $raw): ?string
    {
        $parsed = self::parseNonNegativeKg($raw);
        if ($parsed === null) {
            return null;
        }

        return bccomp($parsed, '0', 3) > 0 ? $parsed : null;
    }

    private static function parseNonNegativeKg(mixed $raw): ?string
    {
        if ($raw === null || $raw === '') {
            return null;
        }

        $s = trim(str_replace(',', '.', (string) $raw));
        if ($s === '' || ! is_numeric($s)) {
            return null;
        }

        $n = (float) $s;
        if (! is_finite($n) || $n < 0) {
            return null;
        }

        return number_format($n, 3, '.', '');
    }

    private static function sumPaletasArray(mixed $raw): float
    {
        if (! is_array($raw)) {
            return 0.0;
        }

        $sum = 0.0;
        foreach ($raw as $paleta) {
            if (! is_array($paleta)) {
                continue;
            }
            $rollos = $paleta['rollosKg'] ?? null;
            if (! is_array($rollos)) {
                continue;
            }
            foreach ($rollos as $kg) {
                $sum += self::readNumber($kg);
            }
        }

        return $sum;
    }

    private static function sumLegacyPaletas(mixed $raw): float
    {
        if (! is_array($raw)) {
            return 0.0;
        }

        $sum = 0.0;
        foreach ($raw as $paletaRollos) {
            if (! is_array($paletaRollos)) {
                continue;
            }
            foreach ($paletaRollos as $kg) {
                $sum += self::readNumber($kg);
            }
        }

        return $sum;
    }

    private static function readNumber(mixed $v): float
    {
        if (is_int($v) || is_float($v)) {
            return is_finite((float) $v) ? (float) $v : 0.0;
        }
        if (! is_string($v)) {
            return 0.0;
        }
        $s = trim(str_replace(',', '.', $v));
        if ($s === '' || ! is_numeric($s)) {
            return 0.0;
        }
        $n = (float) $s;

        return is_finite($n) ? $n : 0.0;
    }
}
