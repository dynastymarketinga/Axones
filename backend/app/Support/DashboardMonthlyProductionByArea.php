<?php

namespace App\Support;

use App\Enums\WorkOrderStatus;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Kg de salida producidos por área y mes (turnos cerrados en planilla + mezclas tintas).
 */
final class DashboardMonthlyProductionByArea
{
    /**
     * @return list<array{
     *   label: string,
     *   month_key: string,
     *   montaje_kg: string,
     *   impresion_kg: string,
     *   laminacion_kg: string,
     *   corte_kg: string,
     *   tintas_kg: string,
     *   total_kg: string
     * }>
     */
    public static function rows(int $months = 5): array
    {
        $months = max(1, min($months, 12));
        $now = now();
        $anchor = $now->copy()->startOfMonth();
        $oldest = $anchor->copy()->subMonths($months - 1);

        /** @var array<string, array{montaje: float, impresion: float, laminacion: float, corte: float, tintas: float}> */
        $buckets = [];
        for ($i = $months - 1; $i >= 0; $i--) {
            $monthStart = $anchor->copy()->subMonths($i);
            $key = $monthStart->format('Y-m');
            $buckets[$key] = [
                'montaje' => 0.0,
                'impresion' => 0.0,
                'laminacion' => 0.0,
                'corte' => 0.0,
                'tintas' => 0.0,
            ];
        }

        $forms = DB::table('work_order_technical_documents as td')
            ->join('work_orders as wo', 'wo.id', '=', 'td.work_order_id')
            ->where('wo.status', '!=', WorkOrderStatus::Cancelled->value)
            ->whereNotNull('td.form')
            ->get(['td.form']);

        foreach ($forms as $row) {
            $form = self::decodeForm($row->form);
            if ($form === null) {
                continue;
            }

            self::accumulatePrinting($form, $buckets, $oldest, $now);
            self::accumulateMontaje($form, $buckets, $oldest, $now);
            self::accumulateLaminacion($form, $buckets, $oldest, $now);
            self::accumulateCorte($form, $buckets, $oldest, $now);
        }

        self::accumulateTintas($buckets, $oldest, $now);

        $out = [];
        foreach ($buckets as $monthKey => $totals) {
            $monthStart = Carbon::createFromFormat('Y-m', $monthKey)->startOfMonth();
            $total = array_sum($totals);
            $out[] = [
                'label' => $monthStart->translatedFormat('M Y'),
                'month_key' => $monthKey,
                'montaje_kg' => number_format($totals['montaje'], 3, '.', ''),
                'impresion_kg' => number_format($totals['impresion'], 3, '.', ''),
                'laminacion_kg' => number_format($totals['laminacion'], 3, '.', ''),
                'corte_kg' => number_format($totals['corte'], 3, '.', ''),
                'tintas_kg' => number_format($totals['tintas'], 3, '.', ''),
                'total_kg' => number_format($total, 3, '.', ''),
            ];
        }

        return $out;
    }

    /**
     * @param  array<string, array{montaje: float, impresion: float, laminacion: float, corte: float, tintas: float}>  $buckets
     * @param  array<string, mixed>  $form
     */
    private static function accumulatePrinting(array $form, array &$buckets, Carbon $oldest, Carbon $now): void
    {
        foreach (['impTurnosImpresion', 'impTurnoActual'] as $key) {
            $items = $key === 'impTurnoActual'
                ? (isset($form[$key]) && is_array($form[$key]) ? [$form[$key]] : [])
                : (array) ($form[$key] ?? []);

            foreach ($items as $turn) {
                if (! is_array($turn)) {
                    continue;
                }
                if ($key === 'impTurnoActual' && ! empty($turn['closed_at'])) {
                    // turno actual cerrado en el mismo array
                } elseif ($key === 'impTurnoActual' && empty($turn['closed_at'])) {
                    continue;
                }

                $closedAt = isset($turn['closed_at']) ? trim((string) $turn['closed_at']) : '';
                if ($closedAt === '' && $key !== 'impTurnoActual') {
                    continue;
                }
                if ($key === 'impTurnoActual') {
                    $started = isset($turn['started_at']) ? trim((string) $turn['started_at']) : '';
                    if ($closedAt === '' && $started === '') {
                        continue;
                    }
                    $when = $closedAt !== '' ? $closedAt : $started;
                } else {
                    $when = $closedAt;
                }

                $monthKey = self::monthKeyForTimestamp($when, $oldest, $now);
                if ($monthKey === null) {
                    continue;
                }

                $buckets[$monthKey]['impresion'] += self::printingTurnSalidaKg($turn);
            }
        }
    }

