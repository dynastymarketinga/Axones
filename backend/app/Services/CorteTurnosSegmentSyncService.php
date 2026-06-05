<?php

namespace App\Services;

use App\Enums\WorkOrderStatus;
use App\Models\CorteTimeSegment;
use App\Models\User;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Alinea tiempos de turnos (cerrados y en curso) en planilla con corte_time_segments
 * usados por «Producción y tiempos» / reportes PDF.
 */
class CorteTurnosSegmentSyncService
{
    private const TURNOS_KEY = 'cor_turnos';

    private const ACTUAL_KEY = 'corTurnoActual';

    private const SYNC_NOTE_PREFIX = 'cor_turno_sync:';

    /**
     * Turnos Corte abiertos en planilla (cronómetro en curso), por OT.
     *
     * @return array<int, list<string>>
     */
    public function activeTurnoIdsByWorkOrder(): array
    {
        $out = [];

        $forms = DB::table('work_order_technical_documents as td')
            ->join('work_orders as wo', 'wo.id', '=', 'td.work_order_id')
            ->where('wo.status', '!=', WorkOrderStatus::Cancelled->value)
            ->whereNotNull('td.form')
            ->get(['td.work_order_id', 'td.form']);

        foreach ($forms as $row) {
            $woId = (int) $row->work_order_id;
            if ($woId < 1) {
                continue;
            }
            $form = $this->decodeForm($row->form);
            if ($form === null) {
                continue;
            }

            $ids = [];
            foreach ((array) ($form[self::TURNOS_KEY] ?? []) as $turno) {
                if (! is_array($turno)) {
                    continue;
                }
                if ($this->isClosedTurno($turno)) {
                    continue;
                }
                $turnoId = trim((string) ($turno['id'] ?? ''));
                if ($turnoId !== '') {
                    $ids[] = $turnoId;
                }
            }

            $actual = $form[self::ACTUAL_KEY] ?? null;
            if (is_array($actual) && ! $this->isClosedTurno($actual)) {
                $turnoId = trim((string) ($actual['id'] ?? ''));
                if ($turnoId !== '') {
                    $ids[] = $turnoId;
                }
            }

            if ($ids !== []) {
                $out[$woId] = array_values(array_unique($ids));
            }
        }

        return $out;
    }

    /**
     * @return list<array{area: string, segment_type: string, machine_code: string, total_seconds: int, segment_count: int}>
     */
    public function livePlanillaAreaRows(Carbon $from, Carbon $to, Carbon $asOf): array
    {
        /** @var array<string, array{seconds: int, count: int}> */
        $buckets = [];

        foreach ($this->collectLivePlanillaContributions($from, $to, $asOf) as $item) {
            foreach ($item['rows'] as $row) {
                $key = $row['segment_type'].'|'.$row['machine_code'];
                if (! isset($buckets[$key])) {
                    $buckets[$key] = ['seconds' => 0, 'count' => 0];
                }
                $buckets[$key]['seconds'] += (int) $row['total_seconds'];
                $buckets[$key]['count']++;
            }
        }

        $out = [];
        foreach ($buckets as $key => $bucket) {
            [$type, $machine] = explode('|', $key, 2);
            $out[] = [
                'area' => 'corte',
                'segment_type' => $type,
                'machine_code' => $machine,
                'total_seconds' => $bucket['seconds'],
                'segment_count' => $bucket['count'],
            ];
        }

        return $out;
    }

    /**
     * @return array<int, array{production_seconds: int, downtime_seconds: int, mount_seconds: int, demount_seconds: int}>
     */
    public function livePlanillaByWorkOrder(Carbon $from, Carbon $to, Carbon $asOf): array
    {
        $out = [];

        foreach ($this->collectLivePlanillaContributions($from, $to, $asOf) as $item) {
            $woId = (int) $item['work_order_id'];
            if (! isset($out[$woId])) {
                $out[$woId] = [
                    'production_seconds' => 0,
                    'downtime_seconds' => 0,
                    'mount_seconds' => 0,
                    'demount_seconds' => 0,
                ];
            }
            foreach ($item['rows'] as $row) {
                $type = (string) $row['segment_type'];
                $sec = (int) $row['total_seconds'];
                if ($type === 'production') {
                    $out[$woId]['production_seconds'] += $sec;
                } elseif ($type === 'downtime') {
                    $out[$woId]['downtime_seconds'] += $sec;
                } elseif ($type === 'mount') {
                    $out[$woId]['mount_seconds'] += $sec;
                } elseif ($type === 'demount') {
                    $out[$woId]['demount_seconds'] += $sec;
                }
            }
        }

        return $out;
    }

