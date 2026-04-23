<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReportDateRangeRequest;
use App\Http\Requests\ReportWorkOrderMaterialSummaryRequest;
use App\Http\Requests\ScrapReportRequest;
use App\Services\InventoryReportService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class ReportController extends Controller
{
    public function __construct(
        private readonly InventoryReportService $reports,
    ) {}

    /**
     * Reporte: entrada y salida por fecha (todas las áreas, todos los tipos de movimiento).
     */
    public function inventoryDaily(ReportDateRangeRequest $request): JsonResponse|Response
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();

        if (($validated['format'] ?? null) === 'csv') {
            $csv = $this->reports->inventoryDailyCsv($from, $to);

            return new Response($csv, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="inventory-daily-'.$from->format('Ymd').'-'.$to->format('Ymd').'.csv"',
            ]);
        }

        return response()->json($this->reports->inventoryDaily($from, $to));
    }

    /**
     * Reporte agregado por OT: despachos por material (solicitud), uso por bobina en impresión, devoluciones registradas.
     */
    public function workOrderMaterialSummary(ReportWorkOrderMaterialSummaryRequest $request): JsonResponse
    {
        $id = (int) $request->validated()['work_order_id'];

        return response()->json($this->reports->workOrderMaterialSummary($id));
    }

    /**
     * Reporte: consumo agregado por cliente y producto (salidas ligadas a OT vía solicitud).
     */
    public function consumptionByClientProduct(ReportDateRangeRequest $request): JsonResponse
    {
        $from = Carbon::parse($request->validated()['from'])->startOfDay();
        $to = Carbon::parse($request->validated()['to'])->endOfDay();

        return response()->json($this->reports->consumptionByClientAndProduct($from, $to));
    }

    /**
     * Reporte: inventario del área bobinas rechazadas (kg por material + bobinas registradas con OT vía devolución).
     */
    public function rejectedBobinas(): JsonResponse
    {
        return response()->json($this->reports->rejectedBobinasInventory());
    }

    /**
     * Tiempos de producción por área y tipo de segmento (PDF reportes de tiempos / utilización).
     */
    public function productionTimeByArea(ReportDateRangeRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();

        return response()->json($this->reports->productionTimesByArea($from, $to));
    }

    /**
     * Mermas registradas por OT y área (filtro cliente/producto).
     */
    public function scrapByFilters(ScrapReportRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();

        return response()->json($this->reports->scrapByFilters(
            $from,
            $to,
            isset($validated['client_id']) ? (int) $validated['client_id'] : null,
            isset($validated['product_id']) ? (int) $validated['product_id'] : null,
        ));
    }

    /**
     * Consumo de tintas / cementerio / químicos por cliente (salidas vía solicitud).
     */
    public function tintaConsumptionByClient(ReportDateRangeRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();

        return response()->json($this->reports->tintaConsumptionByClient($from, $to));
    }
}
