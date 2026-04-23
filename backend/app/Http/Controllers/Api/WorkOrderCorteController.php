<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StartCorteTimeSegmentRequest;
use App\Http\Requests\StoreCorteBobinaUsageRequest;
use App\Http\Requests\UpdateWorkOrderCorteSummaryRequest;
use App\Models\CorteTimeSegment;
use App\Models\WorkOrder;
use App\Services\CorteProductionService;
use Illuminate\Http\JsonResponse;

class WorkOrderCorteController extends Controller
{
    public function __construct(
        private readonly CorteProductionService $corte,
    ) {}

    /**
     * Estado de producción corte para la OT: tiempos, bobinas, % merma.
     */
    public function show(WorkOrder $work_order): JsonResponse
    {
        return response()->json($this->corte->getCorteState($work_order));
    }

    public function startTimeSegment(StartCorteTimeSegmentRequest $request, WorkOrder $work_order): JsonResponse
    {
        $data = $request->validated();
        $segment = $this->corte->startTimeSegment(
            $work_order,
            $request->user(),
            $data['segment_type'],
            $data['notes'] ?? null,
            $data['machine_code'] ?? null,
        );

        return response()->json($segment, 201);
    }

    public function stopTimeSegment(WorkOrder $work_order, CorteTimeSegment $corte_time_segment): JsonResponse
    {
        if ((int) $corte_time_segment->work_order_id !== (int) $work_order->getKey()) {
            abort(404);
        }

        return response()->json($this->corte->stopTimeSegment($corte_time_segment));
    }

    public function storeBobinaUsage(StoreCorteBobinaUsageRequest $request, WorkOrder $work_order): JsonResponse
    {
        $usage = $this->corte->storeBobinaUsage($work_order, $request->validated());

        return response()->json($usage, 201);
    }

    public function updateSummary(UpdateWorkOrderCorteSummaryRequest $request, WorkOrder $work_order): JsonResponse
    {
        $summary = $this->corte->upsertSummary($work_order, $request->validated());

        return response()->json($summary);
    }
}
