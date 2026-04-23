<?php

namespace App\Services;

use App\Enums\InventoryArea;
use App\Enums\PrintingTimeSegmentType;
use App\Enums\WorkOrderStatus;
use App\Models\Bobina;
use App\Models\Material;
use App\Models\PrintingBobinaUsage;
use App\Models\PrintingChemicalUsage;
use App\Models\PrintingInkControlLine;
use App\Models\PrintingTimeSegment;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderPrintingSummary;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PrintingProductionService
{
    public function __construct(
        private readonly OperationalAlertService $alerts,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function getPrintingState(WorkOrder $workOrder): array
    {
        $workOrder->loadMissing(['client', 'product', 'clientOrder']);

        $summary = WorkOrderPrintingSummary::query()->where('work_order_id', $workOrder->getKey())->first();

        $openSegment = PrintingTimeSegment::query()
            ->where('work_order_id', $workOrder->getKey())
            ->whereNull('ended_at')
            ->with('user:id,name,email')
            ->first();

        $recentSegments = PrintingTimeSegment::query()
            ->where('work_order_id', $workOrder->getKey())
            ->with('user:id,name,email')
            ->orderByDesc('started_at')
            ->limit(80)
            ->get();

        $bobinaUsages = PrintingBobinaUsage::query()
            ->where('work_order_id', $workOrder->getKey())
            ->with(['material', 'bobina'])
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();

        $inkControlLines = PrintingInkControlLine::query()
            ->where('work_order_id', $workOrder->getKey())
            ->with('material')
            ->orderBy('position')
            ->orderBy('id')
            ->get();

        $chemicalUsages = PrintingChemicalUsage::query()
            ->where('work_order_id', $workOrder->getKey())
            ->orderBy('chemical_type')
            ->get();

        $closed = PrintingTimeSegment::query()
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
            'bobina_usages' => $bobinaUsages,
            'ink_control_lines' => $inkControlLines,
            'chemical_usages' => $chemicalUsages,
        ];
    }

    /**
     * Control de tintas y químicos (hoja manual): reemplaza líneas según arrays enviados.
     *
     * @param  list<array{material_id: int, quantity_original_kg?: float|string|null, quantity_solventada_kg?: float|string|null, quantity_return_kg?: float|string|null, notes?: string|null, position?: int|null}>|null  $inkLines
     * @param  list<array{chemical_type: string, quantity_loaded_kg?: float|string|null, quantity_return_kg?: float|string|null, notes?: string|null}>|null  $chemicalUsages
     * @return array{ink_control_lines: \Illuminate\Support\Collection, chemical_usages: \Illuminate\Support\Collection}
     */
    public function syncConsumables(WorkOrder $workOrder, ?array $inkLines, ?array $chemicalUsages): array
    {
        if ($workOrder->status === WorkOrderStatus::Cancelled->value) {
            throw ValidationException::withMessages([
                'work_order_id' => ['No se puede registrar consumo de tintas en una orden cancelada.'],
            ]);
        }

        return DB::transaction(function () use ($workOrder, $inkLines, $chemicalUsages) {
            if ($inkLines !== null) {
                $workOrder->printingInkControlLines()->delete();
                foreach (array_values($inkLines) as $idx => $row) {
                    $material = Material::query()->findOrFail((int) $row['material_id']);
                    if (! in_array($material->inventory_area, [
                        InventoryArea::Tintas->value,
                        InventoryArea::CementerioTintas->value,
                    ], true)) {
                        throw ValidationException::withMessages([
                            "ink_lines.$idx.material_id" => ['Solo materiales de área tintas o cementerio_tintas.'],
                        ]);
                    }

                    PrintingInkControlLine::query()->create([
                        'work_order_id' => $workOrder->getKey(),
                        'material_id' => $material->getKey(),
                        'position' => (int) ($row['position'] ?? $idx),
                        'quantity_original_kg' => $row['quantity_original_kg'] ?? 0,
                        'quantity_solventada_kg' => $row['quantity_solventada_kg'] ?? 0,
                        'quantity_return_kg' => $row['quantity_return_kg'] ?? 0,
                        'notes' => $row['notes'] ?? null,
                    ]);
                }
            }

            if ($chemicalUsages !== null) {
                $workOrder->printingChemicalUsages()->delete();
                foreach ($chemicalUsages as $idx => $row) {
                    PrintingChemicalUsage::query()->create([
                        'work_order_id' => $workOrder->getKey(),
                        'chemical_type' => $row['chemical_type'],
                        'quantity_loaded_kg' => $row['quantity_loaded_kg'] ?? 0,
                        'quantity_return_kg' => $row['quantity_return_kg'] ?? 0,
                        'notes' => $row['notes'] ?? null,
                    ]);
                }
            }

            return [
                'ink_control_lines' => PrintingInkControlLine::query()
                    ->where('work_order_id', $workOrder->getKey())
                    ->with('material')
                    ->orderBy('position')
                    ->orderBy('id')
                    ->get(),
                'chemical_usages' => PrintingChemicalUsage::query()
                    ->where('work_order_id', $workOrder->getKey())
                    ->orderBy('chemical_type')
                    ->get(),
            ];
        });
    }

    public function startTimeSegment(WorkOrder $workOrder, User $user, string $segmentType, ?string $notes = null, ?string $machineCode = null): PrintingTimeSegment
    {
        if ($workOrder->status === WorkOrderStatus::Cancelled->value) {
            throw ValidationException::withMessages([
                'work_order_id' => ['No se puede registrar impresión en una orden cancelada.'],
            ]);
        }

        if (! in_array($segmentType, PrintingTimeSegmentType::values(), true)) {
            throw ValidationException::withMessages([
                'segment_type' => ['Tipo de segmento inválido. Use: mount, production, downtime.'],
            ]);
        }

        return DB::transaction(function () use ($workOrder, $user, $segmentType, $notes, $machineCode) {
            $open = PrintingTimeSegment::query()
                ->where('work_order_id', $workOrder->getKey())
                ->whereNull('ended_at')
                ->lockForUpdate()
                ->first();

            if ($open) {
                $open->update(['ended_at' => now()]);
                $this->alerts->evaluateClosedTimeSegment($open->fresh());
            }

            return PrintingTimeSegment::query()->create([
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

    public function stopTimeSegment(PrintingTimeSegment $segment): PrintingTimeSegment
    {
        if ($segment->ended_at !== null) {
            throw ValidationException::withMessages([
                'segment' => ['Este segmento ya fue cerrado.'],
            ]);
        }

        $segment->update(['ended_at' => now()]);
        $this->alerts->evaluateClosedTimeSegment($segment->fresh());

        return $segment->fresh()->load('user:id,name,email');
    }

    /**
     * @param  array{material_id: int, quantity_used_kg: string|float, quantity_finished_kg?: string|float, bobina_id?: int|null, notes?: string|null}  $data
     */
    public function storeBobinaUsage(WorkOrder $workOrder, array $data): PrintingBobinaUsage
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

        return PrintingBobinaUsage::query()->create([
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
    public function upsertSummary(WorkOrder $workOrder, array $data): WorkOrderPrintingSummary
    {
        if ($workOrder->status === WorkOrderStatus::Cancelled->value) {
            throw ValidationException::withMessages([
                'work_order_id' => ['No se puede actualizar el resumen de una orden cancelada.'],
            ]);
        }

        $summary = WorkOrderPrintingSummary::query()->firstOrNew(['work_order_id' => $workOrder->getKey()]);
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
            $this->alerts->evaluateScrapPercent($workOrder, $summary->scrap_percent, 'impresión');
        }

        return $summary;
    }
}
