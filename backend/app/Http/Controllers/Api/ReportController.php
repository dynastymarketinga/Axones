<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReportDateRangeRequest;
use App\Http\Requests\ReportInventoryAreaDailyRequest;
use App\Http\Requests\ReportInventoryMovementsRequest;
use App\Http\Requests\ReportConsumablesSummaryRequest;
use App\Http\Requests\ReportProductionMaterialSummaryRequest;
use App\Http\Requests\ReportRejectedBobinasRequest;
use App\Http\Requests\ReportWorkOrderMaterialSummaryRequest;
use App\Http\Requests\ScrapReportRequest;
use App\Http\Requests\WorkOrderTimeReportRequest;
use App\Models\Supplier;
use App\Models\WorkOrder;
use App\Services\InventoryReportService;
use App\Support\ScrapSubstrateCatalog;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
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
     * Resumen de controles por OT: consumibles y tiempos (impresión, laminación, corte).
     */
    public function workOrderControlsSummary(ReportWorkOrderMaterialSummaryRequest $request): JsonResponse|Response
    {
        $payload = $this->workOrderControlsSummaryPayload($request);

        if (($request->validated()['format'] ?? null) === 'csv') {
            $rows = [];
            $wo = (array) ($payload['work_order'] ?? []);
            $rows[] = [
                'section' => 'work_order',
                'code' => $wo['code'] ?? '',
                'client_name' => $wo['client_name'] ?? '',
                'product_name' => $wo['product_name'] ?? '',
            ];

            foreach ((array) (($payload['times']['by_area'] ?? []) ?: []) as $row) {
                $rows[] = ['section' => 'times_by_area'] + $row;
            }
            $rows[] = ['section' => 'times_totals'] + (array) ($payload['times']['totals'] ?? []);

            $ps = (array) ($payload['production_summary'] ?? []);
            if ($ps !== []) {
                $rows[] = ['section' => 'production_summary'] + $this->flattenProductionSummaryForCsv($ps);
            }

            foreach ((array) ($payload['consumables']['by_area'] ?? []) as $area => $block) {
                foreach ((array) ($block['bobina_usages'] ?? []) as $row) {
                    $rows[] = ['section' => 'bobina_usages', 'area' => $area] + $row;
                }
                foreach ((array) ($block['ink_control_lines'] ?? []) as $row) {
                    $rows[] = ['section' => 'ink_control_lines', 'area' => $area] + $row;
                }
                foreach ((array) ($block['chemical_usages'] ?? []) as $row) {
                    $rows[] = ['section' => 'chemical_usages', 'area' => $area] + $row;
                }
                if ($area === 'laminacion') {
                    $rows[] = [
                        'section' => 'laminacion_solvent',
                        'area' => $area,
                        'solvent_quantity_kg' => $block['solvent_quantity_kg'] ?? '0.000',
                        'solvent_notes' => $block['solvent_notes'] ?? '',
                    ];
                }
            }

            $csv = $this->reports->rowsToCsv($rows);
            $id = (int) ($wo['id'] ?? 0);

            return new Response($csv, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="resumen-ot-controles-'.$id.'.csv"',
            ]);
        }

        return response()->json($payload);
    }

    /**
     * Vista previa HTML del resumen de controles por OT.
     */
    public function workOrderControlsSummaryPreview(ReportWorkOrderMaterialSummaryRequest $request): Response
    {
        $payload = $this->workOrderControlsSummaryPayload($request);
        $html = View::make('pdf.work_order_controls_summary', [
            'report' => $payload,
            'generatedBy' => (string) ($request->user()?->name ?? 'Usuario no identificado'),
            'generatedAt' => now(),
        ])->render();

        return new Response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="'.$this->workOrderControlsSummaryFileBase($payload).'.html"',
        ]);
    }

    /**
     * Descarga PDF del resumen de controles por OT.
     */
    public function workOrderControlsSummaryPdf(ReportWorkOrderMaterialSummaryRequest $request): Response
    {
        $payload = $this->workOrderControlsSummaryPayload($request);
        $html = View::make('pdf.work_order_controls_summary', [
            'report' => $payload,
            'generatedBy' => (string) ($request->user()?->name ?? 'Usuario no identificado'),
            'generatedAt' => now(),
        ])->render();
        $pdf = Pdf::loadHTML($html)->setPaper('a4', 'portrait');

        return $pdf->download($this->workOrderControlsSummaryFileBase($payload).'.pdf');
    }

    /**
     * @return array<string, mixed>
     */
    private function workOrderControlsSummaryPayload(ReportWorkOrderMaterialSummaryRequest $request): array
    {
        $validated = $request->validated();
        $id = (int) $validated['work_order_id'];

        return $this->reports->workOrderControlsSummary($id);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function workOrderControlsSummaryFileBase(array $payload): string
    {
        $wo = (array) ($payload['work_order'] ?? []);
        $code = (string) ($wo['code'] ?? ('ot-'.($wo['id'] ?? '0')));
        $code = str_replace(['/', '\\', ' '], '-', $code);

        return 'resumen-ot-controles-'.$code;
    }

    /**
     * @param  array<string, mixed>  $ps
     * @return array<string, mixed>
     */
    private function flattenProductionSummaryForCsv(array $ps): array
    {
        $virgin = (array) ($ps['virgin_material'] ?? []);
        $listo = (array) ($ps['material_listo'] ?? []);
        $impreso = (array) ($listo['impreso'] ?? []);
        $laminado = (array) ($listo['laminado'] ?? []);
        $scrap = (array) ($ps['scrap'] ?? []);
        $tintas = (array) ($ps['tintas'] ?? []);
        $lamQ = (array) ($ps['laminacion_quimicos'] ?? []);

        return [
            'printing_total_entrada_kg' => $virgin['printing_total_entrada_kg'] ?? '0.000',
            'laminacion_total_virgen_kg' => $virgin['laminacion_total_virgen_kg'] ?? '0.000',
            'impreso_num_bobinas' => $impreso['num_bobinas'] ?? 0,
            'impreso_peso_total_kg' => $impreso['peso_total_kg'] ?? '0.000',
            'laminado_peso_total_kg' => $laminado['peso_total_salida_kg'] ?? '0.000',
            'laminado_num_bobinas' => $laminado['num_bobinas'] ?? 0,
            'corte_kg_salida' => $listo['corte_kg_salida'] ?? '0.000',
            'total_listo_despacho_kg' => $listo['total_listo_despacho_kg'] ?? '0.000',
            'total_general_kg' => $listo['total_general_kg'] ?? '0.000',
            'scrap_grand_total_kg' => $scrap['grand_total_kg'] ?? '0.000',
            'tintas_total_original_kg' => $tintas['total_original_kg'] ?? '0.000',
            'tintas_total_solventadas_kg' => $tintas['total_solventadas_kg'] ?? '0.000',
            'tintas_alcohol_kg' => $tintas['alcohol_kg'] ?? '0.000',
            'tintas_metoxil_kg' => $tintas['metoxil_kg'] ?? '0.000',
            'tintas_npa_kg' => $tintas['npa_kg'] ?? '0.000',
            'lam_adhesivo_kg' => $lamQ['adhesivo_consumido_kg'] ?? '0.000',
            'lam_catalizador_kg' => $lamQ['catalizador_consumido_kg'] ?? '0.000',
            'lam_acetato_lt' => $lamQ['acetato_consumido_lt'] ?? '0.000',
        ];
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
     * Vista rápida: stock del área bobinas rechazadas (panel / snapshot sin rango).
     */
    public function rejectedBobinasInventory(): JsonResponse
    {
        return response()->json($this->reports->rejectedBobinasInventory());
    }

    /**
     * Reporte descargable de bobinas rechazadas (número, proveedor, peso, motivo) filtrado por fecha y proveedor.
     */
    public function rejectedBobinas(ReportRejectedBobinasRequest $request): JsonResponse|Response
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $supplierId = isset($validated['supplier_id']) ? (int) $validated['supplier_id'] : null;
        $payload = $this->reports->rejectedBobinasReport($from, $to, $supplierId);

        if (($validated['format'] ?? null) === 'pdf') {
            $supplierName = $supplierId !== null ? Supplier::query()->whereKey($supplierId)->value('name') : null;
            $logoDataUri = Cache::rememberForever('brand:logo-axones-var-01:data-uri', static function (): string {
                $logoPath = public_path('brand/logo-axones-var-01.png');
                if (! is_readable($logoPath)) {
                    return '';
                }

                return 'data:image/png;base64,'.base64_encode((string) file_get_contents($logoPath));
            });

            $pdfCacheKey = 'reports:rejected-bobinas:pdf:v1:'.sha1(json_encode([
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'supplier_id' => $supplierId,
                'rows_hash' => sha1(json_encode($payload['rows'] ?? [])),
            ], JSON_UNESCAPED_UNICODE));

            $pdfBinary = Cache::remember($pdfCacheKey, now()->addMinutes(10), function () use (
                $payload,
                $supplierName,
                $request,
                $logoDataUri
            ): string {
                $html = View::make('pdf.rejected_bobinas', [
                    'report' => $payload,
                    'supplierName' => $supplierName,
                    'generatedBy' => (string) ($request->user()?->name ?? 'Usuario no identificado'),
                    'generatedAt' => now(),
                    'logoDataUri' => $logoDataUri,
                ])->render();

                return Pdf::loadHTML($html)->setPaper('a4', 'landscape')->output();
            });

            return new Response($pdfBinary, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="bobinas-rechazadas-'.$from->format('Ymd').'-'.$to->format('Ymd').'.pdf"',
            ]);
        }

        if (($validated['format'] ?? null) === 'csv') {
            $csvRows = array_map(static function (array $row): array {
                return [
                    'numero_bobina' => $row['numero_bobina'] ?? '',
                    'proveedor' => $row['proveedor'] ?? '',
                    'operador' => $row['operador'] ?? '',
                    'material' => $row['material'] ?? '',
                    'peso_kg' => $row['peso_kg'] ?? '',
                    'motivo' => $row['motivo'] ?? '',
                    'observacion' => $row['observacion'] ?? '',
                    'fecha_bobina' => $row['fecha_bobina'] ?? '',
                    'fecha_registro' => $row['fecha_registro'] ?? '',
                    'work_order_code' => $row['work_order_code'] ?? '',
                ];
            }, (array) ($payload['rows'] ?? []));
            $csv = $this->reports->rowsToCsv($csvRows, ';', true, 'Bobinas rechazadas');

            return new Response($csv, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="bobinas-rechazadas-'.$from->format('Ymd').'-'.$to->format('Ymd').'.csv"',
            ]);
        }

        return response()->json($payload);
    }

    /**
     * Vista previa HTML del PDF de bobinas rechazadas.
     */
    public function rejectedBobinasPreview(ReportRejectedBobinasRequest $request): Response
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $supplierId = isset($validated['supplier_id']) ? (int) $validated['supplier_id'] : null;
        $payload = $this->reports->rejectedBobinasReport($from, $to, $supplierId);
        $supplierName = $supplierId !== null ? Supplier::query()->whereKey($supplierId)->value('name') : null;
        $logoDataUri = Cache::rememberForever('brand:logo-axones-var-01:data-uri', static function (): string {
            $logoPath = public_path('brand/logo-axones-var-01.png');
            if (! is_readable($logoPath)) {
                return '';
            }

            return 'data:image/png;base64,'.base64_encode((string) file_get_contents($logoPath));
        });

        $html = View::make('pdf.rejected_bobinas', [
            'report' => $payload,
            'supplierName' => $supplierName,
            'generatedBy' => (string) ($request->user()?->name ?? 'Usuario no identificado'),
            'generatedAt' => now(),
            'logoDataUri' => $logoDataUri,
        ])->render();

        return new Response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="bobinas-rechazadas-preview-'.$from->format('Ymd').'-'.$to->format('Ymd').'.html"',
        ]);
    }

    /**
     * Tiempos de producción por área y tipo de segmento (PDF reportes de tiempos / utilización).
     */
    public function productionTimeByArea(ReportDateRangeRequest $request): JsonResponse|Response
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $live = (bool) ($validated['live'] ?? false);
        $payload = $this->reports->productionTimesByArea($from, $to, $live);

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
     * Resumen mensual de desperdicio total (kg) en el rango.
     */
    public function scrapMonthlySummary(ScrapReportRequest $request): JsonResponse|Response
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $payload = $this->reports->scrapMonthlySummary(
            $from,
            $to,
            isset($validated['client_id']) ? (int) $validated['client_id'] : null,
            isset($validated['product_id']) ? (int) $validated['product_id'] : null,
        );

        if (($validated['format'] ?? null) === 'csv') {
            $csv = $this->reports->rowsToCsv((array) ($payload['rows'] ?? []));

            return new Response($csv, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="desperdicio-resumen-mensual-'.$from->format('Ymd').'-'.$to->format('Ymd').'.csv"',
            ]);
        }

        return response()->json($payload);
    }

    /**
     * Resumen global de material producido (impresión, laminación, corte) filtrado por fecha y cliente.
     */
    public function productionMaterialSummary(ReportProductionMaterialSummaryRequest $request): JsonResponse|Response
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $clientId = isset($validated['client_id']) ? (int) $validated['client_id'] : null;
        $payload = $this->reports->productionMaterialSummary($from, $to, $clientId);

        if (($validated['format'] ?? null) === 'csv') {
            $csvRows = [
                [
                    'section' => 'resumen',
                    'work_order_code' => 'TOTAL',
                    'client_name' => '',
                    'material_impreso_kg' => $payload['totals']['material_impreso_kg'] ?? '0.000',
                    'material_laminado_kg' => $payload['totals']['material_laminado_kg'] ?? '0.000',
                    'material_cortado_kg' => $payload['totals']['material_cortado_kg'] ?? '0.000',
                    'total_general_kg' => $payload['totals']['total_general_kg'] ?? '0.000',
                    'impreso_bobinas' => $payload['totals']['impreso_bobinas'] ?? 0,
                    'laminado_bobinas' => $payload['totals']['laminado_bobinas'] ?? 0,
                ],
            ];
            foreach ((array) ($payload['work_orders'] ?? []) as $row) {
                $csvRows[] = ['section' => 'detalle'] + $row + [
                    'total_general_kg' => number_format(
                        (float) ($row['material_impreso_kg'] ?? 0)
                        + (float) ($row['material_laminado_kg'] ?? 0)
                        + (float) ($row['material_cortado_kg'] ?? 0),
                        3,
                        '.',
                        '',
                    ),
                ];
            }
            $csv = $this->reports->rowsToCsv($csvRows);

            return new Response($csv, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="resumen-produccion-material-'.$from->format('Ymd').'-'.$to->format('Ymd').'.csv"',
            ]);
        }

        return response()->json($payload);
    }

    /**
     * Resumen de consumibles (tintas, químicos laminación, entradas de material) por período.
     */
    public function consumablesSummary(ReportConsumablesSummaryRequest $request): JsonResponse|Response
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $clientId = isset($validated['client_id']) ? (int) $validated['client_id'] : null;
        $payload = $this->reports->consumablesSummary($from, $to, $clientId);

        if (($validated['format'] ?? null) === 'csv') {
            $totals = (array) ($payload['totals'] ?? []);
            $tintas = (array) ($totals['tintas'] ?? []);
            $lam = (array) ($totals['laminacion'] ?? []);
            $imp = (array) ($totals['impresion'] ?? []);

            $csvRows = [
                [
                    'section' => 'resumen',
                    'work_order_code' => 'TOTAL',
                    'client_name' => '',
                    'tintas_original_kg' => $tintas['total_original_kg'] ?? '0.000',
                    'tintas_solventadas_kg' => $tintas['total_solventadas_kg'] ?? '0.000',
                    'tintas_alcohol_kg' => $tintas['alcohol_kg'] ?? '0.000',
                    'tintas_metoxil_kg' => $tintas['metoxil_kg'] ?? '0.000',
                    'tintas_npa_kg' => $tintas['npa_kg'] ?? '0.000',
                    'lam_adhesivo_sobra_kg' => $lam['adhesivo_sobra_kg'] ?? '0.000',
                    'lam_catalizador_sobra_kg' => $lam['catalizador_sobra_kg'] ?? '0.000',
                    'lam_acetato_sobra_lt' => $lam['acetato_sobra_lt'] ?? '0.000',
                    'lam_adhesivo_consumido_kg' => $lam['adhesivo_consumido_kg'] ?? '0.000',
                    'lam_catalizador_consumido_kg' => $lam['catalizador_consumido_kg'] ?? '0.000',
                    'lam_acetato_consumido_lt' => $lam['acetato_consumido_lt'] ?? '0.000',
                    'lam_total_consumible_kg' => $lam['total_consumible_kg'] ?? '0.000',
                    'laminacion_virgen_entrada_kg' => $lam['material_virgen_entrada_kg'] ?? '0.000',
                    'impresion_material_consumido_kg' => $imp['material_consumido_kg'] ?? '0.000',
                ],
            ];
            foreach ((array) ($payload['work_orders'] ?? []) as $row) {
                $csvRows[] = ['section' => 'detalle'] + $row + [
                    'lam_total_consumible_kg' => number_format(
                        (float) ($row['lam_adhesivo_consumido_kg'] ?? 0)
                        + (float) ($row['lam_catalizador_consumido_kg'] ?? 0),
                        3,
                        '.',
                        '',
                    ),
                    'impresion_material_consumido_kg' => $row['impresion_entrada_kg'] ?? '0.000',
                ];
            }
            $csv = $this->reports->rowsToCsv($csvRows);

            return new Response($csv, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="reporte-consumibles-'.$from->format('Ymd').'-'.$to->format('Ymd').'.csv"',
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
     * Listado de OT con tiempo registrado en el rango (por área).
     */
    public function workOrderTimeReportCandidates(WorkOrderTimeReportRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $live = (bool) ($validated['live'] ?? false);

        return response()->json($this->reports->workOrderTimeReportCandidates($from, $to, $live));
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