    /**
     * @param  array<string, array{montaje: float, impresion: float, laminacion: float, corte: float, tintas: float}>  $buckets
     * @param  array<string, mixed>  $form
     */
    private static function accumulateMontaje(array $form, array &$buckets, Carbon $oldest, Carbon $now): void
    {
        foreach ((array) ($form['montTurnosMontaje'] ?? []) as $turn) {
            if (! is_array($turn)) {
                continue;
            }
            $closedAt = isset($turn['closed_at']) ? trim((string) $turn['closed_at']) : '';
            if ($closedAt === '') {
                continue;
            }
            $monthKey = self::monthKeyForTimestamp($closedAt, $oldest, $now);
            if ($monthKey === null) {
                continue;
            }
            $buckets[$monthKey]['montaje'] += self::montajeTurnProduccionKg($turn);
        }

        $actual = $form['montTurnoActual'] ?? null;
        if (is_array($actual)) {
            $when = trim((string) ($actual['closed_at'] ?? ''));
            if ($when === '') {
                $when = trim((string) ($actual['started_at'] ?? ''));
            }
            if ($when !== '') {
                $monthKey = self::monthKeyForTimestamp($when, $oldest, $now);
                if ($monthKey !== null) {
                    $buckets[$monthKey]['montaje'] += self::montajeTurnProduccionKg($actual);
                }
            }
        }
    }

    /**
     * @param  array<string, mixed>  $turn
     */
    private static function montajeTurnProduccionKg(array $turn): float
    {
        $kg = self::readKg($turn['kgProduccion'] ?? null);
        if ($kg > 0.0005) {
            return $kg;
        }

        return self::readKg($turn['montKgProduccion'] ?? null);
    }

    /**
     * @param  array<string, array{montaje: float, impresion: float, laminacion: float, corte: float, tintas: float}>  $buckets
     * @param  array<string, mixed>  $form
     */
    private static function accumulateLaminacion(array $form, array &$buckets, Carbon $oldest, Carbon $now): void
    {
        foreach ((array) ($form['lamTurnosLaminacion'] ?? []) as $turn) {
            if (! is_array($turn)) {
                continue;
            }
            $closedAt = isset($turn['closed_at']) ? trim((string) $turn['closed_at']) : '';
            if ($closedAt === '') {
                continue;
            }
            $monthKey = self::monthKeyForTimestamp($closedAt, $oldest, $now);
            if ($monthKey === null) {
                continue;
            }
            $buckets[$monthKey]['laminacion'] += self::laminacionTurnSalidaKg($turn);
        }

        $actual = $form['lamTurnoActual'] ?? null;
        if (is_array($actual)) {
            $started = isset($actual['started_at']) ? trim((string) $actual['started_at']) : '';
            if ($started !== '') {
                $monthKey = self::monthKeyForTimestamp($started, $oldest, $now);
                if ($monthKey !== null) {
                    $buckets[$monthKey]['laminacion'] += self::laminacionTurnSalidaKg($actual);
                }
            }
        }

        foreach ((array) ($form['lamTurnosHistorial'] ?? []) as $entry) {
            if (! is_array($entry)) {
                continue;
            }
            $closedAt = isset($entry['closed_at']) ? trim((string) $entry['closed_at']) : '';
            if ($closedAt === '') {
                continue;
            }
            $monthKey = self::monthKeyForTimestamp($closedAt, $oldest, $now);
            if ($monthKey === null) {
                continue;
            }
            $buckets[$monthKey]['laminacion'] += self::readKg($entry['total_salida_kg'] ?? null);
        }
    }

