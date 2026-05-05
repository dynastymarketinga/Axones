<?php

namespace App\Http\Controllers\Api;

use App\Enums\InventoryMovementType;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreInventoryReturnRequest;
use App\Models\InventoryReturn;
use App\Models\Material;
use App\Services\InventoryLedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryReturnController extends Controller
{
    public function __construct(
        private readonly InventoryLedgerService $ledger,
    ) {}

    public function show(InventoryReturn $inventoryReturn): JsonResponse
    {
        $inventoryReturn->load(['material.supplier:id,name', 'workOrder']);

        return response()->json($inventoryReturn);
    }

    public function index(Request $request): JsonResponse
    {
        $query = InventoryReturn::query()->with(['material.supplier:id,name', 'workOrder'])->orderByDesc('created_at');

        if ($request->query('work_order_id')) {
            $query->where('work_order_id', $request->query('work_order_id'));
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function store(StoreInventoryReturnRequest $request): JsonResponse
    {
        $data = $request->validated();
        /** @var Material $material */
        $material = Material::query()->findOrFail($data['material_id']);

        if ($material->inventory_area !== $data['destination_area']) {
            throw ValidationException::withMessages([
                'destination_area' => ['El área de destino debe coincidir con el área del material seleccionado.'],
            ]);
        }

        $return = InventoryReturn::query()->create([
            'material_id' => $material->getKey(),
            'work_order_id' => $data['work_order_id'] ?? null,
            'destination_area' => $data['destination_area'],
            'quantity' => $data['quantity'],
            'status' => 'pending',
            'reason' => $data['reason'] ?? null,
        ]);

        $return->load(['material.supplier:id,name', 'workOrder']);

        return response()->json($return, 201);
    }

    public function accept(Request $request, InventoryReturn $inventoryReturn): JsonResponse
    {
        if ($inventoryReturn->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => ['Esta devolución ya fue procesada.'],
            ]);
        }

        $reasonText = trim((string) $request->input('reason', ''));
        if ($reasonText === '') {
            $reasonText = trim((string) ($inventoryReturn->reason ?? ''));
        }
        if ($reasonText === '') {
            throw ValidationException::withMessages([
                'reason' => ['Debe indicar una razón.'],
            ]);
        }

        $inventoryReturn = DB::transaction(function () use ($request, $inventoryReturn) {
            $inventoryReturn->load('material');
            $material = $inventoryReturn->material;
            if (! $material) {
                throw ValidationException::withMessages([
                    'material_id' => ['Material no encontrado para esta devolución.'],
                ]);
            }

            $this->ledger->apply(
                $material,
                InventoryMovementType::In,
                (string) $inventoryReturn->quantity,
                $request->user(),
                'inventory_return',
                $inventoryReturn->getKey(),
                [
                    'note' => 'Ingreso por devolución aceptada',
                    'reason_scope' => 'manual_adjustment',
                    'reason_code' => 'inventory_return_accept',
                    'reason_text' => trim((string) ($request->input('reason') ?: $inventoryReturn->reason)),
                ],
            );

            $inventoryReturn->update([
                'status' => 'accepted',
                'accepted_by' => $request->user()->getKey(),
                'accepted_at' => now(),
                'reason' => trim((string) ($request->input('reason') ?: $inventoryReturn->reason)),
            ]);

            return $inventoryReturn->fresh(['material.supplier:id,name', 'workOrder']);
        });

        return response()->json($inventoryReturn);
    }
}
