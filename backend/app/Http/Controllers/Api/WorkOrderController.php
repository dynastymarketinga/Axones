<?php

namespace App\Http\Controllers\Api;

use App\Enums\AreaRequestStatus;
use App\Enums\ClientOrderStatus;
use App\Enums\MaterialRequestStatus;
use App\Enums\WorkOrderBoardStage;
use App\Enums\WorkOrderPriority;
use App\Enums\WorkOrderSchedulingStatus;
use App\Enums\WorkOrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\WorkOrderStoreRequest;
use App\Http\Requests\WorkOrderUpdateRequest;
use App\Models\ClientOrder;
use App\Models\ClientOrderLine;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderLine;
use App\Models\WorkOrderProductionItem;
use App\Services\MaterialRequestService;
use App\Services\OperationalAlertService;
use App\Services\ProductionNotificationService;
use App\Services\WorkOrderPlanillaReportService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\View;
use Illuminate\Validation\ValidationException;

class WorkOrderController extends Controller
{
    public function __construct(
        private readonly MaterialRequestService $materialRequests,
        private readonly OperationalAlertService $alerts,
        private readonly ProductionNotificationService $productionNotifications,
        private readonly WorkOrderPlanillaReportService $planillaReport,
    ) {}

    private function parseDateStart(?string $raw): ?Carbon
    {
        $v = trim((string) $raw);
        if ($v === '') {
            return null;
        }
        try {
            return Carbon::parse($v)->startOfDay();
        } catch (\Throwable) {
            return null;
        }
    }

    private function parseDateEnd(?string $raw): ?Carbon
    {
        $v = trim((string) $raw);
        if ($v === '') {
            return null;
        }
        try {
            return Carbon::parse($v)->endOfDay();
        } catch (\Throwable) {
            return null;
        }
    }

    /** Order index aligned with WorkOrderBoardStage declaration order. */
    private function boardStageOrderIndex(string $stage): int
    {
        foreach (WorkOrderBoardStage::cases() as $i => $case) {
            if ($case->value === $stage) {
                return $i;
            }
        }

        return -1;
    }

    /** Etapa del tablero que corresponde al área de solicitud (misma convención que el frontend). */
    private function targetBoardStageForMiArea(string $miArea): string
    {
        return match ($miArea) {
            'montaje' => WorkOrderBoardStage::Montaje->value,
            'laminacion' => WorkOrderBoardStage::Laminacion->value,
            'corte' => WorkOrderBoardStage::Corte->value,
            'impresion', 'tintas' => WorkOrderBoardStage::Impresion->value,
            default => WorkOrderBoardStage::Impresion->value,
        };
    }

    /** Solicitud de coordinación OT más reciente (sin insumos) para un área. */
    private function constrainLatestCoordinationAreaRequest(\Illuminate\Database\Eloquent\Builder $q, string $area): void
    {
        $q->whereNull('material_request_id')
            ->whereRaw(
                'id = (SELECT MAX(ar2.id) FROM area_requests ar2 WHERE ar2.work_order_id = area_requests.work_order_id AND ar2.area = ? AND ar2.material_request_id IS NULL)',
                [$area],
            );
    }

