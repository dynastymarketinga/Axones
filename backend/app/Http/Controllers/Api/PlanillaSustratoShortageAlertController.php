<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReportPlanillaSustratoShortageRequest;
use App\Models\WorkOrder;
use App\Services\OperationalAlertService;
use Illuminate\Http\JsonResponse;

class PlanillaSustratoShortageAlertController extends Controller
{
    public function __construct(
        private readonly OperationalAlertService $alerts,
    ) {}

    /**
     * Registra escasez de sustratos virgen en /alertas al superar stock en planilla OT (incluye borrador sin OT).
     */
    public function store(ReportPlanillaSustratoShortageRequest $request): JsonResponse
    {
        $data = $request->validated();
        $workOrder = isset($data['work_order_id'])
            ? WorkOrder::query()->find((int) $data['work_order_id'])
            : null;
        $clientOrderId = isset($data['client_order_id'])
            ? (int) $data['client_order_id']
            : ($workOrder?->client_order_id ? (int) $workOrder->client_order_id : null);

        $created = 0;
        foreach ($data['lines'] as $line) {
            $this->alerts->recordOtMaterialShortageLine(
                $workOrder,
                $request->user(),
                (int) $line['material_id'],
                (string) $line['quantity_requested'],
                (string) $line['area_label'],
                (string) $line['originating_area'],
                'planilla',
                $clientOrderId,
            );
            $created++;
        }

        return response()->json([
            'recorded' => $created,
        ], 201);
    }
}
