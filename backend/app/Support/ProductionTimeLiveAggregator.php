<?php

namespace App\Support;

use App\Services\CorteTurnosSegmentSyncService;
use App\Services\MontajeTurnosSegmentSyncService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Suma turnos en curso al reporte en pantalla (segmentos abiertos en BD + cronómetro Montaje en planilla).
 */
final class ProductionTimeLiveAggregator
{
    /** Sin Tintas: esa área no usa cronómetro en reportes de planta. */
    private const AREA_TABLES = [
        'printing' => 'printing_time_segments',
        'corte' => 'corte_time_segments',
        'laminacion' => 'laminacion_time_segments',
        'montaje' => 'montaje_time_segments',
    ];

    public function __construct(
        private readonly MontajeTurnosSegmentSyncService $montajeTurnos,
        private readonly CorteTurnosSegmentSyncService $corteTurnos,
    ) {}

    /**
     * @param  list<array{area: string, segment_type: string, machine_code: string, total_seconds: int, segment_count: int}>  $closedRows
     * @return list<array{area: string, segment_type: string, machine_code: string, total_seconds: int, segment_count: int}>
     */
    public function augmentAreaRows(array $closedRows, Carbon $from, Carbon $to): array
    {
        $asOf = $this->resolveAsOf($to);
        $activeMontajeTurnos = $this->montajeTurnos->activeTurnoIdsByWorkOrder();
        $activeCorteTurnos = $this->corteTurnos->activeTurnoIdsByWorkOrder();

        $rows = $this->filterMontajeClosedRows($closedRows, $activeMontajeTurnos);
        $rows = $this->filterCorteClosedRows($rows, $activeCorteTurnos);

        foreach (self::AREA_TABLES as $area => $table) {
            $rows = array_merge($rows, $this->openSegmentsForTable($table, $area, $from, $to, $asOf));
        }

        $rows = array_merge($rows, $this->montajeTurnos->livePlanillaAreaRows($from, $to, $asOf));
        $rows = array_merge($rows, $this->corteTurnos->livePlanillaAreaRows($from, $to, $asOf));

        return $this->mergeRows($rows);
    }

    /**
     * @param  array<int, array{areas: array<string, true>, production_seconds: int, downtime_seconds: int, mount_seconds: int, demount_seconds: int}>  $byWo
     * @return array<int, array{areas: array<string, true>, production_seconds: int, downtime_seconds: int, mount_seconds: int, demount_seconds: int}>
     */
    public function augmentByWorkOrder(array $byWo, Carbon $from, Carbon $to): array
    {
        $asOf = $this->resolveAsOf($to);
        $activeMontajeTurnos = $this->montajeTurnos->activeTurnoIdsByWorkOrder();
        $activeCorteTurnos = $this->corteTurnos->activeTurnoIdsByWorkOrder();

        foreach (self::AREA_TABLES as $area => $table) {
            $this->applyOpenSegmentsByWorkOrder($byWo, $table, $area, $from, $to, $asOf);
        }

        $this->applyMontajePlanillaByWorkOrder($byWo, $from, $to, $asOf, $activeMontajeTurnos);
        $this->applyCortePlanillaByWorkOrder($byWo, $from, $to, $asOf, $activeCorteTurnos);

        return $byWo;
    }

