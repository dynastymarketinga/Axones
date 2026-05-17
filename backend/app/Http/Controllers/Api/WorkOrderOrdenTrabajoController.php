<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\MergeCorteOrdenTrabajoRequest;
use App\Http\Requests\MergeLaminacionOrdenTrabajoRequest;
use App\Http\Requests\MergePrintingOrdenTrabajoRequest;
use App\Http\Requests\UpdateWorkOrderOrdenTrabajoRequest;
use App\Models\WorkOrder;
use App\Enums\WorkOrderPriority;
use App\Services\CortePlanillaDispatchSyncService;
use App\Services\ProductionNotificationService;
use App\Services\WorkOrderOrdenTrabajoService;
use App\Support\MesProductionSaveGuard;
use Illuminate\Http\JsonResponse;

class WorkOrderOrdenTrabajoController extends Controller
{
    public function __construct(
        private readonly WorkOrderOrdenTrabajoService $ordenTrabajo,
        private readonly ProductionNotificationService $productionNotifications,
        private readonly CortePlanillaDispatchSyncService $cortePlanillaDispatchSync,
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
        $validated = $request->validated();
        $form = $validated['form'];

        $originArea = strtolower(trim((string) $request->input('origin_area', '')));
        $notifyOnProductionSave = filter_var(
            $request->input('notify_on_production_save', false),
            FILTER_VALIDATE_BOOLEAN,
        );
        if ($notifyOnProductionSave && $originArea !== '') {
            MesProductionSaveGuard::assertProductionSaveAllowed($originArea, $form);
        }

        if (
            array_key_exists('priority', $validated)
            && is_string($validated['priority'])
            && $validated['priority'] !== ''
        ) {
            $work_order->update(['priority' => $validated['priority']]);
        }

        $doc = $this->ordenTrabajo->syncForm($work_order->fresh(), $form, $request->user());
        $saveFingerprint = $doc->updated_at?->toIso8601String() ?? (string) time();
        $broadcastSummary = $this->productionNotifications->notifyOnWorkOrderSavedBroadcast(
            $work_order->fresh(),
            $request->user(),
            $saveFingerprint,
        );

        $this->ordenTrabajo->syncAreaRequestsAfterProductionFinalize($work_order->fresh(), $form);

        $assignmentSummary = null;
        $assignedRaw = $validated['assigned_areas'] ?? null;
        if (is_array($assignedRaw)) {
            $norm = [];
            foreach ($assignedRaw as $raw) {
                $a = strtolower(trim((string) $raw));
                if ($a !== '' && in_array($a, ProductionNotificationService::PRODUCTIVE_AREAS, true)) {
                    $norm[$a] = true;
                }
            }
            $areas = array_keys($norm);
            if ($areas !== []) {
                $reason = trim((string) ($validated['assignment_reason'] ?? ''));
                $prio = array_key_exists('priority', $validated) && $validated['priority'] !== null
                    ? (string) $validated['priority']
                    : ($work_order->fresh()->priority?->value ?? WorkOrderPriority::Normal->value);
                $assignmentSummary = $this->productionNotifications->notifyAssignedAreasWithReason(
                    $work_order->fresh(),
                    $request->user(),
                    $areas,
                    $reason,
                    $prio,
                );
            }
        }

        $productionSummary = null;
        if ($notifyOnProductionSave && $originArea !== '') {
            $productionSummary = $this->productionNotifications->notifyOnProductionSave(
                $work_order->fresh(),
                $request->user(),
                $originArea,
            );
        }

        return response()->json([
            'work_order_id' => $work_order->getKey(),
            'updated_at' => $doc->updated_at,
            'notification_summary' => [
                'broadcast' => $broadcastSummary,
                'production' => $productionSummary,
                'assignment' => $assignmentSummary,
            ],
        ]);
    }

