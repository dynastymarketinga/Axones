<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\ReportInventoryAreaDailyRequest;
use App\Http\Requests\ReportInventoryMovementsRequest;
use App\Http\Controllers\Controller;
use App\Http\Requests\ReportDateRangeRequest;
use App\Http\Requests\ReportWorkOrderMaterialSummaryRequest;
use App\Http\Requests\ScrapReportRequest;
use App\Http\Requests\WorkOrderTimeReportRequest;
use App\Services\InventoryReportService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\View;

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
     * Reporte de movimientos generales de inventario (resumen + detalle).
     */
    public function inventoryMovementsGeneral(ReportInventoryMovementsRequest $request): JsonResponse
    {
        $payload = $this->inventoryMovementsGeneralPayload($request);

        return response()->json($payload);
    }

    /**
     * Vista previa HTML del reporte de movimientos generales.
     */
    public function inventoryMovementsGeneralPreview(ReportInventoryMovementsRequest $request): Response
    {
        $payload = $this->inventoryMovementsGeneralPayload($request);
        $html = View::make('certificates.inventory_movements_general', [
            'report' => $payload,
            'generatedBy' => (string) ($request->user()?->name ?? 'Usuario no identificado'),
            'generatedAt' => now(),
        ])->render();

        return new Response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="inventory-movements-general-preview-'.$payload['from'].'-'.$payload['to'].'.html"',
        ]);
    }

    /**
     * Descarga PDF del reporte de movimientos generales.
     */
    public function inventoryMovementsGeneralPdf(ReportInventoryMovementsRequest $request): Response
    {
        $payload = $this->inventoryMovementsGeneralPayload($request);
        $html = View::make('certificates.inventory_movements_general', [
            'report' => $payload,
            'generatedBy' => (string) ($request->user()?->name ?? 'Usuario no identificado'),
            'generatedAt' => now(),
        ])->render();
        $pdf = Pdf::loadHTML($html)->setPaper('a4', 'landscape');

        return $pdf->download('inventory-movements-general-'.$payload['from'].'-'.$payload['to'].'.pdf');
    }

    /**
     * Reporte: stock final del dia por area/material.
     */
    public function inventoryAreaDaily(ReportInventoryAreaDailyRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $date = Carbon::parse($validated['date'])->startOfDay();
        $area = isset($validated['inventory_area']) ? (string) $validated['inventory_area'] : null;

        return response()->json($this->reports->inventoryAreaDailySnapshot($date, $area));
    }

    /**
     * Vista previa HTML del reporte inventario por area.
     */
    public function inventoryAreaDailyPreview(ReportInventoryAreaDailyRequest $request): Response
    {
        $payload = $this->inventoryAreaDailyPayload($request);
        $html = $this->buildInventoryAreaDailyHtml($payload, (string) ($request->user()?->name ?? 'Usuario no identificado'));

        return new Response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="inventory-area-daily-preview-'.$payload['report_date'].'.html"',
        ]);
    }

    /**
     * Descarga PDF del reporte inventario por area.
     */
    public function inventoryAreaDailyPdf(ReportInventoryAreaDailyRequest $request): Response
    {
        $payload = $this->inventoryAreaDailyPayload($request);
        $html = $this->buildInventoryAreaDailyHtml($payload, (string) ($request->user()?->name ?? 'Usuario no identificado'));
        $pdf = Pdf::loadHTML($html)->setPaper('a4', 'landscape');
        $areaSegment = $payload['area'] ?: 'todas-las-areas';

        return $pdf->download('inventory-area-daily-'.$areaSegment.'-'.$payload['report_date'].'.pdf');
    }

    /**
     * Reporte agregado por OT: despachos por material (solicitud), uso por bobina en impresión, devoluciones registradas.
     */
    public function workOrderMaterialSummary(ReportWorkOrderMaterialSummaryRequest $request): JsonResponse|Response
    {
        $validated = $request->validated();
        $id = (int) $validated['work_order_id'];
        $payload = $this->reports->workOrderMaterialSummary($id);

        if (($validated['format'] ?? null) === 'csv') {
            $rows = [];
            foreach ((array) ($payload['dispatch_by_material'] ?? []) as $row) {
                $rows[] = ['section' => 'dispatch_by_material'] + $row;
            }
            foreach ((array) ($payload['printing_bobina_usages'] ?? []) as $row) {
                $rows[] = ['section' => 'printing_bobina_usages'] + $row;
            }
            foreach ((array) ($payload['corte_bobina_usages'] ?? []) as $row) {
                $rows[] = ['section' => 'corte_bobina_usages'] + $row;
            }
            foreach ((array) ($payload['laminacion_bobina_usages'] ?? []) as $row) {
                $rows[] = ['section' => 'laminacion_bobina_usages'] + $row;
            }
            foreach ((array) ($payload['montaje_material_usages'] ?? []) as $row) {
                $rows[] = ['section' => 'montaje_material_usages'] + $row;
            }
            foreach ((array) ($payload['inventory_returns'] ?? []) as $row) {
                $rows[] = ['section' => 'inventory_returns'] + $row;
            }
            $csv = $this->reports->rowsToCsv($rows);

            return new Response($csv, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="work-order-material-summary-'.$id.'.csv"',
            ]);
        }

        return response()->json($payload);
    }

    /**
     * Reporte: consumo agregado por cliente y producto (salidas ligadas a OT vía solicitud).
     */
    public function consumptionByClientProduct(ReportDateRangeRequest $request): JsonResponse|Response
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $payload = $this->reports->consumptionByClientAndProduct($from, $to);

        if (($validated['format'] ?? null) === 'csv') {
            $csv = $this->reports->rowsToCsv((array) ($payload['rows'] ?? []));

            return new Response($csv, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="consumption-by-client-product-'.$from->format('Ymd').'-'.$to->format('Ymd').'.csv"',
            ]);
        }

        return response()->json($payload);
    }

    /**
     * Reporte: inventario del área bobinas rechazadas (kg por material + bobinas registradas con OT vía devolución).
     */
    public function rejectedBobinas(ReportDateRangeRequest $request): JsonResponse|Response
    {
        $validated = $request->validated();
        $payload = $this->reports->rejectedBobinasInventory();

        if (($validated['format'] ?? null) === 'csv') {
            $rows = [];
            foreach ((array) ($payload['materials'] ?? []) as $row) {
                $rows[] = ['section' => 'materials'] + $row;
            }
            foreach ((array) ($payload['bobinas'] ?? []) as $row) {
                $rows[] = ['section' => 'bobinas'] + $row;
            }
            $csv = $this->reports->rowsToCsv($rows);

            return new Response($csv, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="rejected-bobinas.csv"',
            ]);
        }

        return response()->json($payload);
    }

    /**
     * Tiempos de producción por área y tipo de segmento (PDF reportes de tiempos / utilización).
     */
    public function productionTimeByArea(ReportDateRangeRequest $request): JsonResponse|Response
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $payload = $this->reports->productionTimesByArea($from, $to);

        if (($validated['format'] ?? null) === 'csv') {
            $csv = $this->reports->rowsToCsv((array) ($payload['rows'] ?? []));

            return new Response($csv, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="production-time-by-area-'.$from->format('Ymd').'-'.$to->format('Ymd').'.csv"',
            ]);
        }

        return response()->json($payload);
    }

    /**
     * Mermas registradas por OT y área (filtro cliente/producto).
     */
    public function scrapByFilters(ScrapReportRequest $request): JsonResponse|Response
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $payload = $this->reports->scrapByFilters(
            $from,
            $to,
            isset($validated['client_id']) ? (int) $validated['client_id'] : null,
            isset($validated['product_id']) ? (int) $validated['product_id'] : null,
        );

        if (($validated['format'] ?? null) === 'csv') {
            $csv = $this->reports->rowsToCsv((array) ($payload['rows'] ?? []));

            return new Response($csv, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="scrap-by-filters-'.$from->format('Ymd').'-'.$to->format('Ymd').'.csv"',
            ]);
        }

        return response()->json($payload);
    }

    /**
     * Consumo de tintas / cementerio / químicos por cliente (salidas vía solicitud).
     */
    public function tintaConsumptionByClient(ReportDateRangeRequest $request): JsonResponse|Response
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $payload = $this->reports->tintaConsumptionByClient($from, $to);

        if (($validated['format'] ?? null) === 'csv') {
            $csv = $this->reports->rowsToCsv((array) ($payload['rows'] ?? []));

            return new Response($csv, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="tinta-consumption-by-client-'.$from->format('Ymd').'-'.$to->format('Ymd').'.csv"',
            ]);
        }

        return response()->json($payload);
    }

    /**
     * Reporte de tiempos por OT y/o rango (CSV/JSON).
     */
    public function workOrderTimeReport(WorkOrderTimeReportRequest $request): JsonResponse|Response
    {
        $payload = $this->workOrderTimeReportPayload($request);

        if (($request->validated()['format'] ?? null) === 'csv') {
            $csv = $this->reports->rowsToCsv((array) ($payload['rows_csv'] ?? []));

            return new Response($csv, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="'.$this->workOrderTimeReportFileBase($payload).'.csv"',
            ]);
        }

        return response()->json($payload);
    }

    /**
     * Vista previa HTML del reporte de tiempos.
     */
    public function workOrderTimeReportPreview(WorkOrderTimeReportRequest $request): Response
    {
        $payload = $this->workOrderTimeReportPayload($request);
        $html = View::make('pdf.work_order_time_report', [
            'report' => $payload,
            'generatedBy' => (string) ($request->user()?->name ?? 'Usuario no identificado'),
            'generatedAt' => now(),
        ])->render();

        return new Response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="'.$this->workOrderTimeReportFileBase($payload).'.html"',
        ]);
    }

    /**
     * Descarga PDF del reporte de tiempos.
     */
    public function workOrderTimeReportPdf(WorkOrderTimeReportRequest $request): Response
    {
        $payload = $this->workOrderTimeReportPayload($request);
        $html = View::make('pdf.work_order_time_report', [
            'report' => $payload,
            'generatedBy' => (string) ($request->user()?->name ?? 'Usuario no identificado'),
            'generatedAt' => now(),
        ])->render();
        $pdf = Pdf::loadHTML($html)->setPaper('a4', 'landscape');

        return $pdf->download($this->workOrderTimeReportFileBase($payload).'.pdf');
    }

    /**
     * @return array<string, mixed>
     */
    private function workOrderTimeReportPayload(WorkOrderTimeReportRequest $request): array
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $woId = isset($validated['work_order_id']) ? (int) $validated['work_order_id'] : null;

        return $this->reports->workOrderTimeReport($from, $to, $woId);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function workOrderTimeReportFileBase(array $payload): string
    {
        $tag = 'rango-'.Carbon::parse((string) $payload['from'])->format('Ymd').'-'.Carbon::parse((string) $payload['to'])->format('Ymd');
        if (! empty($payload['work_order'])) {
            $code = (string) ($payload['work_order']['code'] ?? ('ot-'.$payload['work_order_id']));
            $code = str_replace(['/', '\\', ' '], '-', $code);
            $tag = $code.'-'.$tag;
        }

        return 'reporte-tiempos-'.$tag;
    }

    /**
     * @return array<string, mixed>
     */
    private function inventoryAreaDailyPayload(ReportInventoryAreaDailyRequest $request): array
    {
        $validated = $request->validated();
        $date = Carbon::parse($validated['date'])->startOfDay();
        $area = isset($validated['inventory_area']) ? (string) $validated['inventory_area'] : null;

        return $this->reports->inventoryAreaDailySnapshot($date, $area);
    }

    /**
     * @return array<string, mixed>
     */
    private function inventoryMovementsGeneralPayload(ReportInventoryMovementsRequest $request): array
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();

        return $this->reports->inventoryMovementsGeneralReport($from, $to, [
            'movement_type' => $validated['movement_type'] ?? null,
            'inventory_area' => $validated['inventory_area'] ?? null,
            'reference_type' => $validated['reference_type'] ?? null,
            'invalid_only' => isset($validated['invalid_only']) ? (bool) $validated['invalid_only'] : false,
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function buildInventoryAreaDailyHtml(array $payload, string $generatedBy): string
    {
        return View::make('certificates.inventory_area_daily', [
            'report' => $payload,
            'generatedBy' => $generatedBy,
            'generatedAt' => now(),
        ])->render();
    }
}