    /**
     * OT con cronómetro activo (segmento abierto en BD o turno Montaje abierto en planilla).
     *
     * @return list<array{
     *   area: string,
     *   work_order_id: int,
     *   work_order_code: string,
     *   segment_types: list<string>,
     *   machine_codes: list<string>
     * }>
     */
    public function collectLiveActiveEntries(Carbon $from, Carbon $to): array
    {
        $asOf = $this->resolveAsOf($to);

        /** @var array<string, array<int, array{segment_types: array<string, true>, machine_codes: array<string, true>}>> */
        $byAreaWo = [];

        foreach (self::AREA_TABLES as $area => $table) {
            $segments = DB::table($table)
                ->whereNull('ended_at')
                ->where('started_at', '<=', $to)
                ->get(['work_order_id', 'segment_type', 'machine_code', 'started_at']);

            foreach ($segments as $seg) {
                $woId = (int) $seg->work_order_id;
                if ($woId < 1) {
                    continue;
                }

                try {
                    $started = Carbon::parse((string) $seg->started_at);
                } catch (\Throwable) {
                    continue;
                }

                $effectiveStart = $started->greaterThan($from) ? $started : $from->copy();
                if ($effectiveStart->greaterThan($asOf)) {
                    continue;
                }

                $type = (string) $seg->segment_type;
                if (! in_array($type, ['production', 'downtime', 'mount', 'demount'], true)) {
                    continue;
                }

                if (! isset($byAreaWo[$area][$woId])) {
                    $byAreaWo[$area][$woId] = [
                        'segment_types' => [],
                        'machine_codes' => [],
                    ];
                }
                $byAreaWo[$area][$woId]['segment_types'][$type] = true;
                $machine = trim((string) ($seg->machine_code ?? ''));
                if ($machine !== '') {
                    $byAreaWo[$area][$woId]['machine_codes'][$machine] = true;
                }
            }
        }

        foreach (array_keys($this->montajeTurnos->activeTurnoIdsByWorkOrder()) as $woId) {
            $woId = (int) $woId;
            if ($woId < 1) {
                continue;
            }
            if (! isset($byAreaWo['montaje'][$woId])) {
                $byAreaWo['montaje'][$woId] = [
                    'segment_types' => [],
                    'machine_codes' => [],
                ];
            }
        }

        foreach (array_keys($this->corteTurnos->activeTurnoIdsByWorkOrder()) as $woId) {
            $woId = (int) $woId;
            if ($woId < 1) {
                continue;
            }
            if (! isset($byAreaWo['corte'][$woId])) {
                $byAreaWo['corte'][$woId] = [
                    'segment_types' => [],
                    'machine_codes' => [],
                ];
            }
        }

        $allWoIds = [];
        foreach ($byAreaWo as $perArea) {
            foreach (array_keys($perArea) as $woId) {
                $allWoIds[(int) $woId] = true;
            }
        }

        if ($allWoIds === []) {
            return [];
        }

        $codes = DB::table('work_orders')
            ->whereIn('id', array_keys($allWoIds))
            ->pluck('code', 'id');

        $areaOrder = ['montaje', 'printing', 'laminacion', 'corte'];
        $typeOrder = ['production', 'mount', 'downtime', 'demount'];
        $out = [];

        foreach ($areaOrder as $area) {
            if (! isset($byAreaWo[$area])) {
                continue;
            }
            $rows = $byAreaWo[$area];
            uksort($rows, function (int $a, int $b) use ($codes): int {
                $ca = (string) ($codes[$a] ?? '');
                $cb = (string) ($codes[$b] ?? '');

                return strcmp($ca, $cb);
            });

            foreach ($rows as $woId => $meta) {
                $types = array_keys($meta['segment_types']);
                usort($types, function (string $a, string $b) use ($typeOrder): int {
                    $ia = array_search($a, $typeOrder, true);
                    $ib = array_search($b, $typeOrder, true);

                    return ($ia === false ? 99 : $ia) <=> ($ib === false ? 99 : $ib);
                });

                $machines = array_keys($meta['machine_codes']);
                sort($machines, SORT_STRING);

                $out[] = [
                    'area' => $area,
                    'work_order_id' => (int) $woId,
                    'work_order_code' => (string) ($codes[$woId] ?? ''),
                    'segment_types' => array_values($types),
                    'machine_codes' => array_values($machines),
                ];
            }
        }

        return $out;
    }

    private function resolveAsOf(Carbon $to): Carbon
    {
        $end = $to->copy()->endOfDay();

        return Carbon::now()->lt($end) ? Carbon::now() : $end;
    }

    /**
     * @param  list<array{area: string, segment_type: string, machine_code: string, total_seconds: int, segment_count: int}>  $closedRows
     * @param  array<int, list<string>>  $activeCorteTurnos
     * @return list<array{area: string, segment_type: string, machine_code: string, total_seconds: int, segment_count: int}>
     */
    private function filterCorteClosedRows(array $closedRows, array $activeCorteTurnos): array
    {
        if ($activeCorteTurnos === []) {
            return $closedRows;
        }

        $excludedSeconds = $this->sumExcludedCorteSyncSeconds($activeCorteTurnos);
        if ($excludedSeconds === []) {
            return $closedRows;
        }

        $filtered = [];
        foreach ($closedRows as $row) {
            if (($row['area'] ?? '') !== 'corte') {
                $filtered[] = $row;

                continue;
            }

            $type = (string) ($row['segment_type'] ?? '');
            $machine = (string) ($row['machine_code'] ?? '');
            $key = $type.'|'.$machine;
            $subtract = (int) ($excludedSeconds[$key] ?? 0);
            $remaining = max(0, (int) ($row['total_seconds'] ?? 0) - $subtract);
            if ($remaining < 1) {
                continue;
            }
            $row['total_seconds'] = $remaining;
            $filtered[] = $row;
        }

        return $filtered;
    }

