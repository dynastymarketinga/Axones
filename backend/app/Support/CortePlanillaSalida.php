<?php

namespace App\Support;

/**
 * Extrae kg terminados del formulario OT (planilla / control de corte).
 * Prioridad alineada con el front (corte-turnos.ts).
 */
final class CortePlanillaSalida
{
    public const ROLLOS_PER_PALETA = 48;

    public const ENTRADA_BOBINAS_SLOTS = 30;

    /** Kg máximo aceptable por rollo en paleta (evita metraje/IDs capturados como kg). */
    public const MAX_KG_PER_ROLLO = 10_000.0;

    /** Kg máximo aceptable de salida total en corte por OT. */
    public const MAX_KG_SALIDA_CORTE = 100_000.0;

    /**
     * Normaliza celdas kg (null → '') en arrays del formulario de corte antes de persistir.
     *
     * @param  array<string, mixed>  $form
     * @return array<string, mixed>
     */
    public static function sanitizePersistedFormArrays(array $form): array
    {
        if (isset($form['cor_paletas']) && is_array($form['cor_paletas'])) {
            $form['cor_paletas'] = self::sanitizePaletasArray($form['cor_paletas']);
        }

        if (isset($form['corEntradaBobinasKg']) && is_array($form['corEntradaBobinasKg'])) {
            $form['corEntradaBobinasKg'] = self::sanitizeKgStringArray(
                $form['corEntradaBobinasKg'],
                self::ENTRADA_BOBINAS_SLOTS,
            );
        }

        $actual = $form['corTurnoActual'] ?? null;
        if (is_array($actual)) {
            if (isset($actual['paletas']) && is_array($actual['paletas'])) {
                $actual['paletas'] = self::sanitizePaletasArray($actual['paletas']);
            }
            if (isset($actual['entradaBobinasKg']) && is_array($actual['entradaBobinasKg'])) {
                $actual['entradaBobinasKg'] = self::sanitizeKgStringArray(
                    $actual['entradaBobinasKg'],
                    self::ENTRADA_BOBINAS_SLOTS,
                );
            }
            $form['corTurnoActual'] = $actual;
        }

        return $form;
    }

    /**
     * @param  list<mixed>  $raw
     * @return list<string>
     */
    private static function sanitizeKgStringArray(array $raw, int $size): array
    {
        $out = [];
        foreach (array_slice($raw, 0, $size) as $cell) {
            $out[] = self::kgCellToString($cell);
        }
        while (count($out) < $size) {
            $out[] = '';
        }

        return $out;
    }

    /**
     * @param  list<mixed>  $raw
     * @return list<array<string, mixed>>
     */
    private static function sanitizePaletasArray(array $raw): array
    {
        $out = [];
        foreach ($raw as $paleta) {
            if (! is_array($paleta)) {
                continue;
            }
            $rollos = $paleta['rollosKg'] ?? null;
            if (is_array($rollos)) {
                $paleta['rollosKg'] = self::sanitizeKgStringArray($rollos, self::ROLLOS_PER_PALETA);
            }
            $out[] = $paleta;
        }

        return $out;
    }

    private static function kgCellToString(mixed $cell): string
    {
        if ($cell === null) {
            return '';
        }
        if (is_int($cell) || is_float($cell)) {
            return is_finite((float) $cell) ? (string) $cell : '';
        }
        if (! is_string($cell)) {
            return '';
        }

        return $cell;
    }

    /**
     * @param  array<string, mixed>  $form
     */
    public static function isPaletaCerradaStatus(mixed $status): bool
    {
        $s = strtolower(trim((string) $status));

        return $s === 'cerrada' || $s === 'cerrada_opcional';
    }