    public function syncClosedTurnosFromForm(WorkOrder $workOrder, array $form, ?User $user): void
    {
        if ($user === null) {
            return;
        }

        $machineCode = $this->resolveMachineCode($form);

        DB::transaction(function () use ($workOrder, $form, $user, $machineCode): void {
            $turnos = $form[self::TURNOS_KEY] ?? null;
            if (is_array($turnos)) {
                foreach ($turnos as $raw) {
                    if (! is_array($raw)) {
                        continue;
                    }
                    $this->syncOneTurno($workOrder, $raw, $user, $machineCode, true);
                }
            }

            $actual = $form[self::ACTUAL_KEY] ?? null;
            if (is_array($actual) && trim((string) ($actual['id'] ?? '')) !== '') {
                $this->syncOneTurno($workOrder, $actual, $user, $machineCode, false);
            }
        });
    }

    /**
     * @param  array<string, mixed>  $turno
     */
    private function syncOneTurno(
        WorkOrder $workOrder,
        array $turno,
        User $user,
        ?string $machineCode,
        bool $idempotentWhenClosed,
    ): void {
        $turnoId = trim((string) ($turno['id'] ?? ''));
        if ($turnoId === '') {
            return;
        }

        $closedAtRaw = $turno['closed_at'] ?? null;
        $isClosed = is_string($closedAtRaw) && trim($closedAtRaw) !== '';

        if ($isClosed && $idempotentWhenClosed) {
            if (CorteTimeSegment::query()
                ->where('work_order_id', $workOrder->getKey())
                ->where('notes', 'like', self::SYNC_NOTE_PREFIX.$turnoId.'%')
                ->exists()) {
                return;
            }
        }

        if (! $isClosed) {
            CorteTimeSegment::query()
                ->where('work_order_id', $workOrder->getKey())
                ->where('notes', 'like', self::SYNC_NOTE_PREFIX.$turnoId.'%')
                ->delete();
        }

        $timer = is_array($turno['timer'] ?? null) ? $turno['timer'] : [];
        $durations = $this->resolveTimerDurations($timer, $isClosed ? null : now());

        if ($durations['total'] < 0.01) {
            return;
        }

        try {
            $end = $isClosed
                ? Carbon::parse($closedAtRaw)
                : now();
        } catch (\Throwable) {
            if ($isClosed) {
                return;
            }
            $end = now();
        }

        $markerBase = self::SYNC_NOTE_PREFIX.$turnoId;
        $cursor = $end->copy();
        $pauses = is_array($timer['pauses'] ?? null) ? $timer['pauses'] : [];
        $pauseSecSum = 0.0;

        foreach (array_reverse($pauses) as $pause) {
            if (! is_array($pause)) {
                continue;
            }
            $dur = max(0.0, (float) ($pause['duration_sec'] ?? 0));
            if ($dur < 0.01) {
                continue;
            }
            $pauseSecSum += $dur;
            $segStart = $cursor->copy()->subSeconds((int) round($dur));
            $reason = trim((string) ($pause['reason'] ?? ''));
            $obs = trim((string) ($pause['obs'] ?? ''));
            $notes = $reason !== '' && $obs !== ''
                ? $reason.' — '.$obs
                : ($reason !== '' ? $reason : ($obs !== '' ? $obs : $markerBase.'#downtime'));

            $this->createSegment(
                $workOrder,
                $user,
                $machineCode,
                'downtime',
                $segStart,
                $cursor->copy(),
                $notes,
            );
            $cursor = $segStart;
        }

        $remainingDead = max(0.0, $durations['dead'] - $pauseSecSum);
        if ($remainingDead >= 0.01) {
            $segStart = $cursor->copy()->subSeconds((int) round($remainingDead));
            $this->createSegment(
                $workOrder,
                $user,
                $machineCode,
                'downtime',
                $segStart,
                $cursor->copy(),
                $markerBase.'#downtime',
            );
            $cursor = $segStart;
        }

        if ($durations['demount'] >= 0.01) {
            $segStart = $cursor->copy()->subSeconds((int) round($durations['demount']));
            $this->createSegment(
                $workOrder,
                $user,
                $machineCode,
                'demount',
                $segStart,
                $cursor->copy(),
                $markerBase.'#demount',
            );
            $cursor = $segStart;
        }

        if ($durations['arranque'] >= 0.01) {
            $segStart = $cursor->copy()->subSeconds((int) round($durations['arranque']));
            $this->createSegment(
                $workOrder,
                $user,
                $machineCode,
                'mount',
                $segStart,
                $cursor->copy(),
                $markerBase.'#mount',
            );
            $cursor = $segStart;
        }

        if ($durations['effective'] >= 0.01) {
            $segStart = $cursor->copy()->subSeconds((int) round($durations['effective']));
            $this->createSegment(
                $workOrder,
                $user,
                $machineCode,
                'production',
                $segStart,
                $cursor->copy(),
                $markerBase.'#production',
            );
        }
    }