    /**
     * @param  array<int, list<string>>  $activeCorteTurnos
     * @return array<string, int> segment_type|machine_code => seconds
     */
    private function sumExcludedCorteSyncSeconds(array $activeCorteTurnos): array
    {
        $woIds = array_keys($activeCorteTurnos);
        if ($woIds === []) {
            return [];
        }

        $query = DB::table('corte_time_segments')
            ->whereIn('work_order_id', $woIds)
            ->whereNotNull('ended_at');

        $query->where(function ($q) use ($activeCorteTurnos): void {
            foreach ($activeCorteTurnos as $woId => $turnoIds) {
                foreach ($turnoIds as $turnoId) {
                    $q->orWhere(function ($inner) use ($woId, $turnoId): void {
                        $inner->where('work_order_id', $woId)
                            ->where('notes', 'like', 'cor_turno_sync:'.$turnoId.'%');
                    });
                }
            }
        });

        $driver = DB::connection()->getDriverName();
        $secondsExpr = $driver === 'sqlite'
            ? "(CAST(strftime('%s', ended_at) AS INTEGER) - CAST(strftime('%s', started_at) AS INTEGER))"
            : 'TIMESTAMPDIFF(SECOND, started_at, ended_at)';

        $out = [];
        foreach ($query
            ->select('segment_type')
            ->selectRaw("COALESCE(machine_code, '') as machine_code")
            ->selectRaw("SUM({$secondsExpr}) as total_seconds")
            ->groupBy(['segment_type', DB::raw("COALESCE(machine_code, '')")])
            ->get() as $row) {
            $key = ((string) $row->segment_type).'|'.((string) $row->machine_code);
            $out[$key] = (int) $row->total_seconds;
        }

        return $out;
    }

    /**
     * @param  list<array{area: string, segment_type: string, machine_code: string, total_seconds: int, segment_count: int}>  $closedRows
     * @param  array<int, list<string>>  $activeMontajeTurnos
     * @return list<array{area: string, segment_type: string, machine_code: string, total_seconds: int, segment_count: int}>
     */
    private function filterMontajeClosedRows(array $closedRows, array $activeMontajeTurnos): array
    {
        if ($activeMontajeTurnos === []) {
            return $closedRows;
        }

        $excludedSeconds = $this->sumExcludedMontajeSyncSeconds($activeMontajeTurnos);
        if ($excludedSeconds === []) {
            return $closedRows;
        }

        $filtered = [];
        foreach ($closedRows as $row) {
            if (($row['area'] ?? '') !== 'montaje') {
                $filtered[] = $row;

                continue;
            }

            $type = (string) ($row['segment_type'] ?? '');
            $machine = (string) ($row['machine_code'] ?? '');
            $key = $type.'|'.$machine;
            $subtract = (int) ($excludedSeconds[$key] ?? 0);
            $remaining = max(0, (int) ($row['total_seconds'] ?? 0) - $subtract);
            if ($remaining < 1) {
                continue;
            }
            $row['total_seconds'] = $remaining;
            $filtered[] = $row;
        }

        return $filtered;
    }

    /**
     * @param  array<int, list<string>>  $activeMontajeTurnos
     * @return array<string, int> segment_type|machine_code => seconds
     */
    private function sumExcludedMontajeSyncSeconds(array $activeMontajeTurnos): array
    {
        $woIds = array_keys($activeMontajeTurnos);
        if ($woIds === []) {
            return [];
        }

        $query = DB::table('montaje_time_segments')
            ->whereIn('work_order_id', $woIds)
            ->whereNotNull('ended_at');

        $query->where(function ($q) use ($activeMontajeTurnos): void {
            foreach ($activeMontajeTurnos as $woId => $turnoIds) {
                foreach ($turnoIds as $turnoId) {
                    $q->orWhere(function ($inner) use ($woId, $turnoId): void {
                        $inner->where('work_order_id', $woId)
                            ->where('notes', 'like', 'mont_turno_sync:'.$turnoId.'%');
                    });
                }
            }
        });

        $driver = DB::connection()->getDriverName();
        $secondsExpr = $driver === 'sqlite'
            ? "(CAST(strftime('%s', ended_at) AS INTEGER) - CAST(strftime('%s', started_at) AS INTEGER))"
            : 'TIMESTAMPDIFF(SECOND, started_at, ended_at)';

        $out = [];
        foreach ($query
            ->select('segment_type')
            ->selectRaw("COALESCE(machine_code, '') as machine_code")
            ->selectRaw("SUM({$secondsExpr}) as total_seconds")
            ->groupBy(['segment_type', DB::raw("COALESCE(machine_code, '')")])
            ->get() as $row) {
            $key = ((string) $row->segment_type).'|'.((string) $row->machine_code);
            $out[$key] = (int) $row->total_seconds;
        }

        return $out;
    }