    /**
     * @param  array<string, mixed>  $form
     * @return list<array<string, mixed>>
     */
    public static function closedPaletasFromForm(array $form): array
    {
        $out = [];
        foreach (self::paletasArrayFromForm($form) as $paleta) {
            if (! is_array($paleta)) {
                continue;
            }
            if (! self::isPaletaCerradaStatus($paleta['status'] ?? null)) {
                continue;
            }
            $out[] = $paleta;
        }

        return $out;
    }

    /**
     * Paletas aún en progreso (no cerradas).
     *
     * @param  array<string, mixed>  $form
     * @return list<array<string, mixed>>
     */
    public static function openPaletasFromForm(array $form): array
    {
        $out = [];
        foreach (self::paletasArrayFromForm($form) as $paleta) {
            if (! is_array($paleta)) {
                continue;
            }
            if (self::isPaletaCerradaStatus($paleta['status'] ?? null)) {
                continue;
            }
            $out[] = $paleta;
        }

        return $out;
    }

    /**
     * Paletas abiertas con al menos un rollo con peso (saldo provisional en despacho).
     *
     * @param  array<string, mixed>  $form
     * @return list<array<string, mixed>>
     */
    public static function openPaletasWithKgFromForm(array $form): array
    {
        $out = [];
        foreach (self::openPaletasFromForm($form) as $paleta) {
            if (self::sumPaletaKg($paleta) > 0) {
                $out[] = $paleta;
            }
        }

        return $out;
    }

    /**
     * Kg despachables: solo paletas cerradas (acumulativo por cierre de paleta).
     *
     * @param  array<string, mixed>  $form
     */
    public static function dispatchableFinishedKgFromForm(array $form): string
    {
        $sum = 0.0;
        foreach (self::closedPaletasFromForm($form) as $paleta) {
            $sum += self::sumPaletaKg($paleta);
        }
        if ($sum > 0) {
            return number_format($sum, 3, '.', '');
        }

        return '0.000';
    }

    /**
     * @param  array<string, mixed>  $paleta
     */
    public static function sumPaletaKg(array $paleta): float
    {
        $rollos = $paleta['rollosKg'] ?? null;
        if (! is_array($rollos)) {
            return 0.0;
        }
        $sum = 0.0;
        foreach ($rollos as $kg) {
            $sum += self::readPlausibleRollKg($kg);
        }

        return $sum;
    }

