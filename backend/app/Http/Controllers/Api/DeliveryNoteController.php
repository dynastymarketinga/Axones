<?php

namespace App\Http\Controllers\Api;

use App\Enums\DeliveryNoteStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\MarkDeliveryNoteDispatchedRequest;
use App\Http\Requests\StoreDeliveryNoteRequest;
use App\Http\Requests\UpdateDeliveryNoteRequest;
use App\Models\DeliveryNote;
use App\Models\DeliveryNoteLine;
use App\Services\CorteDispatchService;
use App\Services\PurchaseOrderClosingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DeliveryNoteController extends Controller
{
    public function __construct(
        private readonly CorteDispatchService $corteDispatch,
        private readonly PurchaseOrderClosingService $purchaseOrderClosing,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = DeliveryNote::query()
            ->with(['lines.corteBobinaUsage', 'workOrder.client', 'workOrder.product'])
            ->orderByDesc('created_at');

        if ($request->query('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->query('work_order_id')) {
            $query->where('work_order_id', $request->query('work_order_id'));
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function store(StoreDeliveryNoteRequest $request): JsonResponse
    {
        $data = $request->validated();
        $lines = $data['lines'];
        unset($data['lines']);
        $data['code'] = $data['code'] ?? DeliveryNote::nextCode();
        $data['sequential_number'] = $data['sequential_number'] ?? DeliveryNote::nextSequentialNumber();
        $data['status'] = DeliveryNoteStatus::Draft->value;
        $data['user_id'] = $request->user()->getKey();

        $note = DB::transaction(function () use ($data, $lines) {
            $this->corteDispatch->validateAndLockCorteLines($lines);

            /** @var DeliveryNote $note */
            $note = DeliveryNote::query()->create($data);
            foreach (array_values($lines) as $line) {
                if (! is_array($line)) {
                    continue;
                }
                DeliveryNoteLine::query()->create([
                    'delivery_note_id' => $note->getKey(),
                    'corte_bobina_usage_id' => $line['corte_bobina_usage_id'] ?? null,
                    'work_order_id' => $line['work_order_id'] ?? null,
                    'product_id' => $line['product_id'] ?? null,
                    'description' => $line['description'] ?? null,
                    'quantity_kg' => $line['quantity_kg'],
                    'pallet_code' => $line['pallet_code'] ?? null,
                    'bobbin_count' => (int) ($line['bobbin_count'] ?? 1),
                ]);
            }

            return $note->fresh()->load(['lines.workOrder', 'lines.product', 'lines.corteBobinaUsage', 'workOrder.client', 'workOrder.product']);
        });

        return response()->json($note, 201);
    }

    public function show(DeliveryNote $delivery_note): JsonResponse
    {
        $delivery_note->load([
            'lines.workOrder',
            'lines.product',
            'lines.corteBobinaUsage',
            'creator',
            'workOrder.client',
            'workOrder.product',
        ]);

        return response()->json($delivery_note);
    }

    public function update(UpdateDeliveryNoteRequest $request, DeliveryNote $delivery_note): JsonResponse
    {
        $delivery_note->update($request->validated());

        return response()->json($delivery_note->fresh()->load([
            'lines',
            'workOrder.client',
            'workOrder.product',
        ]));
    }

    /**
     * Marca nota como despachada (historial chofer) — PDF §5.
     */
    public function markDispatched(MarkDeliveryNoteDispatchedRequest $request, DeliveryNote $delivery_note): JsonResponse
    {
        if ($delivery_note->status === DeliveryNoteStatus::Cancelled->value) {
            return response()->json(['message' => 'La nota está cancelada.'], 422);
        }

        $driver = $request->input('driver_name', $delivery_note->driver_name);
        $vehicle = $request->input('vehicle_notes', $delivery_note->vehicle_notes);
        if (! is_string($driver) || trim($driver) === '' || ! is_string($vehicle) || trim($vehicle) === '') {
            throw ValidationException::withMessages([
                'driver_name' => ['Indique conductor y vehículo (o guárdelos en la nota antes de despachar).'],
            ]);
        }

        $delivery_note->update([
            'driver_name' => trim($driver),
            'vehicle_notes' => trim($vehicle),
            'status' => DeliveryNoteStatus::Dispatched->value,
            'dispatched_at' => now(),
        ]);

        if ($delivery_note->work_order_id) {
            $this->purchaseOrderClosing->syncFromWorkOrder((int) $delivery_note->work_order_id);
        }

        return response()->json($delivery_note->fresh()->load(['lines', 'workOrder.client', 'workOrder.product']));
    }
}
