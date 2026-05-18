<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReportDateRangeRequest;
use App\Http\Requests\ReportInventoryAreaDailyRequest;
use App\Http\Requests\ReportInventoryMovementsRequest;
use App\Http\Requests\ReportWorkOrderMaterialSummaryRequest;
use App\Http\Requests\ScrapReportRequest;
use App\Http\Requests\WorkOrderTimeReportRequest;
use App\Models\WorkOrder;
use App\Services\InventoryReportService;
use App\Support\ScrapSubstrateCatalog;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\View;
use Illuminate\Validation\ValidationException;

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
     * Vista previa HTML del reporte general de tiempos por área.
     */
    public function productionTimeByAreaPreview(ReportDateRangeRequest $request): Response
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $payload = $this->reports->productionTimesByArea($from, $to);
        $html = View::make('pdf.production_time_by_area', [
            'report' => $payload,
            'generatedBy' => (string) ($request->user()?->name ?? 'Usuario no identificado'),
            'generatedAt' => now(),
        ])->render();

        return new Response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="production-time-by-area-preview-'.$from->format('Ymd').'-'.$to->format('Ymd').'.html"',
        ]);
    }

    /**
     * Descarga PDF del reporte general de tiempos por área.
     */
    public function productionTimeByAreaPdf(ReportDateRangeRequest $request): Response
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $payload = $this->reports->productionTimesByArea($from, $to);
        $html = View::make('pdf.production_time_by_area', [
            'report' => $payload,
            'generatedBy' => (string) ($request->user()?->name ?? 'Usuario no identificado'),
            'generatedAt' => now(),
        ])->render();
        $pdf = Pdf::loadHTML($html)->setPaper('a4', 'landscape');

        return $pdf->download('production-time-by-area-'.$from->format('Ymd').'-'.$to->format('Ymd').'.pdf');
    }

    /**
     * Catálogo de grupos de sustrato para el reporte de desperdicio (pestañas BOPP / PE / etc.).
     */
    public function scrapSubstrateConfig(): JsonResponse
    {
        return response()->json([
            'groups' => ScrapSubstrateCatalog::publicConfig(),
            'rules' => [
                'explicit_field' => 'corDesperdicioSustrato',
                'ambiguous_structure_requires_explicit' => true,
            ],
        ]);
    }

    /**
     * Desperdicio (% scrap) por OT y área (filtro cliente/producto, sustrato y layout de exportación).
     */
    public function scrapByFilters(ScrapReportRequest $request): JsonResponse|Response
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $substrateGroup = (string) ($validated['substrate_group'] ?? 'all');
        $layout = (string) ($validated['layout'] ?? 'detail');
        $woFilterId = $this->resolveScrapWorkOrderFilterId($validated);
        $payload = $this->reports->scrapByFilters(
            $from,
            $to,
            isset($validated['client_id']) ? (int) $validated['client_id'] : null,
            isset($validated['product_id']) ? (int) $validated['product_id'] : null,
            $substrateGroup,
            $layout,
            $woFilterId,
        );

        if (($validated['format'] ?? null) === 'csv') {
            $csv = $this->reports->rowsToCsv((array) ($payload['rows'] ?? []));
            $fileBase = $this->scrapReportFileBase($layout, $substrateGroup);

            return new Response($csv, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="'.$fileBase.'-'.$from->format('Ymd').'-'.$to->format('Ymd').'.csv"',
            ]);
        }

        return response()->json($payload);
    }

    /**
     * Vista previa HTML del reporte de desperdicio (mismos filtros que scrap-by-filters; opcional foco en una OT).
     */
    public function scrapByFiltersPreview(ScrapReportRequest $request): Response
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $payload = $this->scrapDocumentPayload($request);
        $html = View::make('pdf.scrap_desperdicio', [
            'report' => $payload,
        ])->render();

        return new Response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="desperdicio-preview-'.$from->format('Ymd').'-'.$to->format('Ymd').'.html"',
        ]);
    }

    /**
     * PDF del reporte de desperdicio.
     */
    public function scrapByFiltersPdf(ScrapReportRequest $request): Response
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $substrateGroup = (string) ($validated['substrate_group'] ?? 'all');
        $layout = (string) ($validated['layout'] ?? 'detail');
        $payload = $this->scrapDocumentPayload($request);
        $html = View::make('pdf.scrap_desperdicio', [
            'report' => $payload,
        ])->render();
        $orientation = in_array($layout, ['by_work_order', 'history_kg'], true) ? 'landscape' : 'portrait';
        $pdf = Pdf::loadHTML($html)->setPaper('a4', $orientation);
        $fileBase = $this->scrapReportFileBase($layout, $substrateGroup);

        return $pdf->download($fileBase.'-'.$from->format('Ymd').'-'.$to->format('Ymd').'.pdf');
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
     * Listado de OT con tiempo registrado en el rango (por área).
     */
    public function workOrderTimeReportCandidates(WorkOrderTimeReportRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();

        return response()->json($this->reports->workOrderTimeReportCandidates($from, $to));
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

    private function scrapReportFileBase(string $layout, string $substrateGroup): string
    {
        return match ($layout) {
            'by_area' => 'desperdicio-por-area',
            'by_work_order' => 'desperdicio-por-ot',
            'history_kg' => match (ScrapSubstrateCatalog::normalizeGroupId($substrateGroup)) {
                'bopp' => 'desperdicio-historial-kg-bopp',
                'polietileno' => 'desperdicio-historial-kg-polietileno',
                'transparente' => 'desperdicio-historial-kg-transparente',
                default => 'desperdicio-historial-kg',
            },
            default => match (ScrapSubstrateCatalog::normalizeGroupId($substrateGroup)) {
                'bopp' => 'desperdicio-bopp',
                'polietileno' => 'desperdicio-polietileno',
                'transparente' => 'desperdicio-transparente',
                default => 'desperdicio-detalle',
            },
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function scrapDocumentPayload(ScrapReportRequest $request): array
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $substrateGroup = (string) ($validated['substrate_group'] ?? 'all');
        $layout = (string) ($validated['layout'] ?? 'detail');
        $woFilterId = $this->resolveScrapWorkOrderFilterId($validated);
        $payload = $this->reports->scrapByFilters(
            $from,
            $to,
            isset($validated['client_id']) ? (int) $validated['client_id'] : null,
            isset($validated['product_id']) ? (int) $validated['product_id'] : null,
            $substrateGroup,
            $layout,
            $woFilterId,
        );

        $focusWo = isset($validated['focus_work_order_id']) ? (int) $validated['focus_work_order_id'] : null;
        $focusArea = isset($validated['focus_area']) ? (string) $validated['focus_area'] : null;

        if ($focusWo !== null) {
            $rows = (array) ($payload['rows'] ?? []);
            $currentLayout = (string) ($payload['layout'] ?? 'detail');
            $filtered = array_values(array_filter($rows, function (array $r) use ($focusWo, $focusArea, $currentLayout): bool {
                if ((int) ($r['work_order_id'] ?? 0) !== $focusWo) {
                    return false;
                }
                if ($currentLayout === 'detail' && $focusArea !== null && $focusArea !== '') {
                    return (string) ($r['area'] ?? '') === $focusArea;
                }
                if ($currentLayout === 'by_area') {
                    return false;
                }

                return true;
            }));
            $payload['rows'] = $filtered;
        }

        return array_merge($payload, [
            'generatedBy' => (string) ($request->user()?->name ?? 'Usuario no identificado'),
            'generatedAt' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function resolveScrapWorkOrderFilterId(array $validated): ?int
    {
        if (isset($validated['work_order_id'])) {
            return (int) $validated['work_order_id'];
        }
        $code = isset($validated['work_order_code']) ? trim((string) $validated['work_order_code']) : '';
        if ($code === '') {
            return null;
        }
        $id = WorkOrder::query()->where('code', $code)->value('id');
        if ($id === null) {
            throw ValidationException::withMessages([
                'work_order_code' => ['No existe una orden de trabajo con ese código.'],
            ]);
        }

        return (int) $id;
    }
}