    /**
     * Kg salida en planilla (todas las paletas, abiertas + cerradas) para producción.
     *
     * @param  array<string, mixed>  $form
     */
    public static function finishedKgFromForm(array $form): string
    {
        $fromSalida = self::parsePositiveKg($form['kgSalidaCorte'] ?? null);
        if ($fromSalida !== null && self::isPlausibleSalidaKg((float) $fromSalida)) {
            return $fromSalida;
        }

        $fromAcum = self::parsePositiveKg($form['corAcumuladoProducidoKg'] ?? null);
        if ($fromAcum !== null && self::isPlausibleSalidaKg((float) $fromAcum)) {
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

    /**
     * Todas las paletas de la OT: cor_turnos (historial), turno activo y cor_paletas (prioridad creciente).
     *
     * @param  array<string, mixed>  $form
     * @return list<array<string, mixed>>
     */
    public static function paletasArrayFromForm(array $form): array
    {
        $byId = [];
        foreach (self::paletasSourcesFromForm($form) as $batch) {
            foreach ($batch as $paleta) {
                if (! is_array($paleta)) {
                    continue;
                }
                $id = trim((string) ($paleta['id'] ?? ''));
                if ($id === '') {
                    continue;
                }
                $byId[$id] = self::mergePaletaEntries($byId[$id] ?? null, $paleta);
            }
        }

        return array_values($byId);
    }

    /**
     * @param  array<string, mixed>  $form
     * @return list<list<array<string, mixed>>>
     */
    private static function paletasSourcesFromForm(array $form): array
    {
        $sources = [];
        foreach ((array) ($form['cor_turnos'] ?? []) as $turn) {
            if (! is_array($turn)) {
                continue;
            }
            $paletas = $turn['paletas'] ?? null;
            if (is_array($paletas) && $paletas !== []) {
                $sources[] = $paletas;
            }
        }
        $turno = $form['corTurnoActual'] ?? $form['cor_turno_actual'] ?? null;
        if (is_array($turno) && is_array($turno['paletas'] ?? null) && $turno['paletas'] !== []) {
            $sources[] = $turno['paletas'];
        }
        $raw = $form['cor_paletas'] ?? null;
        if (is_array($raw) && $raw !== []) {
            $sources[] = $raw;
        }

        return $sources;
    }

    /**
     * @param  array<string, mixed>|null  $existing
     * @param  array<string, mixed>  $incoming
     * @return array<string, mixed>
     */
    private static function mergePaletaEntries(?array $existing, array $incoming): array
    {
        if ($existing === null) {
            return self::sanitizePaletaShape($incoming);
        }
        $existingRollos = is_array($existing['rollosKg'] ?? null) ? $existing['rollosKg'] : [];
        $incomingRollos = is_array($incoming['rollosKg'] ?? null) ? $incoming['rollosKg'] : [];
        $mergedRollos = [];
        for ($i = 0; $i < self::ROLLOS_PER_PALETA; $i++) {
            $a = self::readNumber($existingRollos[$i] ?? 0);
            $b = self::readNumber($incomingRollos[$i] ?? 0);
            $mergedRollos[] = $b > $a ? self::kgCellToString($incomingRollos[$i] ?? '') : self::kgCellToString($existingRollos[$i] ?? '');
        }
        $closed = self::isPaletaCerradaStatus($existing['status'] ?? null)
            || self::isPaletaCerradaStatus($incoming['status'] ?? null);
        $status = $closed
            ? (self::isPaletaCerradaStatus($incoming['status'] ?? null)
                ? (string) ($incoming['status'] ?? 'cerrada')
                : (string) ($existing['status'] ?? 'cerrada'))
            : 'en_progreso';

        return self::sanitizePaletaShape([
            ...$existing,
            ...$incoming,
            'label' => trim((string) ($incoming['label'] ?? '')) !== ''
                ? (string) $incoming['label']
                : (string) ($existing['label'] ?? ''),
            'rollosKg' => $mergedRollos,
            'status' => $status,
            'closed_at' => $existing['closed_at'] ?? $incoming['closed_at'] ?? null,
        ]);
    }

    /**
     * @param  array<string, mixed>  $paleta
     * @return array<string, mixed>
     */
    private static function sanitizePaletaShape(array $paleta): array
    {
        if (isset($paleta['rollosKg']) && is_array($paleta['rollosKg'])) {
            $paleta['rollosKg'] = self::sanitizeKgStringArray($paleta['rollosKg'], self::ROLLOS_PER_PALETA);
        }

        return $paleta;
    }

    /**
     * @param  array<string, mixed>  $form
     * @return list<mixed>
     * @deprecated Use paletasArrayFromForm; kept for callers expecting legacy single-source list.
     */
    public static function paletasArrayFromFormLegacyTopOnly(array $form): array
    {
        $raw = $form['cor_paletas'] ?? null;
        if (is_array($raw) && $raw !== []) {
            return $raw;
        }
        $turno = $form['corTurnoActual'] ?? $form['cor_turno_actual'] ?? null;
        if (is_array($turno) && is_array($turno['paletas'] ?? null)) {
            return $turno['paletas'];
        }

        return [];
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
            $sum += self::sumPaletaKg($paleta);
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

    public static function readPlausibleRollKg(mixed $v): float
    {
        $n = self::readNumber($v);
        if ($n <= 0 || $n > self::MAX_KG_PER_ROLLO) {
            return 0.0;
        }

        return $n;
    }

    public static function isPlausibleSalidaKg(float $kg): bool
    {
        return $kg > 0 && $kg <= self::MAX_KG_SALIDA_CORTE;
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
