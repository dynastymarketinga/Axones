<?php

namespace App\Http\Controllers\Api;

use App\Enums\AlertSeverity;
use App\Enums\InventoryMovementType;
use App\Enums\OperationalAlertType;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreInventoryReturnRequest;
use App\Models\Bobina;
use App\Models\InventoryReturn;
use App\Models\Material;
use App\Models\OperationalAlert;
use App\Services\InventoryLedgerService;
use Illuminate\Auth\Access\AuthorizationException;
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

        if ($destinationArea = $request->query('destination_area')) {
            $query->where('destination_area', $destinationArea);
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function store(StoreInventoryReturnRequest $request): JsonResponse
    {
        $data = $request->validated();
        $material = isset($data['material_id'])
            ? Material::query()->find($data['material_id'])
            : null;

        if ($material !== null && $material->inventory_area !== $data['destination_area']) {
            throw ValidationException::withMessages([
                'destination_area' => ['El área de destino debe coincidir con el área del material seleccionado.'],
            ]);
        }

        if (
            ($data['destination_area'] ?? null) !== 'bobinas_rechazadas' &&
            $material === null
        ) {
            throw ValidationException::withMessages([
                'material_id' => ['Seleccione un material para esta devolución.'],
            ]);
        }

        $return = DB::transaction(function () use ($data, $material) {
            /** @var InventoryReturn $return */
            $return = InventoryReturn::query()->create([
                'material_id' => $material?->getKey(),
                'work_order_id' => $data['work_order_id'] ?? null,
                'destination_area' => $data['destination_area'],
                'quantity' => $data['quantity'],
                'status' => 'pending',
                'reason' => $data['reason'] ?? null,
            ]);

            // Si la devolución es hacia bobinas rechazadas, crear automáticamente la bobina rechazada
            // para que aparezca en /axones/bobinas sin un paso manual adicional.
            if (
                $material !== null &&
                ($data['destination_area'] ?? null) === 'bobinas_rechazadas' &&
                ($data['work_order_id'] ?? null) &&
                ! Bobina::query()->where('inventory_return_id', $return->getKey())->exists()
            ) {
                $suffix = strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
                Bobina::query()->create([
                    'material_id' => $material->getKey(),
                    'inventory_return_id' => $return->getKey(),
                    'code' => "REJ-{$return->getKey()}-{$suffix}",
                    'weight_kg' => $data['quantity'],
                    'status' => 'rejected',
                ]);
            }

            return $return;
        });

        $return->load(['material.supplier:id,name', 'workOrder']);

        $this->notifyInventoryReturnPending($return, $request->user());

        return response()->json($return, 201);
    }

    /**
     * Campana operativa: almacén / inventario (metadata target_area inventario excluye vista solo-impresión).
     */
    private function notifyInventoryReturnPending(InventoryReturn $return, ?\Illuminate\Contracts\Auth\Authenticatable $user): void
    {
        $material = $return->material;
        $wo = $return->workOrder;
        $isRejected = ($return->destination_area ?? '') === 'bobinas_rechazadas';
        $tipo = $isRejected ? 'Rechazada (bobinas rechazadas)' : 'Buena (reingreso a material)';
        $sku = $material ? (string) $material->sku : '—';
        $name = $material ? (string) $material->name : '—';
        $ot = $wo ? (string) $wo->code : '—';

        OperationalAlert::query()->create([
            'alert_type' => OperationalAlertType::InventoryReturnPending->value,
            'severity' => $isRejected ? AlertSeverity::Warning->value : AlertSeverity::Info->value,
            'message' => sprintf(
                'Devolución pendiente · %s · %s %s · OT %s · %s Kg (id #%d).',
                $tipo,
                $sku,
                $name,
                $ot,
                (string) $return->quantity,
                $return->getKey(),
            ),
            'work_order_id' => $return->work_order_id,
            'material_id' => $return->material_id,
            'metadata' => [
                'target_area' => 'inventario',
                'channel' => 'bell',
                'inventory_return_id' => $return->getKey(),
                'destination_area' => $return->destination_area,
                'return_kind' => $isRejected ? 'rechazada' : 'buena',
            ],
            'created_by' => $user ? (int) $user->getAuthIdentifier() : null,
        ]);
    }

    public function accept(Request $request, InventoryReturn $inventoryReturn): JsonResponse
    {
        if ($inventoryReturn->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => ['Esta devolución ya fue procesada.'],
            ]);
        }

        $user = $request->user();
        if ($user === null || ! $user->canAcceptInventoryReturns()) {
            throw new AuthorizationException('No autorizado para aceptar devoluciones a inventario.');
        }
        $userId = (int) $user->getAuthIdentifier();

        $reasonText = trim((string) $request->input('reason', ''));
        if ($reasonText === '') {
            $reasonText = trim((string) ($inventoryReturn->reason ?? ''));
        }
        if ($reasonText === '') {
            throw ValidationException::withMessages([
                'reason' => ['Debe indicar una razón.'],
            ]);
        }

        $inventoryReturn = DB::transaction(function () use ($request, $inventoryReturn, $user, $userId) {
            $inventoryReturn->load('material');
            $material = $inventoryReturn->material;
            $isRejectedWithoutMaterial =
                ($inventoryReturn->destination_area === 'bobinas_rechazadas') && ! $material;

            if (! $material && ! $isRejectedWithoutMaterial) {
                throw ValidationException::withMessages([
                    'material_id' => ['Material no encontrado para esta devolución.'],
                ]);
            }

            if (! $isRejectedWithoutMaterial) {
                $this->ledger->apply(
                    $material,
                    InventoryMovementType::In,
                    (string) $inventoryReturn->quantity,
                    $user,
                    'inventory_return',
                    $inventoryReturn->getKey(),
                    [
                        'note' => 'Ingreso por devolución aceptada',
                        'reason_scope' => 'manual_adjustment',
                        'reason_code' => 'inventory_return_accept',
                        'reason_text' => trim((string) ($request->input('reason') ?: $inventoryReturn->reason)),
                    ],
                );
            }

            $inventoryReturn->update([
                'status' => 'accepted',
                'accepted_by' => $userId,
                'accepted_at' => now(),
                'reason' => trim((string) ($request->input('reason') ?: $inventoryReturn->reason)),
            ]);

            return $inventoryReturn->fresh(['material.supplier:id,name', 'workOrder']);
        });

        return response()->json($inventoryReturn);
    }
}
