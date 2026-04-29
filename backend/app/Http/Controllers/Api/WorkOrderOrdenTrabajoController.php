<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\MergePrintingOrdenTrabajoRequest;
use App\Http\Requests\UpdateWorkOrderOrdenTrabajoRequest;
use App\Models\WorkOrder;
use App\Services\ProductionNotificationService;
use App\Services\WorkOrderOrdenTrabajoService;
use Illuminate\Http\JsonResponse;

class WorkOrderOrdenTrabajoController extends Controller
{
    public function __construct(
        private readonly WorkOrderOrdenTrabajoService $ordenTrabajo,
        private readonly ProductionNotificationService $productionNotifications,
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
            'client_id' => $work_order->client_id,
            'product_id' => $work_order->product_id,
            'prefill' => $payload['prefill'],
            'form' => $payload['form'],
        ]);
    }

    public function update(UpdateWorkOrderOrdenTrabajoRequest $request, WorkOrder $work_order): JsonResponse
    {
        $form = $request->validated()['form'];
        $doc = $this->ordenTrabajo->syncForm($work_order, $form);
        $originArea = strtolower(trim((string) $request->input('origin_area', '')));
        $notifyOnProductionSave = filter_var(
            $request->input('notify_on_production_save', false),
            FILTER_VALIDATE_BOOLEAN,
        );

        if ($notifyOnProductionSave && $originArea !== '') {
            $this->productionNotifications->notifyOnProductionSave(
                $work_order->fresh(),
                $request->user(),
                $originArea,
            );
        }

        return response()->json([
            'work_order_id' => $work_order->getKey(),
            'updated_at' => $doc->updated_at,
        ]);
    }

    /**
     * Actualización parcial de campos `imp*` para operadores de impresión (control de impresión).
     */
    public function mergePrintingControl(MergePrintingOrdenTrabajoRequest $request, WorkOrder $work_order): JsonResponse
    {
        $form = $request->validated()['form'];
        $doc = $this->ordenTrabajo->mergePrintingKeysIntoForm($work_order, $form);
        $originArea = strtolower(trim((string) $request->input('origin_area', '')));
        $notifyOnProductionSave = filter_var(
            $request->input('notify_on_production_save', false),
            FILTER_VALIDATE_BOOLEAN,
        );

        if ($notifyOnProductionSave && $originArea !== '') {
            $this->productionNotifications->notifyOnProductionSave(
                $work_order->fresh(),
                $request->user(),
                $originArea,
            );
        }

        return response()->json([
            'work_order_id' => $work_order->getKey(),
            'updated_at' => $doc->updated_at,
        ]);
    }
}
