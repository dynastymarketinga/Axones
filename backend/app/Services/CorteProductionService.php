<?php

namespace App\Services;

use App\Enums\PrintingTimeSegmentType;
use App\Enums\WorkOrderStatus;
use App\Models\Bobina;
use App\Models\CorteBobinaUsage;
use App\Models\CorteTimeSegment;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderCorteSummary;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CorteProductionService
{
    public function __construct(
        private readonly OperationalAlertService $alerts,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function getCorteState(WorkOrder $workOrder): array
    {
        $workOrder->loadMissing(['client', 'product', 'clientOrder']);

        $summary = WorkOrderCorteSummary::query()->where('work_order_id', $workOrder->getKey())->first();

        $openSegment = CorteTimeSegment::query()
            ->where('work_order_id', $workOrder->getKey())
            ->whereNull('ended_at')
            ->with('user:id,name,email')
            ->first();

        $recentSegments = CorteTimeSegment::query()
            ->where('work_order_id', $workOrder->getKey())
            ->with('user:id,name,email')
            ->orderByDesc('started_at')
            ->limit(80)
            ->get();

        $bobinaUsages = CorteBobinaUsage::query()
            ->where('work_order_id', $workOrder->getKey())
            ->with(['material', 'bobina'])
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();

        $closed = CorteTimeSegment::query()
            ->where('work_order_id', $workOrder->getKey())
            ->whereNotNull('ended_at')
            ->get(['segment_type', 'started_at', 'ended_at']);

        $totals = [
            'mount' => '0',
            'demount' => '0',
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
            'bobina_usages' => $bobinaUsages,
        ];
    }

    public function startTimeSegment(WorkOrder $workOrder, User $user, string $segmentType, ?string $notes = null, ?string $machineCode = null): CorteTimeSegment
    {
        if ($workOrder->status === WorkOrderStatus::Cancelled->value) {
            throw ValidationException::withMessages([
                'work_order_id' => ['No se puede registrar corte en una orden cancelada.'],
            ]);
        }

        if (! in_array($segmentType, PrintingTimeSegmentType::values(), true)) {
            throw ValidationException::withMessages([
                'segment_type' => ['Tipo de segmento inválido. Use: mount, demount, production, downtime.'],
            ]);
        }

        return DB::transaction(function () use ($workOrder, $user, $segmentType, $notes, $machineCode) {
            $open = CorteTimeSegment::query()
                ->where('work_order_id', $workOrder->getKey())
                ->whereNull('ended_at')
                ->lockForUpdate()
                ->first();

            if ($open) {
                $open->update(['ended_at' => now()]);
                $this->alerts->evaluateClosedCorteTimeSegment($open->fresh());
            }

            return CorteTimeSegment::query()->create([
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

    public function stopTimeSegment(CorteTimeSegment $segment): CorteTimeSegment
    {
        if ($segment->ended_at !== null) {
            throw ValidationException::withMessages([
                'segment' => ['Este segmento ya fue cerrado.'],
            ]);
        }

        $segment->update(['ended_at' => now()]);
        $this->alerts->evaluateClosedCorteTimeSegment($segment->fresh());

        return $segment->fresh()->load('user:id,name,email');
    }

    /**
     * @param  array{material_id: int, quantity_used_kg: string|float, quantity_finished_kg?: string|float, bobina_id?: int|null, notes?: string|null}  $data
     */
    public function storeBobinaUsage(WorkOrder $workOrder, array $data): CorteBobinaUsage
    {
        if ($workOrder->status === WorkOrderStatus::Cancelled->value) {
            throw ValidationException::withMessages([
                'work_order_id' => ['No se puede registrar uso de bobina en una orden cancelada.'],
            ]);
        }

        $materialId = (int) $data['material_id'];
        $bobinaId = isset($data['bobina_id']) ? (int) $data['bobina_id'] : null;

        if ($bobinaId !== null) {
            $bobina = Bobina::query()->whereKey($bobinaId)->firstOrFail();
            if ((int) $bobina->material_id !== $materialId) {
                throw ValidationException::withMessages([
                    'bobina_id' => ['La bobina no corresponde al material indicado.'],
                ]);
            }
        }

        return CorteBobinaUsage::query()->create([
            'work_order_id' => $workOrder->getKey(),
            'bobina_id' => $bobinaId,
            'material_id' => $materialId,
            'quantity_used_kg' => $data['quantity_used_kg'],
            'quantity_finished_kg' => $data['quantity_finished_kg'] ?? 0,
            'notes' => $data['notes'] ?? null,
        ])->fresh()->load(['material', 'bobina']);
    }

    /**
     * @param  array{scrap_percent?: float|string|null, notes?: string|null}  $data
     */
    public function upsertSummary(WorkOrder $workOrder, array $data): WorkOrderCorteSummary
    {
        if ($workOrder->status === WorkOrderStatus::Cancelled->value) {
            throw ValidationException::withMessages([
                'work_order_id' => ['No se puede actualizar el resumen de una orden cancelada.'],
            ]);
        }

        $summary = WorkOrderCorteSummary::query()->firstOrNew(['work_order_id' => $workOrder->getKey()]);
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
            $this->alerts->evaluateScrapPercent($workOrder, $summary->scrap_percent, 'corte');
        }

        return $summary;
    }
}
