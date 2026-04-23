<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateWorkOrderOrdenTrabajoRequest;
use App\Models\WorkOrder;
use App\Services\WorkOrderOrdenTrabajoService;
use Illuminate\Http\JsonResponse;

class WorkOrderOrdenTrabajoController extends Controller
{
    public function __construct(
        private readonly WorkOrderOrdenTrabajoService $ordenTrabajo,
    ) {}

    /**
     * Ficha "Orden de Trabajo": precarga desde maestros + borrador guardado (formulario web).
     */
    public function show(WorkOrder $work_order): JsonResponse
    {
        $payload = $this->ordenTrabajo->getDocumentPayload($work_order);

        return response()->json([
            'work_order_id' => $work_order->getKey(),
            'code' => $work_order->code,
            'document_number' => $work_order->document_number,
            'prefill' => $payload['prefill'],
            'form' => $payload['form'],
        ]);
    }

    public function update(UpdateWorkOrderOrdenTrabajoRequest $request, WorkOrder $work_order): JsonResponse
    {
        $form = $request->validated()['form'];
        $doc = $this->ordenTrabajo->syncForm($work_order, $form);

        return response()->json([
            'work_order_id' => $work_order->getKey(),
            'updated_at' => $doc->updated_at,
        ]);
    }
}