    /**
     * @param  array<string, array{montaje: float, impresion: float, laminacion: float, corte: float, tintas: float}>  $buckets
     * @param  array<string, mixed>  $form
     */
    private static function accumulateCorte(array $form, array &$buckets, Carbon $oldest, Carbon $now): void
    {
        foreach ((array) ($form['cor_turnos'] ?? []) as $turn) {
            if (! is_array($turn)) {
                continue;
            }
            $closedAt = isset($turn['closed_at']) ? trim((string) $turn['closed_at']) : '';
            if ($closedAt === '') {
                continue;
            }
            $monthKey = self::monthKeyForTimestamp($closedAt, $oldest, $now);
            if ($monthKey === null) {
                continue;
            }
            $buckets[$monthKey]['corte'] += self::corteTurnSalidaKg($turn);
        }

        $actual = $form['corTurnoActual'] ?? $form['cor_turno_actual'] ?? null;
        if (is_array($actual)) {
            $started = isset($actual['started_at']) ? trim((string) $actual['started_at']) : '';
            if ($started !== '') {
                $monthKey = self::monthKeyForTimestamp($started, $oldest, $now);
                if ($monthKey !== null) {
                    $buckets[$monthKey]['corte'] += self::corteTurnSalidaKg($actual);
                }
            }
        }
    }

    /**
     * @param  array<string, array{montaje: float, impresion: float, laminacion: float, corte: float, tintas: float}>  $buckets
     */
    private static function accumulateTintas(array &$buckets, Carbon $oldest, Carbon $now): void
    {
        $driver = DB::connection()->getDriverName();
        $monthExpr = $driver === 'sqlite'
            ? "strftime('%Y-%m', tm.created_at)"
            : "DATE_FORMAT(tm.created_at, '%Y-%m')";

        $totals = DB::table('tinta_mixture_components as tmc')
            ->join('tinta_mixtures as tm', 'tm.id', '=', 'tmc.tinta_mixture_id')
            ->whereBetween('tm.created_at', [$oldest, $now->copy()->endOfDay()])
            ->selectRaw("{$monthExpr} as month_key")
            ->selectRaw('SUM(tmc.quantity) as total_kg')
            ->groupBy('month_key')
            ->pluck('total_kg', 'month_key');

        foreach ($totals as $monthKey => $kg) {
            if (! isset($buckets[$monthKey])) {
                continue;
            }
            $buckets[$monthKey]['tintas'] += (float) $kg;
        }
    }

    /**
     * @param  array<string, mixed>  $turn
     */
    private static function printingTurnSalidaKg(array $turn): float
    {
        $salida = 0.0;

        foreach ((array) ($turn['capturas'] ?? []) as $cap) {
            if (! is_array($cap)) {
                continue;
            }
            foreach ((array) ($cap['salidaBobinasKg'] ?? []) as $value) {
                $salida += self::readKg($value);
            }
        }

        foreach ((array) ($turn['salidaBobinasKg'] ?? []) as $value) {
            $salida += self::readKg($value);
        }

        if ($salida < 0.0005) {
            $resumen = $turn['resumenCierre'] ?? null;
            if (is_array($resumen)) {
                $salida = self::readKg($resumen['pesoSalidaKg'] ?? null);
            }
        }

        return $salida;
    }

    /**
     * @param  array<string, mixed>  $turn
     */
    private static function laminacionTurnSalidaKg(array $turn): float
    {
        $salida = 0.0;
        foreach ((array) ($turn['salidaBobinasKg'] ?? []) as $value) {
            $salida += self::readKg($value);
        }

        return $salida;
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
            if (! is_array($paleta)) {
                continue;
            }
            $sum += CortePlanillaSalida::sumPaletaKg($paleta);
        }

        return $sum;
    }

    private static function monthKeyForTimestamp(string $raw, Carbon $oldest, Carbon $now): ?string
    {
        if ($raw === '') {
            return null;
        }
        try {
            $dt = Carbon::parse($raw);
        } catch (\Throwable) {
            return null;
        }

        if ($dt->lt($oldest) || $dt->gt($now->copy()->endOfDay())) {
            return null;
        }

        return $dt->format('Y-m');
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function decodeForm(mixed $raw): ?array
    {
        if (is_array($raw)) {
            return $raw;
        }
        if (! is_string($raw) || trim($raw) === '') {
            return null;
        }
        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : null;
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