    /**
     * @return list<array{work_order_id: int, rows: list<array{segment_type: string, machine_code: string, total_seconds: int}>}>
     */
    private function collectLivePlanillaContributions(Carbon $from, Carbon $to, Carbon $asOf): array
    {
        $out = [];

        $forms = DB::table('work_order_technical_documents as td')
            ->join('work_orders as wo', 'wo.id', '=', 'td.work_order_id')
            ->where('wo.status', '!=', WorkOrderStatus::Cancelled->value)
            ->whereNotNull('td.form')
            ->get(['td.work_order_id', 'td.form']);

        foreach ($forms as $row) {
            $woId = (int) $row->work_order_id;
            if ($woId < 1) {
                continue;
            }
            $form = $this->decodeForm($row->form);
            if ($form === null) {
                continue;
            }

            $machineCode = (string) ($this->resolveMachineCode($form) ?? '');
            $turnos = [];

            foreach ((array) ($form[self::TURNOS_KEY] ?? []) as $turno) {
                if (is_array($turno) && ! $this->isClosedTurno($turno)) {
                    $turnos[] = $turno;
                }
            }

            $actual = $form[self::ACTUAL_KEY] ?? null;
            if (is_array($actual) && ! $this->isClosedTurno($actual)) {
                $turnos[] = $actual;
            }

            foreach ($turnos as $turno) {
                if (! $this->openTurnoOverlapsRange($turno, $from, $to)) {
                    continue;
                }

                $timer = is_array($turno['timer'] ?? null) ? $turno['timer'] : [];
                $durations = $this->resolveTimerDurations($timer, $asOf);
                $rows = $this->durationsToLiveRows($durations, $timer, $machineCode);
                if ($rows === []) {
                    continue;
                }

                $out[] = [
                    'work_order_id' => $woId,
                    'rows' => $rows,
                ];
            }
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>  $turno
     */
    private function openTurnoOverlapsRange(array $turno, Carbon $from, Carbon $to): bool
    {
        if ($this->isClosedTurno($turno)) {
            return false;
        }

        $startedRaw = trim((string) ($turno['started_at'] ?? ''));
        if ($startedRaw === '') {
            return true;
        }

        try {
            $started = Carbon::parse($startedRaw);
        } catch (\Throwable) {
            return true;
        }

        return $started->lessThanOrEqualTo($to);
    }

    /**
     * @param  array{effective: float, dead: float, arranque: float, demount: float, total: float}  $durations
     * @param  array<string, mixed>  $timer
     * @return list<array{segment_type: string, machine_code: string, total_seconds: int}>
     */
    private function durationsToLiveRows(array $durations, array $timer, string $machineCode): array
    {
        if ($durations['total'] < 0.01) {
            return [];
        }

        $rows = [];
        $append = function (string $type, float $seconds) use (&$rows, $machineCode): void {
            $sec = (int) round($seconds);
            if ($sec < 1) {
                return;
            }
            $rows[] = [
                'segment_type' => $type,
                'machine_code' => $machineCode,
                'total_seconds' => $sec,
            ];
        };

        $pauses = is_array($timer['pauses'] ?? null) ? $timer['pauses'] : [];
        $pauseSecSum = 0.0;
        foreach ($pauses as $pause) {
            if (! is_array($pause)) {
                continue;
            }
            $pauseSecSum += max(0.0, (float) ($pause['duration_sec'] ?? 0));
        }

        $append('downtime', max(0.0, $durations['dead'] - $pauseSecSum));
        foreach ($pauses as $pause) {
            if (! is_array($pause)) {
                continue;
            }
            $append('downtime', (float) ($pause['duration_sec'] ?? 0));
        }
        $append('demount', $durations['demount']);
        $append('mount', $durations['arranque']);
        $append('production', $durations['effective']);

        return $rows;
    }

    /**
     * @param  array<string, mixed>  $turno
     */
    private function isClosedTurno(array $turno): bool
    {
        $closedAtRaw = $turno['closed_at'] ?? null;

        return is_string($closedAtRaw) && trim($closedAtRaw) !== '';
    }

    /**
     * @return array<string, mixed>|null
     */
    private function decodeForm(mixed $raw): ?array
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
     * @param  array<string, mixed>  $timer
     * @return array{effective: float, dead: float, arranque: float, demount: float, total: float}
     */
    private function resolveTimerDurations(array $timer, ?Carbon $now): array
    {
        $nowMs = ($now ?? now())->getTimestampMs();

        $effective = max(0.0, (float) ($timer['effectiveAccSec'] ?? 0));
        $dead = max(0.0, (float) ($timer['deadAccSec'] ?? 0));
        $arranque = max(0.0, (float) ($timer['arranqueAccSec'] ?? 0));
        $demount = max(0.0, (float) ($timer['demountAccSec'] ?? 0));

        $state = strtolower(trim((string) ($timer['state'] ?? 'pending')));
        if ($state === 'running') {
            $lastResume = (int) ($timer['lastResumeAtMs'] ?? 0);
            if ($lastResume > 0) {
                $effective += max(0.0, ($nowMs - $lastResume) / 1000);
            }
        } elseif ($state === 'paused') {
            $pauseAt = (int) ($timer['pauseAtMs'] ?? 0);
            if ($pauseAt > 0) {
                $dead += max(0.0, ($nowMs - $pauseAt) / 1000);
            }
        }

        $arranque += $this->runningPhaseSeconds(
            (string) ($timer['arranqueState'] ?? 'idle'),
            (int) ($timer['arranqueLastResumeAtMs'] ?? 0),
            $nowMs,
        );
        $demount += $this->runningPhaseSeconds(
            (string) ($timer['demountState'] ?? 'idle'),
            (int) ($timer['demountLastResumeAtMs'] ?? 0),
            $nowMs,
        );

        $total = $effective + $dead + $arranque + $demount;

        return [
            'effective' => $effective,
            'dead' => $dead,
            'arranque' => $arranque,
            'demount' => $demount,
            'total' => $total,
        ];
    }

    private function runningPhaseSeconds(string $state, int $lastResumeAtMs, int $nowMs): float
    {
        if (strtolower(trim($state)) !== 'running' || $lastResumeAtMs <= 0) {
            return 0.0;
        }

        return max(0.0, ($nowMs - $lastResumeAtMs) / 1000);
    }

    private function createSegment(
        WorkOrder $workOrder,
        User $user,
        ?string $machineCode,
        string $segmentType,
        Carbon $startedAt,
        Carbon $endedAt,
        string $notes,
    ): void {
        CorteTimeSegment::query()->create([
            'work_order_id' => $workOrder->getKey(),
            'machine_code' => $machineCode,
            'segment_type' => $segmentType,
            'started_at' => $startedAt,
            'ended_at' => $endedAt,
            'user_id' => $user->getKey(),
            'notes' => $notes,
        ]);
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private function resolveMachineCode(array $form): ?string
    {
        foreach (['corMaquina', 'maquina'] as $key) {
            $v = trim((string) ($form[$key] ?? ''));
            if ($v !== '') {
                return $v;
            }
        }

        return null;
    }
}
