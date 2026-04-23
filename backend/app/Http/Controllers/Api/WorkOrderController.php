<?php

namespace App\Http\Controllers\Api;

use App\Enums\ClientOrderStatus;
use App\Enums\MaterialRequestStatus;
use App\Enums\WorkOrderBoardStage;
use App\Enums\WorkOrderSchedulingStatus;
use App\Enums\WorkOrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\WorkOrderStoreRequest;
use App\Http\Requests\WorkOrderUpdateRequest;
use App\Models\ClientOrder;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\ClientOrderLine;
use App\Models\WorkOrderLine;
use App\Models\WorkOrderProductionItem;
use App\Services\MaterialRequestService;
use App\Services\OperationalAlertService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WorkOrderController extends Controller
{
    public function __construct(
        private readonly MaterialRequestService $materialRequests,
        private readonly OperationalAlertService $alerts,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = WorkOrder::query()
            ->with(['client', 'product', 'clientOrder', 'technicalDocument'])
            ->withCount(['materialRequests', 'lines', 'productionItems'])
            ->orderByDesc('created_at');

        if ($request->query('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->query('client_id')) {
            $query->where('client_id', $request->query('client_id'));
        }

        if ($request->query('scheduling_status')) {
            $query->where('scheduling_status', $request->query('scheduling_status'));
        }

        if ($request->query('board_stage')) {
            $query->where('board_stage', $request->query('board_stage'));
        }

        if ($q = $request->query('client_order_reference')) {
            $query->where('client_order_reference', 'like', '%' . $q . '%');
        }

        if ($request->query('client_order_id')) {
            $query->where('client_order_id', $request->query('client_order_id'));
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
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

        $grouped = $orders->groupBy(fn(WorkOrder $o) => $o->board_stage->value);
        $columns = [];
        foreach (WorkOrderBoardStage::cases() as $case) {
            $columns[$case->value] = $grouped->get($case->value, collect())->values();
        }

        return response()->json(['columns' => $columns]);
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
            $bom = array_map(static fn(array $l) => [
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
                $mrLines = array_map(static fn(array $l) => [
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
                'client.vendor',
                'product',
                'clientOrder.lines.product',
                'clientOrder.lines.material',
                'lines.material',
                'productionItems',
                'materialRequests.lines.material',
            ]);
        });

        if ($linesInput !== []) {
            $linesForAlerts = array_map(static fn(array $l) => [
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
            'client.vendor',
            'product',
            'clientOrder.lines.product',
            'clientOrder.lines.material',
            'lines.material',
            'productionItems',
            'materialRequests.lines.material',
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

        return $pdf->download('orden-produccion-' . $fileBase . '.pdf');
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
            'client.vendor',
            'product',
            'clientOrder.lines.product',
            'clientOrder.lines.material',
            'lines.material',
            'productionItems',
            'materialRequests.lines.material',
        ]);

        if ($linesInput !== null && $linesInput !== []) {
            $linesForAlerts = array_map(static fn(array $l) => [
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
            $bom = array_map(static fn(array $l) => [
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
            $mrLines = array_map(static fn(array $l) => [
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
                $note = $note ? trim((string) $note . ' | ' . $line->description) : $line->description;
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
