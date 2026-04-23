<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StartLaminacionTimeSegmentRequest;
use App\Http\Requests\StoreLaminacionBobinaUsageRequest;
use App\Http\Requests\UpdateWorkOrderLaminacionSummaryRequest;
use App\Models\LaminacionTimeSegment;
use App\Models\WorkOrder;
use App\Services\LaminacionProductionService;
use Illuminate\Http\JsonResponse;

class WorkOrderLaminacionController extends Controller
{
    public function __construct(
        private readonly LaminacionProductionService $laminacion,
    ) {}

    /**
     * Estado de laminación: tiempos, bobinas, % merma y datos de solvente (PDF §3.E).
     */
    public function show(WorkOrder $work_order): JsonResponse
    {
        return response()->json($this->laminacion->getLaminacionState($work_order));
    }

    public function startTimeSegment(StartLaminacionTimeSegmentRequest $request, WorkOrder $work_order): JsonResponse
    {
        $data = $request->validated();
        $segment = $this->laminacion->startTimeSegment(
            $work_order,
            $request->user(),
            $data['segment_type'],
            $data['notes'] ?? null,
            $data['machine_code'] ?? null,
        );

        return response()->json($segment, 201);
    }

    public function stopTimeSegment(WorkOrder $work_order, LaminacionTimeSegment $laminacion_time_segment): JsonResponse
    {
        if ((int) $laminacion_time_segment->work_order_id !== (int) $work_order->getKey()) {
            abort(404);
        }

        return response()->json($this->laminacion->stopTimeSegment($laminacion_time_segment));
    }

    public function storeBobinaUsage(StoreLaminacionBobinaUsageRequest $request, WorkOrder $work_order): JsonResponse
    {
        $usage = $this->laminacion->storeBobinaUsage($work_order, $request->validated());

        return response()->json($usage, 201);
    }

    public function updateSummary(UpdateWorkOrderLaminacionSummaryRequest $request, WorkOrder $work_order): JsonResponse
    {
        $summary = $this->laminacion->upsertSummary($work_order, $request->validated());

        return response()->json($summary);
    }
}
