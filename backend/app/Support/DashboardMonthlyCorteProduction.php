<?php

namespace App\Support;

use App\Enums\WorkOrderStatus;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Producción acumulada del área Corte en un período (turnos cerrados + turno abierto del mes).
 */
final class DashboardMonthlyCorteProduction
{
    public static function totalKgBetween(Carbon $from, Carbon $to): string
    {
        $fromBound = $from->copy()->startOfDay();
        $toBound = $to->copy()->endOfDay();
        $fromDate = $fromBound->toDateString();
        $toDate = $toBound->toDateString();

        $rows = DB::table('work_order_technical_documents as td')
            ->join('work_orders as wo', 'wo.id', '=', 'td.work_order_id')
            ->where('wo.status', '!=', WorkOrderStatus::Cancelled->value)
            ->whereNotNull('td.form')
            ->where(function ($q) use ($fromBound, $toBound, $fromDate, $toDate) {
                $q->whereBetween('wo.created_at', [$fromBound, $toBound])
                    ->orWhereBetween('wo.document_date', [$fromDate, $toDate])
                    ->orWhereBetween('td.updated_at', [$fromBound, $toBound]);
            })
            ->get(['td.form']);

        $total = 0.0;
        foreach ($rows as $row) {
            $form = self::decodeForm($row->form);
            if ($form === null) {
                continue;
            }
            $total += self::productionKgFromFormInPeriod($form, $fromBound, $toBound);
        }

        return number_format($total, 3, '.', '');
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

    /**
     * @param  array<string, mixed>  $form
     */
    private static function productionKgFromFormInPeriod(array $form, Carbon $from, Carbon $to): float
    {
        $fromTurns = 0.0;
        $hasTurnRows = false;

        foreach ((array) ($form['cor_turnos'] ?? []) as $turn) {
            if (! is_array($turn)) {
                continue;
            }
            $hasTurnRows = true;
            $closedAt = isset($turn['closed_at']) ? trim((string) $turn['closed_at']) : '';
            if ($closedAt === '') {
                continue;
            }
            try {
                $closed = Carbon::parse($closedAt);
            } catch (\Throwable) {
                continue;
            }
            if ($closed->between($from, $to)) {
                $fromTurns += self::turnSalidaKg($turn);
            }
        }

        $actual = $form['corTurnoActual'] ?? $form['cor_turno_actual'] ?? null;
        if (is_array($actual)) {
            $hasTurnRows = true;
            $startedRaw = isset($actual['started_at']) ? trim((string) $actual['started_at']) : '';
            if ($startedRaw !== '') {
                try {
                    $started = Carbon::parse($startedRaw);
                    if ($started->between($from, $to)) {
                        $fromTurns += self::turnSalidaKg($actual);
                    }
                } catch (\Throwable) {
                    // ignore invalid date
                }
            }
        }

        if ($hasTurnRows) {
            return $fromTurns;
        }

        $finished = (float) CortePlanillaSalida::finishedKgFromForm($form);
        if ($finished < 0.0005) {
            return 0.0;
        }

        return $finished;
    }

    /**
     * @param  array<string, mixed>  $turn
     */
    private static function turnSalidaKg(array $turn): float
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

    private static function readKg(mixed $raw): float
    {
        if ($raw === null || $raw === '') {
            return 0.0;
        }
        if (is_numeric($raw)) {
            $n = (float) $raw;

            return is_finite($n) && $n > 0 ? $n : 0.0;
        }
        $s = trim(str_replace(',', '.', (string) $raw));
        if ($s === '' || ! is_numeric($s)) {
            return 0.0;
        }
        $n = (float) $s;

        return is_finite($n) && $n > 0 ? $n : 0.0;
    }
}
