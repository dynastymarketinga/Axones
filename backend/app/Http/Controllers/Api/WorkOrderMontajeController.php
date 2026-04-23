<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StartMontajeTimeSegmentRequest;
use App\Http\Requests\StoreMontajeMaterialUsageRequest;
use App\Http\Requests\UpdateWorkOrderMontajeSummaryRequest;
use App\Models\MontajeTimeSegment;
use App\Models\WorkOrder;
use App\Services\MontajeProductionService;
use Illuminate\Http\JsonResponse;

class WorkOrderMontajeController extends Controller
{
    public function __construct(
        private readonly MontajeProductionService $montaje,
    ) {}

    public function show(WorkOrder $work_order): JsonResponse
    {
        return response()->json($this->montaje->getMontajeState($work_order));
    }

    public function startTimeSegment(StartMontajeTimeSegmentRequest $request, WorkOrder $work_order): JsonResponse
    {
        $data = $request->validated();
        $segment = $this->montaje->startTimeSegment(
            $work_order,
            $request->user(),
            $data['segment_type'],
            $data['notes'] ?? null,
            $data['machine_code'] ?? null,
        );

        return response()->json($segment, 201);
    }

    public function stopTimeSegment(WorkOrder $work_order, MontajeTimeSegment $montaje_time_segment): JsonResponse
    {
        if ((int) $montaje_time_segment->work_order_id !== (int) $work_order->getKey()) {
            abort(404);
        }

        return response()->json($this->montaje->stopTimeSegment($montaje_time_segment));
    }

    public function storeMaterialUsage(StoreMontajeMaterialUsageRequest $request, WorkOrder $work_order): JsonResponse
    {
        $usage = $this->montaje->storeMaterialUsage($work_order, $request->validated());

        return response()->json($usage, 201);
    }

    public function updateSummary(UpdateWorkOrderMontajeSummaryRequest $request, WorkOrder $work_order): JsonResponse
    {
        $summary = $this->montaje->upsertSummary($work_order, $request->validated());

        return response()->json($summary);
    }
}
