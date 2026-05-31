<?php

namespace App\Http\Controllers\Api;

use App\Enums\DeliveryNoteStatus;
use App\Enums\PurchaseOrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePurchaseOrderRequest;
use App\Models\CorteBobinaUsage;
use App\Models\DeliveryNote;
use App\Models\InventoryMovement;
use App\Models\LaminacionBobinaUsage;
use App\Models\PrintingBobinaUsage;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use App\Models\WorkOrder;
use App\Services\PurchaseOrderClosingService;
use App\Support\BossAccess;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PurchaseOrderController extends Controller
{
    public function __construct(
        private readonly PurchaseOrderClosingService $purchaseOrderClosing,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = PurchaseOrder::query()
            ->with('supplier')
            ->withCount('lines')
            ->orderByDesc('created_at');

        $visibility = strtolower(trim((string) $request->query('visibility', 'active')));
        if (! in_array($visibility, ['active', 'all', 'inactive'], true)) {
            $visibility = 'active';
        }

        if (BossAccess::allows($request->user())) {
            if ($visibility === 'all') {
                // sin filtro por is_active
            } elseif ($visibility === 'inactive') {
                $query->where('is_active', false);
            } else {
                $query->where('is_active', true);
            }
        } else {
            $query->where('is_active', true);
        }

        if ($request->query('supplier_id')) {
            $query->where('supplier_id', $request->query('supplier_id'));
        }

        if ($request->query('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('q')) {
            $raw = trim((string) $request->query('q'));
            $escaped = addcslashes($raw, '%_\\');
            $query->where('code', 'like', '%'.$escaped.'%');
        }

        $linkedReceiptsFilter = static function ($q): void {
            $q->where('without_purchase_order', false);
        };

        if ($request->has('has_receipts')) {
            $hasReceipts = filter_var($request->query('has_receipts'), FILTER_VALIDATE_BOOLEAN);
            if ($hasReceipts) {
                $query->whereHas('receipts', $linkedReceiptsFilter);
            } else {
                $query->whereDoesntHave('receipts', $linkedReceiptsFilter);
            }
        }

        $query
            ->withCount(['receipts as receipts_count' => $linkedReceiptsFilter])
            ->withMax(['receipts as last_receipt_at' => $linkedReceiptsFilter], 'received_at');

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function store(StorePurchaseOrderRequest $request): JsonResponse
    {
        $data = $request->validated();
        $lines = $data['lines'];
        unset($data['lines']);

        $data['status'] = PurchaseOrderStatus::Open->value;
        if (! array_key_exists('tax_applies', $data)) {
            $data['tax_applies'] = true;
        }

        $order = DB::transaction(function () use ($data, $lines) {
            $po = PurchaseOrder::query()->create($data);

            foreach ($lines as $line) {
                PurchaseOrderLine::query()->create([
                    'purchase_order_id' => $po->getKey(),
                    'description' => $line['description'] ?? null,
                    'material_id' => $line['material_id'] ?? null,
                    'quantity_ordered' => $line['quantity_ordered'],
                    'quantity_received' => 0,
                    'unit' => $line['unit'] ?? 'kg',
                    'unit_price' => $line['unit_price'] ?? 0,
                ]);
            }

            return $po->fresh()->load('lines.material', 'supplier');
        });

        return response()->json($order, 201);
    }

    public function show(PurchaseOrder $purchase_order): JsonResponse
    {
        $purchase_order->load(['lines.material', 'supplier', 'receipts.lines']);

        return response()->json($purchase_order);
    }

    public function update(Request $request, PurchaseOrder $purchase_order): JsonResponse
    {
        $payload = $request->validate([
            'notes' => ['sometimes', 'nullable', 'string'],
            'ordered_at' => ['sometimes', 'nullable', 'date'],
            'tax_applies' => ['sometimes', 'boolean'],
            'status' => ['nullable', 'string', Rule::in(PurchaseOrderStatus::values())],
            'is_active' => ['sometimes', 'boolean'],
            'deactivation_reason' => ['nullable', 'string', 'min:5', 'max:1000'],
            'change_reason' => ['nullable', 'string', 'min:5', 'max:500'],
        ]);

        if (array_key_exists('status', $payload) && $payload['status'] !== null) {
            return response()->json([
                'message' => 'El estado de la orden de compra se calcula automáticamente. Para cerrarla o reabrirla manualmente use /manual-close o /reopen.',
            ], 422);
        }

        $reactivating = $request->has('is_active')
            && $request->boolean('is_active')
            && ! $purchase_order->is_active;

        if ($reactivating) {
            $this->assertBoss($request);
            $cr = trim((string) ($payload['change_reason'] ?? ''));
            if ($cr === '' || mb_strlen($cr) < 5) {
                throw ValidationException::withMessages([
                    'change_reason' => ['Indique el motivo de la reactivación (mínimo 5 caracteres).'],
                ]);
            }
            $purchase_order->update([
                'is_active' => true,
                'deactivated_at' => null,
                'last_change_reason' => $cr,
            ]);

            return response()->json($purchase_order->fresh()->load('lines.material', 'supplier'));
        }

        if (! $purchase_order->is_active) {
            throw ValidationException::withMessages([
                'is_active' => ['La orden está desactivada. Reactívela desde el listado (jefatura) o contacte a jefatura.'],
            ]);
        }

        $data = [];

        if ($request->has('is_active') && ! $request->boolean('is_active')) {
            $reason = trim((string) ($payload['deactivation_reason'] ?? ''));
            if ($reason === '' || mb_strlen($reason) < 5) {
                throw ValidationException::withMessages([
                    'deactivation_reason' => ['El motivo de desactivación es obligatorio (mínimo 5 caracteres).'],
                ]);
            }
            $data['is_active'] = false;
            $data['deactivated_at'] = now();
            $data['deactivation_reason'] = $reason;
        } else {
            if ($request->exists('notes') || $request->exists('ordered_at') || $request->exists('tax_applies')) {
                $cr = trim((string) ($payload['change_reason'] ?? ''));
                if ($cr === '' || mb_strlen($cr) < 5) {
                    throw ValidationException::withMessages([
                        'change_reason' => ['Indique el motivo del cambio (mínimo 5 caracteres).'],
                    ]);
                }
                $data['last_change_reason'] = $cr;
            }

            if (array_key_exists('notes', $payload)) {
                $data['notes'] = $payload['notes'];
            }
            if (array_key_exists('ordered_at', $payload)) {
                $data['ordered_at'] = $payload['ordered_at'];
            }
            if (array_key_exists('tax_applies', $payload)) {
                $data['tax_applies'] = (bool) $payload['tax_applies'];
            }
        }

        if ($data !== []) {
            $purchase_order->update($data);
        }

        return response()->json($purchase_order->fresh()->load('lines.material', 'supplier'));
    }

    /**
     * Cierre manual por el jefe (cuando hay material que nunca se va a consumir,
     * proveedor desistió, etc.). Marca la OC como Completada y registra motivo.
     */
    public function manualClose(Request $request, PurchaseOrder $purchase_order): JsonResponse
    {
        $this->assertBoss($request);

        $payload = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ], [
            'reason.required' => 'Indique el motivo del cierre manual.',
            'reason.min' => 'El motivo debe tener al menos 5 caracteres.',
        ]);

        $purchase_order->update([
            'manually_closed_at' => now(),
            'manually_closed_by' => (int) $request->user()->getKey(),
            'manual_close_reason' => trim($payload['reason']),
        ]);

        $this->purchaseOrderClosing->recompute($purchase_order->refresh());

        return response()->json($purchase_order->fresh()->load([
            'lines.material',
            'supplier',
            'manuallyClosedBy:id,name',
        ]));
    }

    /**
     * Reabre una OC cerrada manualmente y vuelve a recalcular su estado real.
     */
    public function reopen(Request $request, PurchaseOrder $purchase_order): JsonResponse
    {
        $this->assertBoss($request);

        if ($purchase_order->manually_closed_at === null) {
            return response()->json([
                'message' => 'Esta orden no está cerrada manualmente.',
            ], 422);
        }

        $purchase_order->update([
            'manually_closed_at' => null,
            'manually_closed_by' => null,
            'manual_close_reason' => null,
        ]);

        $this->purchaseOrderClosing->recompute($purchase_order->refresh());

        return response()->json($purchase_order->fresh()->load([
            'lines.material',
            'supplier',
            'manuallyClosedBy:id,name',
        ]));
    }

    /**
     * Lista las órdenes de trabajo que consumieron material trazable a esta
     * OC, indicando cuáles ya tienen al menos una nota de entrega despachada.
     * Sirve a la vista de detalle de OC para que el jefe sepa qué falta para
     * que la OC se cierre automáticamente.
     */
    public function consumingWorkOrders(PurchaseOrder $purchase_order): JsonResponse
    {
        $bobinaIds = InventoryMovement::query()
            ->where('reference_type', 'bobina')
            ->where('metadata->purchase_order_id', $purchase_order->getKey())
            ->get(['reference_id'])
            ->map(fn ($mov) => (int) $mov->reference_id)
            ->filter(fn ($v) => $v > 0)
            ->unique()
            ->values()
            ->all();

        if (empty($bobinaIds)) {
            return response()->json([
                'work_orders' => [],
                'all_dispatched' => false,
                'no_consumers' => true,
            ]);
        }

        $workOrderIds = collect()
            ->merge(PrintingBobinaUsage::query()->whereIn('bobina_id', $bobinaIds)->pluck('work_order_id'))
            ->merge(LaminacionBobinaUsage::query()->whereIn('bobina_id', $bobinaIds)->pluck('work_order_id'))
            ->merge(CorteBobinaUsage::query()->whereIn('bobina_id', $bobinaIds)->pluck('work_order_id'))
            ->map(fn ($v) => (int) $v)
            ->filter(fn ($v) => $v > 0)
            ->unique()
            ->values()
            ->all();

        if (empty($workOrderIds)) {
            return response()->json([
                'work_orders' => [],
                'all_dispatched' => false,
                'no_consumers' => true,
            ]);
        }

        $workOrders = WorkOrder::query()
            ->whereIn('id', $workOrderIds)
            ->with(['client:id,name', 'product:id,name,cpe'])
            ->orderBy('id')
            ->get(['id', 'code', 'client_id', 'product_id']);

        $noteCounts = DeliveryNote::query()
            ->whereIn('work_order_id', $workOrderIds)
            ->whereIn('status', [DeliveryNoteStatus::Dispatched->value, DeliveryNoteStatus::Draft->value])
            ->selectRaw('work_order_id, status, COUNT(*) as cnt')
            ->groupBy('work_order_id', 'status')
            ->get();

        $dispatchedByWorkOrderId = [];
        $draftByWorkOrderId = [];
        foreach ($noteCounts as $row) {
            $woId = (int) $row->work_order_id;
            $status = (string) $row->status;
            $cnt = (int) $row->cnt;

            if ($status === DeliveryNoteStatus::Dispatched->value) {
                $dispatchedByWorkOrderId[$woId] = $cnt;
            } elseif ($status === DeliveryNoteStatus::Draft->value) {
                $draftByWorkOrderId[$woId] = $cnt;
            }
        }

        $items = $workOrders->map(function (WorkOrder $wo) use ($dispatchedByWorkOrderId, $draftByWorkOrderId) {
            $woId = (int) $wo->getKey();
            $dispatchedCount = (int) ($dispatchedByWorkOrderId[$woId] ?? 0);
            $draftCount = (int) ($draftByWorkOrderId[$woId] ?? 0);

            return [
                'id' => $woId,
                'code' => $wo->code,
                'client_name' => $wo->client?->name,
                'product_name' => $wo->product?->name,
                'product_cpe' => $wo->product?->cpe,
                'dispatched_notes_count' => $dispatchedCount,
                'draft_notes_count' => $draftCount,
                'has_dispatched_note' => $dispatchedCount > 0,
            ];
        })->values();

        $allDispatched = $items->every(fn ($i) => $i['has_dispatched_note']);

        return response()->json([
            'work_orders' => $items,
            'all_dispatched' => $allDispatched,
            'no_consumers' => false,
        ]);
    }

    /**
     * @throws AuthorizationException
     */
    private function assertBoss(Request $request): void
    {
        if (! BossAccess::allows($request->user())) {
            throw new AuthorizationException('Solo jefatura/admin puede ejecutar esta acción.');
        }
    }
}
