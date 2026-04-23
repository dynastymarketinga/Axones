<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StartPrintingTimeSegmentRequest;
use App\Http\Requests\StorePrintingBobinaUsageRequest;
use App\Http\Requests\UpdatePrintingConsumablesRequest;
use App\Http\Requests\UpdateWorkOrderPrintingSummaryRequest;
use App\Models\PrintingTimeSegment;
use App\Models\WorkOrder;
use App\Services\PrintingProductionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class WorkOrderPrintingController extends Controller
{
    public function __construct(
        private readonly PrintingProductionService $printing,
    ) {}

    /**
     * Estado de producción impresión para la OT: tiempos, bobinas, % merma.
     */
    public function show(WorkOrder $work_order): JsonResponse
    {
        return response()->json($this->printing->getPrintingState($work_order));
    }

    public function startTimeSegment(StartPrintingTimeSegmentRequest $request, WorkOrder $work_order): JsonResponse
    {
        $data = $request->validated();
        $segment = $this->printing->startTimeSegment(
            $work_order,
            $request->user(),
            $data['segment_type'],
            $data['notes'] ?? null,
            $data['machine_code'] ?? null,
        );

        return response()->json($segment, 201);
    }

    public function stopTimeSegment(WorkOrder $work_order, PrintingTimeSegment $printing_time_segment): JsonResponse
    {
        if ((int) $printing_time_segment->work_order_id !== (int) $work_order->getKey()) {
            abort(404);
        }

        return response()->json($this->printing->stopTimeSegment($printing_time_segment));
    }

    public function storeBobinaUsage(StorePrintingBobinaUsageRequest $request, WorkOrder $work_order): JsonResponse
    {
        $usage = $this->printing->storeBobinaUsage($work_order, $request->validated());

        return response()->json($usage, 201);
    }

    public function updateSummary(UpdateWorkOrderPrintingSummaryRequest $request, WorkOrder $work_order): JsonResponse
    {
        $summary = $this->printing->upsertSummary($work_order, $request->validated());

        return response()->json($summary);
    }

    /**
     * Control de tintas (original / solventada / devolución) y químicos alcohol-metoxil-npa por OT.
     */
    public function updateConsumables(UpdatePrintingConsumablesRequest $request, WorkOrder $work_order): JsonResponse
    {
        if (! $request->has('ink_lines') && ! $request->has('chemical_usages')) {
            throw ValidationException::withMessages([
                'ink_lines' => ['Envíe al menos ink_lines o chemical_usages (puede ser un arreglo vacío para limpiar).'],
            ]);
        }

        $validated = $request->validated();
        $inkLines = $request->has('ink_lines') ? ($validated['ink_lines'] ?? []) : null;
        $chemicalUsages = $request->has('chemical_usages') ? ($validated['chemical_usages'] ?? []) : null;

        $payload = $this->printing->syncConsumables($work_order, $inkLines, $chemicalUsages);

        return response()->json($payload);
    }
}