    /**
     * @return list<array{area: string, segment_type: string, machine_code: string, total_seconds: int, segment_count: int}>
     */
    private function openSegmentsForTable(string $table, string $area, Carbon $from, Carbon $to, Carbon $asOf): array
    {
        $segments = DB::table($table)
            ->whereNull('ended_at')
            ->where('started_at', '<=', $to)
            ->get(['segment_type', 'machine_code', 'started_at']);

        /** @var array<string, array{seconds: int, count: int}> */
        $buckets = [];

        foreach ($segments as $seg) {
            try {
                $started = Carbon::parse((string) $seg->started_at);
            } catch (\Throwable) {
                continue;
            }

            $effectiveStart = $started->greaterThan($from) ? $started : $from->copy();
            if ($effectiveStart->greaterThan($asOf)) {
                continue;
            }

            $seconds = max(0, $effectiveStart->diffInSeconds($asOf));
            if ($seconds < 1) {
                continue;
            }

            $type = (string) $seg->segment_type;
            if (! in_array($type, ['production', 'downtime', 'mount', 'demount'], true)) {
                continue;
            }

            $machine = (string) ($seg->machine_code ?? '');
            $key = $type.'|'.$machine;
            if (! isset($buckets[$key])) {
                $buckets[$key] = ['seconds' => 0, 'count' => 0];
            }
            $buckets[$key]['seconds'] += $seconds;
            $buckets[$key]['count']++;
        }

        $out = [];
        foreach ($buckets as $key => $bucket) {
            [$type, $machine] = explode('|', $key, 2);
            $out[] = [
                'area' => $area,
                'segment_type' => $type,
                'machine_code' => $machine,
                'total_seconds' => $bucket['seconds'],
                'segment_count' => $bucket['count'],
            ];
        }

        return $out;
    }

    /**
     * @param  array<int, array{areas: array<string, true>, production_seconds: int, downtime_seconds: int, mount_seconds: int, demount_seconds: int}>  $byWo
     */
    private function applyOpenSegmentsByWorkOrder(
        array &$byWo,
        string $table,
        string $area,
        Carbon $from,
        Carbon $to,
        Carbon $asOf,
    ): void {
        $segments = DB::table($table)
            ->whereNull('ended_at')
            ->where('started_at', '<=', $to)
            ->get(['work_order_id', 'segment_type', 'started_at']);

        foreach ($segments as $seg) {
            $woId = (int) $seg->work_order_id;
            if ($woId < 1) {
                continue;
            }

            try {
                $started = Carbon::parse((string) $seg->started_at);
            } catch (\Throwable) {
                continue;
            }

            $effectiveStart = $started->greaterThan($from) ? $started : $from->copy();
            if ($effectiveStart->greaterThan($asOf)) {
                continue;
            }

            $seconds = max(0, $effectiveStart->diffInSeconds($asOf));
            if ($seconds < 1) {
                continue;
            }

            $type = (string) $seg->segment_type;
            if (! in_array($type, ['production', 'downtime', 'mount', 'demount'], true)) {
                continue;
            }

            if (! isset($byWo[$woId])) {
                $byWo[$woId] = [
                    'areas' => [],
                    'production_seconds' => 0,
                    'downtime_seconds' => 0,
                    'mount_seconds' => 0,
                    'demount_seconds' => 0,
                ];
            }

            $byWo[$woId]['areas'][$area] = true;
            if ($type === 'production') {
                $byWo[$woId]['production_seconds'] += $seconds;
            } elseif ($type === 'downtime') {
                $byWo[$woId]['downtime_seconds'] += $seconds;
            } elseif ($type === 'mount') {
                $byWo[$woId]['mount_seconds'] += $seconds;
            } else {
                $byWo[$woId]['demount_seconds'] += $seconds;
            }
        }
    }

