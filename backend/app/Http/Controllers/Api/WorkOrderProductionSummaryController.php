<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use App\Services\WorkOrderProductionAggregateService;
use Illuminate\Http\JsonResponse;

class WorkOrderProductionSummaryController extends Controller
{
    public function __construct(
        private readonly WorkOrderProductionAggregateService $aggregate,
    ) {}

    /**
     * Movimiento de producción por OT: todas las áreas + inventario/despacho agregado (PDF §9).
     */
    public function show(WorkOrder $work_order): JsonResponse
    {
        return response()->json($this->aggregate->fullProductionState($work_order));
    }
}
