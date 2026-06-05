<?php

namespace App\Support;

/**
 * Kg de salida (material producido) desde planilla JSON + historial de turnos MES.
 * Alineado con printing-turnos.ts / laminacion-turnos.ts / corte-turnos.ts.
 */
final class PlanillaSalidaAggregator
{
    /**
     * @param  array<string, mixed>|null  $form
     * @return array{entrada_kg: float, salida_kg: float, salida_bobinas: int}
     */
    public static function resolvePrintingSalida(?array $form): array
    {
        $entradaKg = 0.0;
        $salidaKg = 0.0;
        $salidaBobinas = 0;

        if ($form === null) {
            return compact('entradaKg', 'salidaKg', 'salidaBobinas');
        }

        foreach (self::printingTurns($form) as $turn) {
            $tot = self::printingTurnTotals($turn);
            $entradaKg += $tot['entrada_kg'];
            $salidaKg += $tot['salida_kg'];
            $salidaBobinas += $tot['salida_bobinas'];
        }

        if ($salidaKg < 0.0005) {
            $salidaKg = self::readKg($form['impAcumuladoProducidoKg'] ?? null);
        }
        if ($salidaKg < 0.0005) {
            [$salidaKg, $salidaBobinas] = self::flatBobinaSalidaTotals(
                $form,
                'impSalidaBobinasKg',
                'impSalidaBobinasMeta',
            );
        }

        return [
            'entrada_kg' => round($entradaKg, 3),
            'salida_kg' => round($salidaKg, 3),
            'salida_bobinas' => $salidaBobinas,
        ];
    }

    /**
     * @param  array<string, mixed>|null  $form
     * @return array{entrada_virgen_kg: float, salida_kg: float, salida_bobinas: int}
     */
    public static function resolveLaminacionSalida(?array $form): array
    {
        $entradaVirgenKg = 0.0;
        $salidaKg = 0.0;
        $salidaBobinas = 0;

        if ($form === null) {
            return [
                'entrada_virgen_kg' => 0.0,
                'salida_kg' => 0.0,
                'salida_bobinas' => 0,
            ];
        }

        foreach (self::laminacionTurns($form) as $turn) {
            $entradaVirgenKg += self::sumSeriesKg($turn['entradaVirgenBobinasKg'] ?? []);
            $tot = self::laminacionTurnSalidaTotals($turn);
            $salidaKg += $tot['salida_kg'];
            $salidaBobinas += $tot['salida_bobinas'];
        }

        if ($salidaKg < 0.0005) {
            $salidaKg = self::readKg($form['lamAcumuladoProducidoKg'] ?? null);
        }
        if ($salidaKg < 0.0005) {
            [$salidaKg, $salidaBobinas] = self::flatBobinaSalidaTotals(
                $form,
                'lamSalidaBobinasKg',
                'lamSalidaBobinasMeta',
            );
        }

        return [
            'entrada_virgen_kg' => round($entradaVirgenKg, 3),
            'salida_kg' => round($salidaKg, 3),
            'salida_bobinas' => $salidaBobinas,
        ];
    }

    /**
     * @param  array<string, mixed>|null  $form
     * @return array{salida_kg: float}
     */
    public static function resolveCorteSalida(?array $form): array
    {
        if ($form === null) {
            return ['salida_kg' => 0.0];
        }

        $fromTurns = 0.0;
        foreach ((array) ($form['cor_turnos'] ?? []) as $turn) {
            if (is_array($turn)) {
                $fromTurns += self::corteTurnSalidaKg($turn);
            }
        }

        $actual = $form['corTurnoActual'] ?? $form['cor_turno_actual'] ?? null;
        if (is_array($actual)) {
            $fromTurns += self::corteTurnSalidaKg($actual);
        }

        $fromForm = (float) CortePlanillaSalida::finishedKgFromForm($form);

        return ['salida_kg' => round(max($fromTurns, $fromForm), 3)];
    }

    /**
     * @param  array<string, mixed>  $form
     * @return list<array<string, mixed>>
     */
    private static function printingTurns(array $form): array
    {
        $turns = [];
        foreach ((array) ($form['impTurnosImpresion'] ?? []) as $turn) {
            if (is_array($turn)) {
                $turns[] = $turn;
            }
        }
        $actual = $form['impTurnoActual'] ?? null;
        if (is_array($actual)) {
            $turns[] = $actual;
        }

        return $turns;
    }

    /**
     * @param  array<string, mixed>  $form
     * @return list<array<string, mixed>>
     */
    private static function laminacionTurns(array $form): array
    {
        $turns = [];
        foreach ((array) ($form['lamTurnosLaminacion'] ?? []) as $turn) {
            if (is_array($turn)) {
                $turns[] = $turn;
            }
        }
        $actual = $form['lamTurnoActual'] ?? null;
        if (is_array($actual)) {
            $turns[] = $actual;
        }

        return $turns;
    }

