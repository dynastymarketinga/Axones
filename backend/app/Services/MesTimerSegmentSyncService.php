<?php

namespace App\Services;

use App\Models\CorteTimeSegment;
use App\Models\LaminacionTimeSegment;
use App\Models\MontajeTimeSegment;
use App\Models\PrintingTimeSegment;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Database\Eloquent\Model;

/**
 * Sincroniza transiciones del cronómetro MES (planilla) con segmentos de tiempo
 * usados por los reportes de producción.
 */
class MesTimerSegmentSyncService
{
    /** @var array<string, array{prefix: string, actual_key: string}> */
    private const AREA_CONFIG = [
        'printing' => ['prefix' => 'imp', 'actual_key' => 'impTurnoActual'],
        'montaje' => ['prefix' => 'mont', 'actual_key' => 'montTurnoActual'],
        'laminacion' => ['prefix' => 'lam', 'actual_key' => 'lamTurnoActual'],
        'corte' => ['prefix' => 'cor', 'actual_key' => 'corTurnoActual'],
    ];

    public function __construct(
        private readonly PrintingProductionService $printing,
        private readonly MontajeProductionService $montaje,
        private readonly LaminacionProductionService $laminacion,
        private readonly CorteProductionService $corte,
    ) {}

    /**
     * @param  array<string, mixed>  $previousForm
     * @param  array<string, mixed>  $newForm
     * @param  list<string>|null  $onlyAreas  Claves: printing, montaje, laminacion, corte
     */
    public function syncAfterFormSave(
        WorkOrder $workOrder,
        array $previousForm,
        array $newForm,
        ?User $user,
        ?array $onlyAreas = null,
    ): void {
        if ($user === null) {
            return;
        }

        $machineCode = $this->resolveMachineCode($newForm);

        foreach (self::AREA_CONFIG as $areaKey => $config) {
            if ($onlyAreas !== null && ! in_array($areaKey, $onlyAreas, true)) {
                continue;
            }

            $prefix = $config['prefix'];
            $prevState = $this->resolveTimerState($previousForm, $prefix, $config['actual_key']);
            $newState = $this->resolveTimerState($newForm, $prefix, $config['actual_key']);

            if ($prevState === $newState) {
                continue;
            }

            $this->applyTransition(
                $workOrder,
                $user,
                $areaKey,
                $prevState,
                $newState,
                $newForm,
                $prefix,
                $machineCode,
            );
        }
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private function resolveTimerState(array $form, string $prefix, string $actualKey): string
    {
        $actual = $form[$actualKey] ?? null;
        if (is_array($actual)) {
            $timer = $actual['timer'] ?? null;
            if (is_array($timer)) {
                $nested = strtolower(trim((string) ($timer['state'] ?? '')));
                if ($nested !== '') {
                    return $nested;
                }
            }
        }

        $flat = strtolower(trim((string) ($form[$prefix.'TimerState'] ?? 'pending')));

        return $flat !== '' ? $flat : 'pending';
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private function resolveMachineCode(array $form): ?string
    {
        foreach (['maquina', 'impMaquina', 'lamMaquina', 'corMaquina', 'montMaquina'] as $key) {
            $v = trim((string) ($form[$key] ?? ''));
            if ($v !== '') {
                return $v;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private function latestPauseReason(array $form, string $prefix): ?string
    {
        $pauses = $form[$prefix.'TimerPauses'] ?? null;
        if (! is_array($pauses) || $pauses === []) {
            $actualKey = match ($prefix) {
                'imp' => 'impTurnoActual',
                'mont' => 'montTurnoActual',
                'lam' => 'lamTurnoActual',
                'cor' => 'corTurnoActual',
                default => null,
            };
            if ($actualKey !== null) {
                $actual = $form[$actualKey] ?? null;
                if (is_array($actual) && is_array($actual['timer'] ?? null)) {
                    $pauses = $actual['timer']['pauses'] ?? null;
                }
            }
        }

        if (! is_array($pauses) || $pauses === []) {
            return null;
        }

        $last = $pauses[count($pauses) - 1];
        if (! is_array($last)) {
            return null;
        }

        $reason = trim((string) ($last['reason'] ?? ''));
        $obs = trim((string) ($last['obs'] ?? ''));
        if ($reason === '' && $obs === '') {
            return null;
        }
        if ($obs === '') {
            return $reason;
        }
        if ($reason === '') {
            return $obs;
        }

        return $reason.' — '.$obs;
    }

    private function applyTransition(
        WorkOrder $workOrder,
        User $user,
        string $areaKey,
        string $prevState,
        string $newState,
        array $newForm,
        string $prefix,
        ?string $machineCode,
    ): void {
        if (in_array($newState, ['stopped', 'completed', 'pending'], true)
            && in_array($prevState, ['running', 'paused'], true)) {
            $this->closeOpenSegment($workOrder, $areaKey);

            return;
        }

        if ($newState === 'running' && $prevState !== 'running') {
            $this->startSegment($workOrder, $user, $areaKey, 'production', null, $machineCode);

            return;
        }

        if ($newState === 'paused' && $prevState === 'running') {
            $notes = $this->latestPauseReason($newForm, $prefix);
            $this->startSegment($workOrder, $user, $areaKey, 'downtime', $notes, $machineCode);
        }
    }

    private function startSegment(
        WorkOrder $workOrder,
        User $user,
        string $areaKey,
        string $segmentType,
        ?string $notes,
        ?string $machineCode,
    ): void {
        match ($areaKey) {
            'printing' => $this->printing->startTimeSegment($workOrder, $user, $segmentType, $notes, $machineCode),
            'montaje' => $this->montaje->startTimeSegment($workOrder, $user, $segmentType, $notes, $machineCode),
            'laminacion' => $this->laminacion->startTimeSegment($workOrder, $user, $segmentType, $notes, $machineCode),
            'corte' => $this->corte->startTimeSegment($workOrder, $user, $segmentType, $notes, $machineCode),
            default => null,
        };
    }

    private function closeOpenSegment(WorkOrder $workOrder, string $areaKey): void
    {
        $open = match ($areaKey) {
            'printing' => PrintingTimeSegment::query()
                ->where('work_order_id', $workOrder->getKey())
                ->whereNull('ended_at')
                ->first(),
            'montaje' => MontajeTimeSegment::query()
                ->where('work_order_id', $workOrder->getKey())
                ->whereNull('ended_at')
                ->first(),
            'laminacion' => LaminacionTimeSegment::query()
                ->where('work_order_id', $workOrder->getKey())
                ->whereNull('ended_at')
                ->first(),
            'corte' => CorteTimeSegment::query()
                ->where('work_order_id', $workOrder->getKey())
                ->whereNull('ended_at')
                ->first(),
            default => null,
        };

        if (! $open instanceof Model) {
            return;
        }

        match ($areaKey) {
            'printing' => $this->printing->stopTimeSegment($open),
            'montaje' => $this->montaje->stopTimeSegment($open),
            'laminacion' => $this->laminacion->stopTimeSegment($open),
            'corte' => $this->corte->stopTimeSegment($open),
            default => null,
        };
    }
}