    /**
     * @param  array<int, array{areas: array<string, true>, production_seconds: int, downtime_seconds: int, mount_seconds: int, demount_seconds: int}>  $byWo
     * @param  array<int, list<string>>  $activeCorteTurnos
     */
    private function applyCortePlanillaByWorkOrder(
        array &$byWo,
        Carbon $from,
        Carbon $to,
        Carbon $asOf,
        array $activeCorteTurnos,
    ): void {
        if ($activeCorteTurnos !== []) {
            foreach ($activeCorteTurnos as $woId => $turnoIds) {
                $subtract = $this->sumCorteSyncSecondsForWorkOrder((int) $woId, $turnoIds);
                if (! isset($byWo[$woId])) {
                    $byWo[$woId] = [
                        'areas' => [],
                        'production_seconds' => 0,
                        'downtime_seconds' => 0,
                        'mount_seconds' => 0,
                        'demount_seconds' => 0,
                    ];
                }
                foreach (['production_seconds', 'downtime_seconds', 'mount_seconds', 'demount_seconds'] as $field) {
                    $byWo[$woId][$field] = max(0, $byWo[$woId][$field] - (int) ($subtract[$field] ?? 0));
                }
            }
        }

        foreach ($this->corteTurnos->livePlanillaByWorkOrder($from, $to, $asOf) as $woId => $totals) {
            if (! isset($byWo[$woId])) {
                $byWo[$woId] = [
                    'areas' => [],
                    'production_seconds' => 0,
                    'downtime_seconds' => 0,
                    'mount_seconds' => 0,
                    'demount_seconds' => 0,
                ];
            }
            $byWo[$woId]['areas']['corte'] = true;
            $byWo[$woId]['production_seconds'] += (int) ($totals['production_seconds'] ?? 0);
            $byWo[$woId]['downtime_seconds'] += (int) ($totals['downtime_seconds'] ?? 0);
            $byWo[$woId]['mount_seconds'] += (int) ($totals['mount_seconds'] ?? 0);
            $byWo[$woId]['demount_seconds'] += (int) ($totals['demount_seconds'] ?? 0);
        }
    }

    /**
     * @param  list<string>  $turnoIds
     * @return array{production_seconds: int, downtime_seconds: int, mount_seconds: int, demount_seconds: int}
     */
    private function sumCorteSyncSecondsForWorkOrder(int $workOrderId, array $turnoIds): array
    {
        $totals = [
            'production_seconds' => 0,
            'downtime_seconds' => 0,
            'mount_seconds' => 0,
            'demount_seconds' => 0,
        ];

        if ($turnoIds === []) {
            return $totals;
        }

        $driver = DB::connection()->getDriverName();
        $secondsExpr = $driver === 'sqlite'
            ? "(CAST(strftime('%s', ended_at) AS INTEGER) - CAST(strftime('%s', started_at) AS INTEGER))"
            : 'TIMESTAMPDIFF(SECOND, started_at, ended_at)';

        $query = DB::table('corte_time_segments')
            ->where('work_order_id', $workOrderId)
            ->whereNotNull('ended_at')
            ->where(function ($q) use ($turnoIds): void {
                foreach ($turnoIds as $turnoId) {
                    $q->orWhere('notes', 'like', 'cor_turno_sync:'.$turnoId.'%');
                }
            })
            ->select('segment_type')
            ->selectRaw("SUM({$secondsExpr}) as total_seconds")
            ->groupBy('segment_type');

        foreach ($query->get() as $row) {
            $type = (string) $row->segment_type;
            $sec = (int) $row->total_seconds;
            if ($type === 'production') {
                $totals['production_seconds'] += $sec;
            } elseif ($type === 'downtime') {
                $totals['downtime_seconds'] += $sec;
            } elseif ($type === 'mount') {
                $totals['mount_seconds'] += $sec;
            } elseif ($type === 'demount') {
                $totals['demount_seconds'] += $sec;
            }
        }

        return $totals;
    }

