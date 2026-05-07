<?php

namespace App\Services;

use App\Enums\PrintingTimeSegmentType;
use App\Enums\WorkOrderStatus;
use App\Models\TintasTimeSegment;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderTintasSummary;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TintasProductionService
{
    public function __construct(
        private readonly OperationalAlertService $alerts,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function getTintasState(WorkOrder $workOrder): array
    {
        $workOrder->loadMissing(['client', 'product', 'clientOrder']);

        $summary = WorkOrderTintasSummary::query()->where('work_order_id', $workOrder->getKey())->first();

        $openSegment = TintasTimeSegment::query()
            ->where('work_order_id', $workOrder->getKey())
            ->whereNull('ended_at')
            ->with('user:id,name,email')
            ->first();

        $recentSegments = TintasTimeSegment::query()
            ->where('work_order_id', $workOrder->getKey())
            ->with('user:id,name,email')
            ->orderByDesc('started_at')
            ->limit(80)
            ->get();

        $closed = TintasTimeSegment::query()
            ->where('work_order_id', $workOrder->getKey())
            ->whereNotNull('ended_at')
            ->get(['segment_type', 'started_at', 'ended_at']);

        $totals = [
            'mount' => '0',
            'production' => '0',
            'downtime' => '0',
        ];
        foreach ($closed as $seg) {
            $type = $seg->segment_type;
            if (! isset($totals[$type])) {
                continue;
            }
            $start = $seg->started_at->getTimestamp();
            $end = $seg->ended_at->getTimestamp();
            $delta = (string) max(0, $end - $start);
            $totals[$type] = bcadd($totals[$type], $delta, 0);
        }

        return [
            'work_order' => $workOrder,
            'summary' => $summary,
            'open_time_segment' => $openSegment,
            'time_segments_recent' => $recentSegments,
            'time_totals_seconds' => $totals,
        ];
    }

    public function startTimeSegment(
        WorkOrder $workOrder,
        User $user,
        string $segmentType,
        ?string $notes = null,
        ?string $machineCode = null,
    ): TintasTimeSegment {
        if ($workOrder->status === WorkOrderStatus::Cancelled->value) {
            throw ValidationException::withMessages([
                'work_order_id' => ['No se puede registrar tintas en una orden cancelada.'],
            ]);
        }

        if (! in_array($segmentType, PrintingTimeSegmentType::values(), true)) {
            throw ValidationException::withMessages([
                'segment_type' => ['Tipo de segmento inválido. Use: mount, production, downtime.'],
            ]);
        }

        return DB::transaction(function () use ($workOrder, $user, $segmentType, $notes, $machineCode) {
            $open = TintasTimeSegment::query()
                ->where('work_order_id', $workOrder->getKey())
                ->whereNull('ended_at')
                ->lockForUpdate()
                ->first();

            if ($open) {
                $open->update(['ended_at' => now()]);
                // Por ahora no hay reglas específicas para segmentos cerrados en tintas.
            }

            return TintasTimeSegment::query()->create([
                'work_order_id' => $workOrder->getKey(),
                'machine_code' => $machineCode,
                'segment_type' => $segmentType,
                'started_at' => now(),
                'ended_at' => null,
                'user_id' => $user->getKey(),
                'notes' => $notes,
            ])->fresh()->load('user:id,name,email');
        });
    }

    public function stopTimeSegment(TintasTimeSegment $segment): TintasTimeSegment
    {
        if ($segment->ended_at !== null) {
            throw ValidationException::withMessages([
                'segment' => ['Este segmento ya fue cerrado.'],
            ]);
        }

        $segment->update(['ended_at' => now()]);

        return $segment->fresh()->load('user:id,name,email');
    }

    /**
     * @param  array{scrap_percent?: float|string|null, notes?: string|null}  $data
     */
    public function upsertSummary(WorkOrder $workOrder, array $data): WorkOrderTintasSummary
    {
        if ($workOrder->status === WorkOrderStatus::Cancelled->value) {
            throw ValidationException::withMessages([
                'work_order_id' => ['No se puede actualizar el resumen de una orden cancelada.'],
            ]);
        }

        $summary = WorkOrderTintasSummary::query()->firstOrNew(['work_order_id' => $workOrder->getKey()]);
        $scrapUpdated = array_key_exists('scrap_percent', $data);
        if ($scrapUpdated) {
            $summary->scrap_percent = $data['scrap_percent'];
        }
        if (array_key_exists('notes', $data)) {
            $summary->notes = $data['notes'];
        }
        $summary->save();
        $summary = $summary->fresh();
        if ($scrapUpdated) {
            $this->alerts->evaluateScrapPercent($workOrder, $summary->scrap_percent, 'tintas');
        }

        return $summary;
    }
}