    public function index(Request $request): JsonResponse
    {
        $query = WorkOrder::query()
            ->with(['client', 'product', 'clientOrder', 'technicalDocument', 'creator'])
            ->withCount(['materialRequests', 'lines', 'productionItems'])
            ->orderByDesc('created_at');

        if ($request->boolean('exclude_cancelled')) {
            $query->where('status', '!=', WorkOrderStatus::Cancelled->value);
        }

        if ($request->query('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->query('client_id')) {
            $query->where('client_id', $request->query('client_id'));
        }

        if ($request->query('scheduling_status')) {
            $query->where('scheduling_status', $request->query('scheduling_status'));
        }

        $createdFrom = $this->parseDateStart($request->query('created_from'));
        $createdTo = $this->parseDateEnd($request->query('created_to'));
        if ($createdFrom !== null) {
            $query->where('created_at', '>=', $createdFrom);
        }
        if ($createdTo !== null) {
            $query->where('created_at', '<=', $createdTo);
        }

        $priority = strtolower(trim((string) $request->query('priority', '')));
        if ($priority !== '' && in_array($priority, WorkOrderPriority::values(), true)) {
            $query->where('priority', $priority);
        }

        $allowedAreaKeys = ['impresion', 'laminacion', 'corte', 'tintas', 'montaje'];
        $miArea = strtolower(trim((string) $request->query('mi_area', '')));
        $historialArea = strtolower(trim((string) $request->query('historial_area', '')));
        $targetAreaForPayload = null;
        $areaRequestedFrom = $this->parseDateStart($request->query('area_requested_from'));
        $areaRequestedTo = $this->parseDateEnd($request->query('area_requested_to'));
        $areaReqStatus = strtolower(trim((string) $request->query('area_request_status', '')));
        $onlyPendingArea = $request->boolean('only_pending_area');
        $historialExcludePending = $request->boolean('historial_exclude_pending');
        $areaProcessTag = strtolower(trim((string) $request->query('area_process_tag', '')));

        if ($miArea !== '' && in_array($miArea, $allowedAreaKeys, true)) {
            $targetAreaForPayload = $miArea;
            $mesEstadoKeyActivas = match ($miArea) {
                'montaje' => 'montEstadoArea',
                'impresion' => 'impEstadoArea',
                'laminacion' => 'lamEstadoArea',
                default => null,
            };
            $query->where(function ($outer) use (
                $miArea,
                $areaRequestedFrom,
                $areaRequestedTo,
                $mesEstadoKeyActivas,
            ) {
                $outer->where(function ($active) use ($miArea, $areaRequestedFrom, $areaRequestedTo, $mesEstadoKeyActivas) {
                    $active->whereHas('areaRequests', function ($q) use ($miArea, $areaRequestedFrom, $areaRequestedTo) {
                        $q->where('area', $miArea)
                            ->where('status', AreaRequestStatus::Pending->value);
                        $this->constrainLatestCoordinationAreaRequest($q, $miArea);
                        if ($areaRequestedFrom !== null) {
                            $q->where('created_at', '>=', $areaRequestedFrom);
                        }
                        if ($areaRequestedTo !== null) {
                            $q->where('created_at', '<=', $areaRequestedTo);
                        }
                    });
                    if ($mesEstadoKeyActivas !== null) {
                        $active->whereDoesntHave('technicalDocument', function ($td) use ($mesEstadoKeyActivas) {
                            $td->where("form->{$mesEstadoKeyActivas}", 'finalizada');
                        });
                    }
                });
                // Montaje: lo finalizado en producción va a Historial/Finalizados, no a En curso.
                // Impresión/laminación: En curso incluye subpestaña «Finalizadas» (MES).
                if ($mesEstadoKeyActivas !== null && $miArea !== 'montaje') {
                    $outer->orWhereHas('technicalDocument', function ($td) use ($mesEstadoKeyActivas) {
                        $td->where("form->{$mesEstadoKeyActivas}", 'finalizada');
                    });
                }
            });

            if (in_array($areaProcessTag, ['not_started', 'in_progress', 'active'], true)) {
                $targetStage = $this->targetBoardStageForMiArea($miArea);
                $targetIdx = $this->boardStageOrderIndex($targetStage);
                if ($areaProcessTag === 'not_started') {
                    $before = [];
                    foreach (WorkOrderBoardStage::cases() as $i => $case) {
                        if ($i < $targetIdx) {
                            $before[] = $case->value;
                        }
                    }
                    if ($before !== []) {
                        $query->whereIn('board_stage', $before);
                    } else {
                        $query->whereRaw('1 = 0');
                    }
                } elseif ($areaProcessTag === 'active') {
                    /** Áreas en paralelo: la bandeja usa solicitud al área + MES, no el tablero Kanban. */
                } else {
                    $query->where('board_stage', $targetStage);
                }
            }
        } elseif ($historialArea !== '' && in_array($historialArea, $allowedAreaKeys, true)) {
            $targetAreaForPayload = $historialArea;
            $mesEstadoKey = match ($historialArea) {
                'montaje' => 'montEstadoArea',
                'impresion' => 'impEstadoArea',
                'laminacion' => 'lamEstadoArea',
                default => null,
            };
            $query->where(function ($outer) use (
                $historialArea,
                $areaRequestedFrom,
                $areaRequestedTo,
                $areaReqStatus,
                $onlyPendingArea,
                $historialExcludePending,
                $mesEstadoKey,
            ) {
                $outer->whereHas('areaRequests', function ($q) use (
                    $historialArea,
                    $areaRequestedFrom,
                    $areaRequestedTo,
                    $areaReqStatus,
                    $onlyPendingArea,
                    $historialExcludePending,
                ) {
                    $q->where('area', $historialArea);
                    $this->constrainLatestCoordinationAreaRequest($q, $historialArea);
                    if ($onlyPendingArea) {
                        $q->where('status', AreaRequestStatus::Pending->value);
                    } elseif ($historialExcludePending) {
                        $q->where('status', '!=', AreaRequestStatus::Pending->value);
                    } elseif ($areaReqStatus !== '' && $areaReqStatus !== 'all') {
                        $allowed = [
                            AreaRequestStatus::Pending->value,
                            AreaRequestStatus::Done->value,
                            AreaRequestStatus::Cancelled->value,
                        ];
                        if (in_array($areaReqStatus, $allowed, true)) {
                            $q->where('status', $areaReqStatus);
                        }
                    }
                    if ($areaRequestedFrom !== null) {
                        $q->where('created_at', '>=', $areaRequestedFrom);
                    }
                    if ($areaRequestedTo !== null) {
                        $q->where('created_at', '<=', $areaRequestedTo);
                    }
                });
                if ($mesEstadoKey !== null && $historialExcludePending) {
                    $outer->orWhereHas('technicalDocument', function ($td) use ($mesEstadoKey) {
                        $td->where("form->{$mesEstadoKey}", 'finalizada');
                    });
                }
            });
        } elseif (($rawIn = $request->query('board_stage_in')) !== null && $rawIn !== '') {
            $rawList = is_array($rawIn) ? $rawIn : explode(',', (string) $rawIn);
            $allowedStages = WorkOrderBoardStage::values();
            $safe = [];
            foreach ($rawList as $item) {
                $v = strtolower(trim((string) $item));
                if ($v !== '' && in_array($v, $allowedStages, true)) {
                    $safe[] = $v;
                }
            }
            $safe = array_values(array_unique($safe));
            if ($safe !== []) {
                $query->whereIn('board_stage', $safe);
            }
        } elseif ($request->query('board_stage')) {
            $query->where('board_stage', $request->query('board_stage'));
        } elseif ($areaHistory = $request->query('area_history')) {
            $stages = match (strtolower(trim((string) $areaHistory))) {
                'printing', 'impresion' => [
                    WorkOrderBoardStage::Impresion->value,
                    WorkOrderBoardStage::Laminacion->value,
                    WorkOrderBoardStage::Corte->value,
                    WorkOrderBoardStage::Completada->value,
                ],
                'laminacion' => [
                    WorkOrderBoardStage::Laminacion->value,
                    WorkOrderBoardStage::Corte->value,
                    WorkOrderBoardStage::Completada->value,
                ],
                'corte' => [
                    WorkOrderBoardStage::Corte->value,
                    WorkOrderBoardStage::Completada->value,
                ],
                default => [],
            };
            if ($stages !== []) {
                $query->whereIn('board_stage', $stages);
            }
        }

        if ($q = trim((string) $request->query('q', ''))) {
            $escaped = addcslashes($q, '%_\\');
            $query->where(function ($inner) use ($escaped) {
                $inner->where('code', 'like', '%'.$escaped.'%')
                    ->orWhere('client_order_reference', 'like', '%'.$escaped.'%')
                    ->orWhereHas('product', function ($p) use ($escaped) {
                        $p->where('name', 'like', '%'.$escaped.'%')
                            ->orWhere('cpe', 'like', '%'.$escaped.'%');
                    })
                    ->orWhereHas('client', function ($clientQ) use ($escaped) {
                        $clientQ->where('name', 'like', '%'.$escaped.'%');
                    });
            });
        } elseif (($cor = trim((string) $request->query('client_order_reference', ''))) !== '') {
            $escapedCor = addcslashes($cor, '%_\\');
            $query->where('client_order_reference', 'like', '%'.$escapedCor.'%');
        }

        if ($request->query('client_order_id')) {
            $query->where('client_order_id', $request->query('client_order_id'));
        }

        if ($targetAreaForPayload !== null) {
            $query->with(['areaRequests' => function ($q) use ($targetAreaForPayload) {
                $q->select(['id', 'area', 'status', 'work_order_id', 'created_at'])
                    ->where('area', $targetAreaForPayload)
                    ->whereNull('material_request_id')
                    ->orderByDesc('created_at');
            }]);
        }

        $paginator = $query->paginate(min((int) $request->query('per_page', 20), 100));

        $areasForTimeSummary = [];
        if ($targetAreaForPayload !== null && in_array($targetAreaForPayload, ['corte', 'tintas'], true)) {
            $areasForTimeSummary[] = $targetAreaForPayload;
        }
        foreach ($this->parseIncludeAreaSummaries($request) as $area) {
            if (! in_array($area, $areasForTimeSummary, true)) {
                $areasForTimeSummary[] = $area;
            }
        }

        if ($areasForTimeSummary !== []) {
            $timeService = app(\App\Services\AreaBandejaTimeService::class);
            $ids = $paginator->getCollection()->pluck('id');
            foreach ($areasForTimeSummary as $summaryArea) {
                $summaries = $timeService->summariesForWorkOrderIds($ids, $summaryArea);
                $paginator->getCollection()->transform(function ($workOrder) use ($summaries) {
                    $id = (int) $workOrder->getKey();
                    $workOrder->setAttribute('area_time_summary', $summaries[$id] ?? null);

                    return $workOrder;
                });
            }
        }

        return response()->json($paginator);
    }

    /**
     * Tablero Kanban: todas las OT abiertas agrupadas por columna (board_stage).
     */
    public function programacionBoard(): JsonResponse
    {
        $orders = WorkOrder::query()
            ->with(['client', 'product', 'clientOrder', 'lines.material', 'productionItems'])
            ->withCount(['materialRequests', 'lines'])
            ->where('status', '!=', WorkOrderStatus::Cancelled->value)
            ->orderByDesc('created_at')
            ->get();

        $grouped = $orders->groupBy(fn (WorkOrder $o) => $o->board_stage->value);
        $columns = [];
        foreach (WorkOrderBoardStage::cases() as $case) {
            $columns[$case->value] = $grouped->get($case->value, collect())->values();
        }

        $pendingClientOrders = ClientOrder::query()
            ->awaitingProductionOt()
            ->with(['client', 'firstLineWithProduct.product', 'lines.product'])
            ->withCount('lines')
            ->orderByDesc('created_at')
            ->get()
            ->values();

        return response()->json([
            'columns' => $columns,
            'pending_client_orders' => $pendingClientOrders,
        ]);
    }

    public function store(WorkOrderStoreRequest $request): JsonResponse
    {
        $data = $request->validated();
        $linesInput = $data['lines'] ?? [];
        $productionItemsInput = $data['production_items'] ?? [];
        $importLines = (bool) ($data['import_client_order_lines'] ?? false);
        $autoCreate = $data['auto_create_material_request'] ?? true;
        $originatingArea = $data['originating_area'] ?? null;
        $mrNotes = $data['material_request_notes'] ?? null;

        unset(
            $data['lines'],
            $data['production_items'],
            $data['import_client_order_lines'],
            $data['auto_create_material_request'],
            $data['originating_area'],
            $data['material_request_notes'],
        );

        $this->applyClientOrderToWorkOrderPayload($data);

        if ($importLines) {
            $linesInput = $this->buildWorkOrderLinesFromClientOrder((int) $data['client_order_id']);
        }

        $data['code'] = $data['code'] ?? WorkOrder::nextCode();
        $data['status'] = $data['status'] ?? WorkOrderStatus::Open->value;
        $hadBoardStageKey = array_key_exists('board_stage', $data);
        $data['board_stage'] = $data['board_stage'] ?? WorkOrderBoardStage::Nueva->value;
        if (
            ! $hadBoardStageKey
            && array_key_exists('scheduling_status', $data)
            && $data['scheduling_status'] === WorkOrderSchedulingStatus::InProgramming->value
        ) {
            $data['board_stage'] = WorkOrderBoardStage::Pendiente->value;
        }
        $data['scheduling_status'] = $this->schedulingStatusForBoardStage(WorkOrderBoardStage::from($data['board_stage']));
        $data['created_by'] = $request->user()->getKey();
        $data['document_number'] = $data['document_number'] ?? WorkOrder::nextDocumentNumber();
        $data['document_date'] = $data['document_date'] ?? now()->toDateString();

        if ($linesInput !== []) {
            $bom = array_map(static fn (array $l) => [
                'material_id' => (int) $l['material_id'],
                'quantity_requested' => $l['quantity'],
            ], $linesInput);
            $this->materialRequests->validateConsumptionLinesForWorkOrder($bom);
        }

        $order = DB::transaction(function () use ($request, $data, $linesInput, $productionItemsInput, $autoCreate, $originatingArea, $mrNotes) {
            $order = WorkOrder::query()->create($data);

            foreach ($linesInput as $line) {
                WorkOrderLine::query()->create([
                    'work_order_id' => $order->getKey(),
                    'material_id' => (int) $line['material_id'],
                    'quantity' => $line['quantity'],
                    'notes' => $line['notes'] ?? null,
                ]);
            }

            $this->syncProductionItems($order, $productionItemsInput);

            if ($linesInput !== [] && $autoCreate) {
                $mrLines = array_map(static fn (array $l) => [
                    'material_id' => (int) $l['material_id'],
                    'quantity_requested' => $l['quantity'],
                ], $linesInput);

                $this->materialRequests->storePendingRequest(
                    $order->fresh(),
                    $request->user(),
                    $mrLines,
                    $originatingArea,
                    $mrNotes,
                );
            }

            return $order->fresh()->load([
                'client',
                'product',
                'clientOrder.lines.product',
                'clientOrder.lines.material',
                'lines.material',
                'productionItems',
                'materialRequests.lines.material',
            ]);
        });

        $this->productionNotifications->notifyOnWorkOrderCreated($order, $request->user());

        if ($linesInput !== []) {
            $linesForAlerts = array_map(static fn (array $l) => [
                'material_id' => (int) $l['material_id'],
                'quantity' => $l['quantity'],
            ], $linesInput);
            $this->alerts->recordOtMaterialShortages($order, $request->user(), $linesForAlerts);
        }

        return response()->json($order, 201);
    }

    public function show(WorkOrder $work_order): JsonResponse
    {
        $work_order->load([
            'client',
            'product',
            'clientOrder.lines.product',
            'clientOrder.lines.material',
            'lines.material',
            'productionItems',
            'materialRequests.lines.material',
            'technicalDocument',
        ]);

        return response()->json($work_order);
    }

    /**
     * PDF "Orden de Producción" (formato impreso Axones).
     */
    public function ordenProduccionPdf(WorkOrder $work_order): Response
    {
        $work_order->load(['client', 'product', 'productionItems']);

        $fileBase = $work_order->document_number ?: str_replace(['/', '\\'], '-', $work_order->code);
        $pdf = Pdf::loadView('pdf.orden_produccion', ['order' => $work_order])
            ->setPaper('a4', 'portrait');

        return $pdf->download('orden-produccion-'.$fileBase.'.pdf');
    }

    /**
     * HTML para vista previa del reporte tipo planilla (merge maestro + formulario técnico).
     */
    public function previewPlanillaReport(Request $request, WorkOrder $work_order): Response
    {
        $this->assertPlanillaReportAllowed($work_order);

        $data = $this->planillaReport->buildViewDataForBlade($work_order);
        $data['generatedBy'] = (string) ($request->user()?->name ?? 'Usuario');
        $data['generatedAt'] = now();

        $html = View::make('pdf.orden_trabajo_planilla', $data)->render();

        return new Response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="vista-previa-ot-'.$work_order->id.'.html"',
        ]);
    }

    /**
     * PDF planilla larga (orden de trabajo / producción).
     */
    public function downloadPlanillaReportPdf(Request $request, WorkOrder $work_order): Response
    {
        $this->assertPlanillaReportAllowed($work_order);

        $data = $this->planillaReport->buildViewDataForBlade($work_order);
        $data['generatedBy'] = (string) ($request->user()?->name ?? 'Usuario');
        $data['generatedAt'] = now();

        $fileBase = $work_order->document_number ?: str_replace(['/', '\\'], '-', $work_order->code);
        $pdf = Pdf::loadView('pdf.orden_trabajo_planilla', $data)
            ->setPaper('a4', 'portrait');

        return $pdf->download('orden-trabajo-planilla-'.$fileBase.'.pdf');
    }

    private function assertPlanillaReportAllowed(WorkOrder $work_order): void
    {
        $st = WorkOrderStatus::tryFrom((string) $work_order->status);
        if ($st === WorkOrderStatus::Completed || $st === WorkOrderStatus::Cancelled) {
            abort(403, 'La vista previa y el PDF de planilla no están disponibles para órdenes completadas o canceladas.');
        }
    }

    public function update(WorkOrderUpdateRequest $request, WorkOrder $work_order): JsonResponse
    {
        $validated = $request->validated();
        $this->validateClientOrderAgainstWorkOrderState($work_order, $validated);

        if (array_key_exists('board_stage', $validated)) {
            $validated['scheduling_status'] = $this->schedulingStatusForBoardStage(
                WorkOrderBoardStage::from($validated['board_stage'])
            );
        } elseif (
            array_key_exists('scheduling_status', $validated)
            && $validated['scheduling_status'] === WorkOrderSchedulingStatus::InProgramming->value
            && $work_order->board_stage === WorkOrderBoardStage::Nueva
        ) {
            $validated['board_stage'] = WorkOrderBoardStage::Pendiente->value;
        }

        $productionItemsInput = null;
        if (array_key_exists('production_items', $validated)) {
            $productionItemsInput = $validated['production_items'];
            unset($validated['production_items']);
        }

        $linesInput = null;
        if (array_key_exists('lines', $validated)) {
            $linesInput = $validated['lines'];
            unset($validated['lines']);
        }

        $autoCreateMr = $request->boolean('auto_create_material_request', true);
        $mrOriginating = $request->input('originating_area');
        $mrNotes = $request->input('material_request_notes');
        unset($validated['auto_create_material_request'], $validated['originating_area'], $validated['material_request_notes']);

        DB::transaction(function () use ($work_order, $validated, $productionItemsInput, $linesInput, $request, $autoCreateMr, $mrOriginating, $mrNotes) {
            $work_order->update($validated);
            $fresh = $work_order->fresh();
            if ($productionItemsInput !== null) {
                $this->syncProductionItems($fresh, $productionItemsInput);
                $fresh = $work_order->fresh();
            }
            if ($linesInput !== null) {
                $this->replaceWorkOrderLinesAndMaterialRequests(
                    $fresh,
                    $linesInput,
                    $request->user(),
                    $autoCreateMr,
                    $mrOriginating ? (string) $mrOriginating : null,
                    $mrNotes ? (string) $mrNotes : null,
                );
            }
        });

        $freshOrder = $work_order->fresh()->load([
            'client',
            'product',
            'clientOrder.lines.product',
            'clientOrder.lines.material',
            'lines.material',
            'productionItems',
            'materialRequests.lines.material',
        ]);

        if ($linesInput !== null && $linesInput !== []) {
            $linesForAlerts = array_map(static fn (array $l) => [
                'material_id' => (int) $l['material_id'],
                'quantity' => $l['quantity'],
            ], $linesInput);
            $this->alerts->recordOtMaterialShortages($freshOrder, $request->user(), $linesForAlerts);
        }

        return response()->json($freshOrder);
    }

    /**
     * @param  list<array{quantity: mixed, quantity_unit?: string|null, product_description: string, technical_specs?: string|null, position?: int|null}>  $items
     */
    private function syncProductionItems(WorkOrder $order, array $items): void
    {
        $order->productionItems()->delete();
        foreach (array_values($items) as $idx => $row) {
            WorkOrderProductionItem::query()->create([
                'work_order_id' => $order->getKey(),
                'position' => (int) ($row['position'] ?? $idx),
                'quantity' => $row['quantity'],
                'quantity_unit' => $row['quantity_unit'] ?? 'Kg',
                'product_description' => $row['product_description'],
                'technical_specs' => $row['technical_specs'] ?? null,
            ]);
        }
    }

    /**
     * @param  list<array{material_id: int, quantity: string|float, notes?: string|null}>  $linesInput
     */
    private function replaceWorkOrderLinesAndMaterialRequests(
        WorkOrder $wo,
        array $linesInput,
        User $user,
        bool $autoCreate,
        ?string $originatingArea,
        ?string $mrNotes,
    ): void {
        $this->assertWorkOrderLinesReplaceable($wo);

        if ($linesInput !== []) {
            $bom = array_map(static fn (array $l) => [
                'material_id' => (int) $l['material_id'],
                'quantity_requested' => $l['quantity'],
            ], $linesInput);
            $this->materialRequests->validateConsumptionLinesForWorkOrder($bom);
        }

        $wo->lines()->delete();

        foreach ($wo->materialRequests()->where('status', '!=', MaterialRequestStatus::Cancelled->value)->get() as $mr) {
            $mr->lines()->delete();
            $mr->delete();
        }

        foreach ($linesInput as $line) {
            WorkOrderLine::query()->create([
                'work_order_id' => $wo->getKey(),
                'material_id' => (int) $line['material_id'],
                'quantity' => $line['quantity'],
                'notes' => $line['notes'] ?? null,
            ]);
        }

        if ($linesInput !== [] && $autoCreate) {
            $mrLines = array_map(static fn (array $l) => [
                'material_id' => (int) $l['material_id'],
                'quantity_requested' => $l['quantity'],
            ], $linesInput);
            $this->materialRequests->storePendingRequest(
                $wo->fresh(),
                $user,
                $mrLines,
                $originatingArea,
                $mrNotes,
            );
        }
    }

    private function assertWorkOrderLinesReplaceable(WorkOrder $wo): void
    {
        $wo->loadMissing('materialRequests.lines');
        foreach ($wo->materialRequests as $mr) {
            if ($mr->status === MaterialRequestStatus::Cancelled->value) {
                continue;
            }
            if (in_array($mr->status, [MaterialRequestStatus::Partial->value, MaterialRequestStatus::Dispatched->value], true)) {
                throw ValidationException::withMessages([
                    'lines' => ['No se pueden reemplazar materiales: hay solicitudes ya despachadas o parcialmente despachadas.'],
                ]);
            }
            foreach ($mr->lines as $line) {
                if (bccomp((string) $line->quantity_dispatched, '0', 3) === 1) {
                    throw ValidationException::withMessages([
                        'lines' => ['No se pueden reemplazar materiales: ya existen despachos registrados en la solicitud.'],
                    ]);
                }
            }
        }
    }

    /**
     * @return list<string>
     */
    private function parseIncludeAreaSummaries(Request $request): array
    {
        $raw = trim((string) $request->query('include_area_summaries', ''));
        if ($raw === '') {
            return [];
        }
        $allowed = ['corte', 'tintas'];
        $out = [];
        foreach (explode(',', $raw) as $part) {
            $a = strtolower(trim($part));
            if ($a !== '' && in_array($a, $allowed, true) && ! in_array($a, $out, true)) {
                $out[] = $a;
            }
        }

        return $out;
    }

    private function schedulingStatusForBoardStage(WorkOrderBoardStage $stage): string
    {
        return match ($stage) {
            WorkOrderBoardStage::Nueva => WorkOrderSchedulingStatus::PendingProgramming->value,
            default => WorkOrderSchedulingStatus::InProgramming->value,
        };
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function applyClientOrderToWorkOrderPayload(array &$data): void
    {
        if (empty($data['client_order_id'])) {
            return;
        }

        $co = ClientOrder::query()->with('lines')->findOrFail((int) $data['client_order_id']);
        if ($co->status === ClientOrderStatus::Cancelled->value) {
            throw ValidationException::withMessages([
                'client_order_id' => ['La orden de cliente está cancelada.'],
            ]);
        }

        if (isset($data['client_id']) && (int) $data['client_id'] !== (int) $co->client_id) {
            throw ValidationException::withMessages([
                'client_id' => ['El cliente debe coincidir con la orden de cliente seleccionada.'],
            ]);
        }

        $data['client_id'] = $data['client_id'] ?? $co->client_id;

        if (empty($data['product_id'])) {
            $line = $co->lines->first(
                static fn (ClientOrderLine $l) => $l->product_id !== null,
            );
            if ($line !== null) {
                $data['product_id'] = (int) $line->product_id;
            }
        }
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function validateClientOrderAgainstWorkOrderState(WorkOrder $workOrder, array &$validated): void
    {
        $hasCoKey = array_key_exists('client_order_id', $validated);
        $targetCoId = $hasCoKey ? $validated['client_order_id'] : $workOrder->client_order_id;

        if ($targetCoId === null) {
            return;
        }

        $co = ClientOrder::query()->findOrFail((int) $targetCoId);
        if ($co->status === ClientOrderStatus::Cancelled->value) {
            throw ValidationException::withMessages([
                'client_order_id' => ['La orden de cliente está cancelada.'],
            ]);
        }

        $targetClientId = array_key_exists('client_id', $validated)
            ? $validated['client_id']
            : $workOrder->client_id;

        if ($targetClientId !== null && (int) $targetClientId !== (int) $co->client_id) {
            throw ValidationException::withMessages([
                'client_id' => ['El cliente debe coincidir con la orden de cliente seleccionada.'],
            ]);
        }

        if ($targetClientId === null) {
            $validated['client_id'] = $co->client_id;
        }
    }

    /**
     * Líneas de OT desde pedido: solo líneas del pedido que traen material_id (PDF: programación / consumo previsto).
     *
     * @return list<array{material_id: int, quantity: string, notes: string|null}>
     */
    private function buildWorkOrderLinesFromClientOrder(int $clientOrderId): array
    {
        $co = ClientOrder::query()->with('lines')->findOrFail($clientOrderId);
        $out = [];
        foreach ($co->lines as $line) {
            if ($line->material_id === null) {
                continue;
            }
            $note = $line->notes;
            if ($line->description) {
                $note = $note ? trim((string) $note.' | '.$line->description) : $line->description;
            }

            $out[] = [
                'material_id' => (int) $line->material_id,
                'quantity' => (string) $line->quantity,
                'notes' => $note,
            ];
        }

        if ($out === []) {
            throw ValidationException::withMessages([
                'import_client_order_lines' => ['El pedido no tiene líneas con material_id para importar.'],
            ]);
        }

        return $out;
    }
}
