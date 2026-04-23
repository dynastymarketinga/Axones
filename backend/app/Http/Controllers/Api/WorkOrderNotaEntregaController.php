<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use App\Services\NotaEntregaPrefillService;
use Illuminate\Http\JsonResponse;

class WorkOrderNotaEntregaController extends Controller
{
    public function __construct(
        private readonly NotaEntregaPrefillService $prefill,
    ) {}

    /**
     * Precarga nota de entrega desde datos de la OT y saldos disponibles de corte.
     */
    public function prefill(WorkOrder $work_order): JsonResponse
    {
        return response()->json($this->prefill->buildForWorkOrder($work_order));
    }
}
