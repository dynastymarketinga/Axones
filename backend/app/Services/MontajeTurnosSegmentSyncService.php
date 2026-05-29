<?php

namespace App\Services;

use App\Models\MontajeTimeSegment;
use App\Models\User;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Alinea tiempos de turnos cerrados en planilla (montTurnosMontaje) con
 * montaje_time_segments usados por «Producción y tiempos» / reportes PDF.
 */
class MontajeTurnosSegmentSyncService
{
    private const TURNOS_KEY = 'montTurnosMontaje';

    private const SYNC_NOTE_PREFIX = 'mont_turno_sync:';

    public function syncClosedTurnosFromForm(WorkOrder $workOrder, array $form, ?User $user): void
    {
        if ($user === null) {
            return;
        }

        $turnos = $form[self::TURNOS_KEY] ?? null;
        if (! is_array($turnos) || $turnos === []) {
            return;
        }

        $machineCode = $this->resolveMachineCode($form);

        DB::transaction(function () use ($workOrder, $turnos, $user, $machineCode): void {
            foreach ($turnos as $raw) {
                if (! is_array($raw)) {
                    continue;
                }
                $this->syncOneClosedTurno($workOrder, $raw, $user, $machineCode);
            }
        });
    }

    /**
     * @param  array<string, mixed>  $turno
     */
    private function syncOneClosedTurno(
        WorkOrder $workOrder,
        array $turno,
        User $user,
        ?string $machineCode,
    ): void {
        $turnoId = trim((string) ($turno['id'] ?? ''));
        $closedAtRaw = $turno['closed_at'] ?? null;
        if ($turnoId === '' || ! is_string($closedAtRaw) || trim($closedAtRaw) === '') {
            return;
        }

        $marker = self::SYNC_NOTE_PREFIX.$turnoId;
        if (MontajeTimeSegment::query()
            ->where('work_order_id', $workOrder->getKey())
            ->where('notes', $marker)
            ->exists()) {
            return;
        }

        $timer = is_array($turno['timer'] ?? null) ? $turno['timer'] : [];
        $effectiveSec = max(0.0, (float) ($timer['effectiveAccSec'] ?? 0));
        $deadSec = max(0.0, (float) ($timer['deadAccSec'] ?? 0));
        $totalSec = $effectiveSec + $deadSec;
        if ($totalSec < 0.01) {
            return;
        }

        try {
            $end = Carbon::parse($closedAtRaw);
        } catch (\Throwable) {
            return;
        }

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
                : ($reason !== '' ? $reason : ($obs !== '' ? $obs : $marker));

            MontajeTimeSegment::query()->create([
                'work_order_id' => $workOrder->getKey(),
                'machine_code' => $machineCode,
                'segment_type' => 'downtime',
                'started_at' => $segStart,
                'ended_at' => $cursor->copy(),
                'user_id' => $user->getKey(),
                'notes' => $notes,
            ]);
            $cursor = $segStart;
        }

        $remainingDead = max(0.0, $deadSec - $pauseSecSum);
        if ($remainingDead >= 0.01) {
            $segStart = $cursor->copy()->subSeconds((int) round($remainingDead));
            MontajeTimeSegment::query()->create([
                'work_order_id' => $workOrder->getKey(),
                'machine_code' => $machineCode,
                'segment_type' => 'downtime',
                'started_at' => $segStart,
                'ended_at' => $cursor->copy(),
                'user_id' => $user->getKey(),
                'notes' => $marker.' (tiempo muerto)',
            ]);
            $cursor = $segStart;
        }

        if ($effectiveSec >= 0.01) {
            $segStart = $cursor->copy()->subSeconds((int) round($effectiveSec));
            MontajeTimeSegment::query()->create([
                'work_order_id' => $workOrder->getKey(),
                'machine_code' => $machineCode,
                'segment_type' => 'production',
                'started_at' => $segStart,
                'ended_at' => $cursor->copy(),
                'user_id' => $user->getKey(),
                'notes' => $marker,
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private function resolveMachineCode(array $form): ?string
    {
        foreach (['montMaquina', 'maquina'] as $key) {
            $v = trim((string) ($form[$key] ?? ''));
            if ($v !== '') {
                return $v;
            }
        }

        return null;
    }
}
