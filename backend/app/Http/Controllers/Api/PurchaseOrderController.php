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

        if ($request->filled('q')) {
            $raw = trim((string) $request->query('q'));
            $escaped = addcslashes($raw, '%_\\');
            $query->where('code', 'like', '%'.$escaped.'%');
        }

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
            'notes' => ['nullable', 'string'],
            'ordered_at' => ['nullable', 'date'],
            'status' => ['nullable', 'string', Rule::in(PurchaseOrderStatus::values())],
        ]);

        if (isset($payload['status']) && $payload['status'] === PurchaseOrderStatus::Partial->value) {
            return response()->json([
                'message' => 'El estado Parcial lo define el inventario al registrar recepciones; no se puede fijar manualmente.',
            ], 422);
        }

        $purchase_order->update($payload);

        return response()->json($purchase_order->fresh()->load('lines.material', 'supplier'));
    }
}