    /**
     * Actualización parcial de campos `imp*` para operadores de impresión (control de impresión).
     */
    public function mergePrintingControl(MergePrintingOrdenTrabajoRequest $request, WorkOrder $work_order): JsonResponse
    {
        $form = $request->validated()['form'];
        $originArea = strtolower(trim((string) $request->input('origin_area', '')));
        $notifyOnProductionSave = filter_var(
            $request->input('notify_on_production_save', false),
            FILTER_VALIDATE_BOOLEAN,
        );
        if ($notifyOnProductionSave && $originArea !== '') {
            $doc = $this->ordenTrabajo->getDocumentPayload($work_order);
            $existing = is_array($doc['form']) ? $doc['form'] : [];
            $merged = array_merge($existing, $form);
            MesProductionSaveGuard::assertProductionSaveAllowed($originArea, $merged);
        }

        $doc = $this->ordenTrabajo->mergePrintingKeysIntoForm($work_order, $form, $request->user());

        $productionSummary = null;
        if ($notifyOnProductionSave && $originArea !== '') {
            $productionSummary = $this->productionNotifications->notifyOnProductionSave(
                $work_order->fresh(),
                $request->user(),
                $originArea,
            );
        }

        return response()->json([
            'work_order_id' => $work_order->getKey(),
            'updated_at' => $doc->updated_at,
            'notification_summary' => [
                'broadcast' => null,
                'production' => $productionSummary,
            ],
        ]);
    }

    /**
     * Actualización parcial de campos `lam*` para operadores de laminación (control MES).
     */
    public function mergeLaminacionControl(MergeLaminacionOrdenTrabajoRequest $request, WorkOrder $work_order): JsonResponse
    {
        $form = $request->validated()['form'];
        $originArea = strtolower(trim((string) $request->input('origin_area', '')));
        $notifyOnProductionSave = filter_var(
            $request->input('notify_on_production_save', false),
            FILTER_VALIDATE_BOOLEAN,
        );
        if ($notifyOnProductionSave && $originArea !== '') {
            $doc = $this->ordenTrabajo->getDocumentPayload($work_order);
            $existing = is_array($doc['form']) ? $doc['form'] : [];
            $merged = array_merge($existing, $form);
            MesProductionSaveGuard::assertProductionSaveAllowed($originArea, $merged);
        }

        $doc = $this->ordenTrabajo->mergeLaminacionKeysIntoForm($work_order, $form, $request->user());

        $productionSummary = null;
        if ($notifyOnProductionSave && $originArea !== '') {
            $productionSummary = $this->productionNotifications->notifyOnProductionSave(
                $work_order->fresh(),
                $request->user(),
                $originArea,
            );
        }

        return response()->json([
            'work_order_id' => $work_order->getKey(),
            'updated_at' => $doc->updated_at,
            'notification_summary' => [
                'broadcast' => null,
                'production' => $productionSummary,
            ],
        ]);
    }

    /**
     * Actualización parcial de campos de corte (prefijo cor / métricas Corte).
     */
    public function mergeCorteControl(MergeCorteOrdenTrabajoRequest $request, WorkOrder $work_order): JsonResponse
    {
        $form = $request->validated()['form'];
        $originArea = strtolower(trim((string) $request->input('origin_area', '')));
        $notifyOnProductionSave = filter_var(
            $request->input('notify_on_production_save', false),
            FILTER_VALIDATE_BOOLEAN,
        );
        if ($notifyOnProductionSave && $originArea !== '') {
            $doc = $this->ordenTrabajo->getDocumentPayload($work_order);
            $existing = is_array($doc['form']) ? $doc['form'] : [];
            $merged = array_merge($existing, $form);
            MesProductionSaveGuard::assertProductionSaveAllowed($originArea, $merged);
        }

        $doc = $this->ordenTrabajo->mergeCorteKeysIntoForm($work_order, $form, $request->user());
        $mergedForm = is_array($doc->form) ? $doc->form : [];
        $dispatchSync = $this->cortePlanillaDispatchSync->dispatchSyncStatus($work_order->fresh(), $mergedForm);

        $productionSummary = null;
        if ($notifyOnProductionSave && $originArea !== '') {
            $productionSummary = $this->productionNotifications->notifyOnProductionSave(
                $work_order->fresh(),
                $request->user(),
                $originArea,
            );
        }

        return response()->json([
            'work_order_id' => $work_order->getKey(),
            'updated_at' => $doc->updated_at,
            'dispatch_sync' => $dispatchSync,
            'notification_summary' => [
                'broadcast' => null,
                'production' => $productionSummary,
            ],
        ]);
    }
}
