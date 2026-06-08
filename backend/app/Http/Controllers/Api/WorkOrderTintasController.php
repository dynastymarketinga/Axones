<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdatePrintingConsumablesRequest;
use App\Http\Requests\StartTintasTimeSegmentRequest;
use App\Http\Requests\UpdateWorkOrderTintasSummaryRequest;
use App\Models\TintasTimeSegment;
use App\Models\WorkOrder;
use App\Services\PrintingProductionService;
use App\Services\TintasProductionService;
use App\Services\TintasWarehouseRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class WorkOrderTintasController extends Controller
{
    public function __construct(
        private readonly TintasProductionService $tintas,
        private readonly PrintingProductionService $printing,
        private readonly TintasWarehouseRequestService $tintasWarehouse,
    ) {}

    /**
     * Estado de producción tintas para la OT: tiempos y % merma (si aplica).
     */
    public function show(WorkOrder $work_order): JsonResponse
    {
        $state = $this->tintas->getTintasState($work_order);

        // Incluimos consumibles (tintas/químicos) desde la misma fuente que impresión,
        // pero expuestos bajo el endpoint de tintas.
        $work_order->loadMissing([
            'printingInkControlLines.material',
            'printingChemicalUsages',
        ]);
        $state['ink_control_lines'] = $work_order->printingInkControlLines;
        $state['chemical_usages'] = $work_order->printingChemicalUsages;

        return response()->json($state);
    }

    public function startTimeSegment(StartTintasTimeSegmentRequest $request, WorkOrder $work_order): JsonResponse
    {
        $data = $request->validated();
        $segment = $this->tintas->startTimeSegment(
            $work_order,
            $request->user(),
            $data['segment_type'],
            $data['notes'] ?? null,
            $data['machine_code'] ?? null,
        );

        return response()->json($segment, 201);
    }

    public function stopTimeSegment(WorkOrder $work_order, TintasTimeSegment $tintas_time_segment): JsonResponse
    {
        if ((int) $tintas_time_segment->work_order_id !== (int) $work_order->getKey()) {
            abort(404);
        }

        return response()->json($this->tintas->stopTimeSegment($tintas_time_segment));
    }

    public function updateSummary(UpdateWorkOrderTintasSummaryRequest $request, WorkOrder $work_order): JsonResponse
    {
        $summary = $this->tintas->upsertSummary($work_order, $request->validated());

        return response()->json($summary);
    }

    /**
     * Alias semántico: consumo de tintas/químicos por OT desde el área Tintas.
     * Reusa el mismo almacenamiento que impresión para evitar duplicación de datos.
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

        $materialRequest = $this->tintasWarehouse->syncConsumptionRequest(
            $work_order,
            $request->user(),
            $inkLines,
            $chemicalUsages,
        );

        if ($materialRequest !== null) {
            $payload['material_request_id'] = $materialRequest->getKey();
        }

        return response()->json($payload);
    }
}

