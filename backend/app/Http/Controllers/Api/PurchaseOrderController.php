<?php

namespace App\Http\Controllers\Api;

use App\Enums\PurchaseOrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePurchaseOrderRequest;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PurchaseOrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = PurchaseOrder::query()->with('supplier')->withCount('lines')->orderByDesc('created_at');

        if ($request->query('supplier_id')) {
            $query->where('supplier_id', $request->query('supplier_id'));
        }

        if ($request->query('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function store(StorePurchaseOrderRequest $request): JsonResponse
    {
        $data = $request->validated();
        $lines = $data['lines'];
        unset($data['lines']);

        $data['status'] = $data['status'] ?? PurchaseOrderStatus::Open->value;

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
            'notes' => ['nullable', 'string'],
            'ordered_at' => ['nullable', 'date'],
            'status' => ['nullable', 'string', Rule::in(PurchaseOrderStatus::values())],
        ]);

        if (isset($payload['status']) && $payload['status'] === PurchaseOrderStatus::Cancelled->value) {
            if ($purchase_order->status === PurchaseOrderStatus::Completed->value) {
                return response()->json(['message' => 'No se puede cancelar una OC ya completada.'], 422);
            }
        }

        $purchase_order->update($payload);

        return response()->json($purchase_order->fresh()->load('lines.material', 'supplier'));
    }
}