    /**
     * @param  array<int, array{areas: array<string, true>, production_seconds: int, downtime_seconds: int, mount_seconds: int, demount_seconds: int}>  $byWo
     * @param  array<int, list<string>>  $activeMontajeTurnos
     */
    private function applyMontajePlanillaByWorkOrder(
        array &$byWo,
        Carbon $from,
        Carbon $to,
        Carbon $asOf,
        array $activeMontajeTurnos,
    ): void {
        if ($activeMontajeTurnos !== []) {
            foreach ($activeMontajeTurnos as $woId => $turnoIds) {
                $subtract = $this->sumMontajeSyncSecondsForWorkOrder((int) $woId, $turnoIds);
                if (! isset($byWo[$woId])) {
                    $byWo[$woId] = [
                        'areas' => [],
                        'production_seconds' => 0,
                        'downtime_seconds' => 0,
                        'mount_seconds' => 0,
                        'demount_seconds' => 0,
                    ];
                }
                foreach (['production_seconds', 'downtime_seconds', 'mount_seconds', 'demount_seconds'] as $field) {
                    $byWo[$woId][$field] = max(0, $byWo[$woId][$field] - (int) ($subtract[$field] ?? 0));
                }
            }
        }

        foreach ($this->montajeTurnos->livePlanillaByWorkOrder($from, $to, $asOf) as $woId => $totals) {
            if (! isset($byWo[$woId])) {
                $byWo[$woId] = [
                    'areas' => [],
                    'production_seconds' => 0,
                    'downtime_seconds' => 0,
                    'mount_seconds' => 0,
                    'demount_seconds' => 0,
                ];
            }
            $byWo[$woId]['areas']['montaje'] = true;
            $byWo[$woId]['production_seconds'] += (int) ($totals['production_seconds'] ?? 0);
            $byWo[$woId]['downtime_seconds'] += (int) ($totals['downtime_seconds'] ?? 0);
            $byWo[$woId]['mount_seconds'] += (int) ($totals['mount_seconds'] ?? 0);
            $byWo[$woId]['demount_seconds'] += (int) ($totals['demount_seconds'] ?? 0);
        }
    }

    /**
     * @param  list<string>  $turnoIds
     * @return array{production_seconds: int, downtime_seconds: int, mount_seconds: int, demount_seconds: int}
     */
    private function sumMontajeSyncSecondsForWorkOrder(int $workOrderId, array $turnoIds): array
    {
        $totals = [
            'production_seconds' => 0,
            'downtime_seconds' => 0,
            'mount_seconds' => 0,
            'demount_seconds' => 0,
        ];

        if ($turnoIds === []) {
            return $totals;
        }

        $driver = DB::connection()->getDriverName();
        $secondsExpr = $driver === 'sqlite'
            ? "(CAST(strftime('%s', ended_at) AS INTEGER) - CAST(strftime('%s', started_at) AS INTEGER))"
            : 'TIMESTAMPDIFF(SECOND, started_at, ended_at)';

        $query = DB::table('montaje_time_segments')
            ->where('work_order_id', $workOrderId)
            ->whereNotNull('ended_at')
            ->where(function ($q) use ($turnoIds): void {
                foreach ($turnoIds as $turnoId) {
                    $q->orWhere('notes', 'like', 'mont_turno_sync:'.$turnoId.'%');
                }
            })
            ->select('segment_type')
            ->selectRaw("SUM({$secondsExpr}) as total_seconds")
            ->groupBy('segment_type');

        foreach ($query->get() as $row) {
            $type = (string) $row->segment_type;
            $sec = (int) $row->total_seconds;
            if ($type === 'production') {
                $totals['production_seconds'] += $sec;
            } elseif ($type === 'downtime') {
                $totals['downtime_seconds'] += $sec;
            } elseif ($type === 'mount') {
                $totals['mount_seconds'] += $sec;
            } elseif ($type === 'demount') {
                $totals['demount_seconds'] += $sec;
            }
        }

        return $totals;
    }

    /**
     * @param  list<array{area: string, segment_type: string, machine_code: string, total_seconds: int, segment_count: int}>  $rows
     * @return list<array{area: string, segment_type: string, machine_code: string, total_seconds: int, segment_count: int}>
     */
    private function mergeRows(array $rows): array
    {
        /** @var array<string, array{area: string, segment_type: string, machine_code: string, total_seconds: int, segment_count: int}> */
        $map = [];

        foreach ($rows as $row) {
            $area = (string) ($row['area'] ?? '');
            $type = (string) ($row['segment_type'] ?? '');
            $machine = (string) ($row['machine_code'] ?? '');
            $key = $area.'|'.$type.'|'.$machine;

            if (! isset($map[$key])) {
                $map[$key] = [
                    'area' => $area,
                    'segment_type' => $type,
                    'machine_code' => $machine,
                    'total_seconds' => 0,
                    'segment_count' => 0,
                ];
            }

            $map[$key]['total_seconds'] += (int) ($row['total_seconds'] ?? 0);
            $map[$key]['segment_count'] += (int) ($row['segment_count'] ?? 0);
        }

        return array_values($map);
    }
}
