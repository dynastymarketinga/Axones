<?php

namespace App\Services;

use App\Enums\PrintingTimeSegmentType;
use App\Enums\WorkOrderStatus;
use App\Models\MontajeMaterialUsage;
use App\Models\MontajeTimeSegment;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderMontajeSummary;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MontajeProductionService
{
    public function __construct(
        private readonly OperationalAlertService $alerts,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function getMontajeState(WorkOrder $workOrder): array
    {
        $workOrder->loadMissing(['client', 'product', 'clientOrder']);

        $summary = WorkOrderMontajeSummary::query()->where('work_order_id', $workOrder->getKey())->first();

        $openSegment = MontajeTimeSegment::query()
            ->where('work_order_id', $workOrder->getKey())
            ->whereNull('ended_at')
            ->with('user:id,name,email')
            ->first();

        $recentSegments = MontajeTimeSegment::query()
            ->where('work_order_id', $workOrder->getKey())
            ->with('user:id,name,email')
            ->orderByDesc('started_at')
            ->limit(80)
            ->get();

        $materialUsages = MontajeMaterialUsage::query()
            ->where('work_order_id', $workOrder->getKey())
            ->with('material')
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();

        $closed = MontajeTimeSegment::query()
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
            'material_usages' => $materialUsages,
        ];
    }

    public function startTimeSegment(WorkOrder $workOrder, User $user, string $segmentType, ?string $notes = null, ?string $machineCode = null): MontajeTimeSegment
    {
        if ($workOrder->status === WorkOrderStatus::Cancelled->value) {
            throw ValidationException::withMessages([
                'work_order_id' => ['No se puede registrar montaje en una orden cancelada.'],
            ]);
        }

        if (! in_array($segmentType, PrintingTimeSegmentType::values(), true)) {
            throw ValidationException::withMessages([
                'segment_type' => ['Tipo de segmento inválido. Use: mount, production, downtime.'],
            ]);
        }

        return DB::transaction(function () use ($workOrder, $user, $segmentType, $notes, $machineCode) {
            $open = MontajeTimeSegment::query()
                ->where('work_order_id', $workOrder->getKey())
                ->whereNull('ended_at')
                ->lockForUpdate()
                ->first();

            if ($open) {
                $open->update(['ended_at' => now()]);
                $this->alerts->evaluateClosedMontajeTimeSegment($open->fresh());
            }

            return MontajeTimeSegment::query()->create([
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

    public function stopTimeSegment(MontajeTimeSegment $segment): MontajeTimeSegment
    {
        if ($segment->ended_at !== null) {
            throw ValidationException::withMessages([
                'segment' => ['Este segmento ya fue cerrado.'],
            ]);
        }

        $segment->update(['ended_at' => now()]);
        $this->alerts->evaluateClosedMontajeTimeSegment($segment->fresh());

        return $segment->fresh()->load('user:id,name,email');
    }

    /**
     * @param  array{material_id: int, quantity: string|float, unit?: string|null, notes?: string|null}  $data
     */
    public function storeMaterialUsage(WorkOrder $workOrder, array $data): MontajeMaterialUsage
    {
        if ($workOrder->status === WorkOrderStatus::Cancelled->value) {
            throw ValidationException::withMessages([
                'work_order_id' => ['No se puede registrar material en una orden cancelada.'],
            ]);
        }

        return MontajeMaterialUsage::query()->create([
            'work_order_id' => $workOrder->getKey(),
            'material_id' => (int) $data['material_id'],
            'quantity' => $data['quantity'],
            'unit' => $data['unit'] ?? 'kg',
            'notes' => $data['notes'] ?? null,
        ])->fresh()->load('material');
    }

    /**
     * @param  array{scrap_percent?: float|string|null, notes?: string|null}  $data
     */
    public function upsertSummary(WorkOrder $workOrder, array $data): WorkOrderMontajeSummary
    {
        if ($workOrder->status === WorkOrderStatus::Cancelled->value) {
            throw ValidationException::withMessages([
                'work_order_id' => ['No se puede actualizar el resumen de una orden cancelada.'],
            ]);
        }

        $summary = WorkOrderMontajeSummary::query()->firstOrNew(['work_order_id' => $workOrder->getKey()]);
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
            $this->alerts->evaluateScrapPercent($workOrder, $summary->scrap_percent, 'montaje');
        }

        return $summary;
    }
}