    /**
     * @param  array<string, mixed>  $turn
     * @return array{entrada_kg: float, salida_kg: float, salida_bobinas: int}
     */
    private static function printingTurnTotals(array $turn): array
    {
        $entradaKg = 0.0;
        $salidaKg = 0.0;
        $salidaBobinas = 0;

        foreach ((array) ($turn['capturas'] ?? []) as $cap) {
            if (! is_array($cap)) {
                continue;
            }
            $entradaKg += self::sumSeriesKg($cap['entradaBobinasKg'] ?? []);
            self::accumulateSalidaFromBobinaSeries(
                $salidaKg,
                $salidaBobinas,
                (array) ($cap['salidaBobinasKg'] ?? []),
                (array) ($cap['salidaBobinasMeta'] ?? []),
            );
        }

        $entradaKg += self::sumSeriesKg($turn['entradaBobinasKg'] ?? []);
        self::accumulateSalidaFromBobinaSeries(
            $salidaKg,
            $salidaBobinas,
            (array) ($turn['salidaBobinasKg'] ?? []),
            (array) ($turn['salidaBobinasMeta'] ?? []),
        );

        if ($salidaKg < 0.0005) {
            $resumen = $turn['resumenCierre'] ?? null;
            if (is_array($resumen)) {
                $salidaKg = self::readKg($resumen['pesoSalidaKg'] ?? null);
                if ($salidaBobinas === 0 && isset($resumen['numBobinasSalida'])) {
                    $salidaBobinas = (int) $resumen['numBobinasSalida'];
                }
            }
        }

        return [
            'entrada_kg' => round($entradaKg, 3),
            'salida_kg' => round($salidaKg, 3),
            'salida_bobinas' => $salidaBobinas,
        ];
    }

    /**
     * @param  array<string, mixed>  $turn
     * @return array{salida_kg: float, salida_bobinas: int}
     */
    private static function laminacionTurnSalidaTotals(array $turn): array
    {
        $salidaKg = 0.0;
        $salidaBobinas = 0;
        self::accumulateSalidaFromBobinaSeries(
            $salidaKg,
            $salidaBobinas,
            (array) ($turn['salidaBobinasKg'] ?? []),
            (array) ($turn['salidaBobinasMeta'] ?? []),
        );

        return [
            'salida_kg' => round($salidaKg, 3),
            'salida_bobinas' => $salidaBobinas,
        ];
    }

    /**
     * @param  array<string, mixed>  $turn
     */
    private static function corteTurnSalidaKg(array $turn): float
    {
        $metrics = $turn['metrics'] ?? null;
        if (is_array($metrics)) {
            $fromMetrics = self::readKg($metrics['salida_total_kg'] ?? null);
            if ($fromMetrics > 0) {
                return $fromMetrics;
            }
        }

        $sum = 0.0;
        foreach ((array) ($turn['paletas'] ?? []) as $paleta) {
            if (is_array($paleta)) {
                $sum += CortePlanillaSalida::sumPaletaKg($paleta);
            }
        }

        return $sum;
    }

    /**
     * @param  array<string, mixed>  $form
     * @return array{0: float, 1: int}
     */
    private static function flatBobinaSalidaTotals(array $form, string $slotsKey, string $metaKey): array
    {
        $salidaKg = 0.0;
        $salidaBobinas = 0;
        self::accumulateSalidaFromBobinaSeries(
            $salidaKg,
            $salidaBobinas,
            (array) ($form[$slotsKey] ?? []),
            (array) ($form[$metaKey] ?? []),
        );

        return [round($salidaKg, 3), $salidaBobinas];
    }

    /**
     * @param  array<int|string, mixed>  $slots
     * @param  array<int|string, mixed>  $metas
     */
    private static function accumulateSalidaFromBobinaSeries(
        float &$salidaKg,
        int &$salidaBobinas,
        array $slots,
        array $metas,
    ): void {
        $size = max(count($slots), count($metas));
        for ($i = 0; $i < $size; $i++) {
            $kg = self::salidaKgFromSlotAndMeta($slots[$i] ?? null, $metas[$i] ?? null);
            if ($kg < 0.0005) {
                continue;
            }
            $salidaKg += $kg;
            $salidaBobinas++;
        }
    }

    /**
     * @param  array<string, mixed>|null  $meta
     */
    private static function salidaKgFromSlotAndMeta(mixed $slot, mixed $meta): float
    {
        $fromSlot = self::readKg($slot);
        if ($fromSlot > 0) {
            return $fromSlot;
        }
        if (! is_array($meta)) {
            return 0.0;
        }

        return self::readKg($meta['peso'] ?? null);
    }

    /**
     * @param  array<int|string, mixed>  $series
     */
    private static function sumSeriesKg(array $series): float
    {
        $sum = 0.0;
        foreach ($series as $value) {
            $sum += self::readKg($value);
        }

        return round($sum, 3);
    }

    private static function readKg(mixed $raw): float
    {
        if ($raw === null || $raw === '') {
            return 0.0;
        }
        if (is_numeric($raw)) {
            $n = (float) $raw;

            return is_finite($n) && $n > 0 ? round($n, 3) : 0.0;
        }
        $s = trim(str_replace(',', '.', (string) $raw));
        if ($s === '' || ! is_numeric($s)) {
            return 0.0;
        }
        $n = (float) $s;

        return is_finite($n) && $n > 0 ? round($n, 3) : 0.0;
    }
}
