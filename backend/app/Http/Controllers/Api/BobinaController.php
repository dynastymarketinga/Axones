<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBobinaRequest;
use App\Http\Requests\UpdateBobinaRequest;
use App\Models\Bobina;
use App\Models\InventoryChangeApproval;
use App\Services\BobinaRegistrationService;
use App\Services\BobinaUpdateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BobinaController extends Controller
{
    public function __construct(
        private readonly BobinaRegistrationService $bobinas,
        private readonly BobinaUpdateService $bobinaUpdates,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Bobina::query()->with(['material.supplier:id,name', 'inventoryReturn.workOrder'])->orderByDesc('created_at');

        if ($request->query('material_id')) {
            $query->where('material_id', $request->query('material_id'));
        }

        if ($request->query('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 50), 200)));
    }

    public function show(Bobina $bobina): JsonResponse
    {
        $bobina->load(['material.supplier:id,name', 'inventoryReturn.workOrder']);

        return response()->json(array_merge($bobina->toArray(), [
            'can_edit_structural' => $this->bobinaUpdates->canEditStructural($bobina),
        ]));
    }

    public function store(StoreBobinaRequest $request): JsonResponse
    {
        $bobina = $this->bobinas->register($request->validated(), $request->user());

        return response()->json($bobina, 201);
    }

    public function update(UpdateBobinaRequest $request, Bobina $bobina): JsonResponse
    {
        $data = $request->validated();
        $requestApproval = (bool) ($data['request_approval'] ?? false);
        $isMajorChange = $this->isMajorBobinaChange($bobina, $data);
        if ($requestApproval && $isMajorChange && ! $this->isApproverRole((string) ($request->user()?->role ?? ''))) {
            $approval = InventoryChangeApproval::query()->create([
                'entity_type' => 'bobina',
                'entity_id' => $bobina->getKey(),
                'change_payload' => $data,
                'reason_text' => trim((string) ($data['change_reason'] ?? '')),
                'requested_by' => (int) $request->user()->getKey(),
                'status' => 'pending',
            ]);

            return response()->json([
                'status' => 'pending_approval',
                'message' => 'Cambio mayor enviado para aprobación de jefatura.',
                'approval_id' => $approval->id,
            ], 202);
        }

        $updated = $this->bobinaUpdates->update($bobina, $data, $request->user());

        return response()->json($updated);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function isMajorBobinaChange(Bobina $bobina, array $payload): bool
    {
        if (array_key_exists('material_id', $payload) && (int) $payload['material_id'] !== (int) $bobina->material_id) {
            return true;
        }
        if (array_key_exists('weight_kg', $payload)) {
            $old = (float) $bobina->weight_kg;
            $new = (float) $payload['weight_kg'];
            if (abs($new - $old) >= 20.0) {
                return true;
            }
        }

        return false;
    }

    private function isApproverRole(string $role): bool
    {
        $normalized = mb_strtolower(trim($role));

        return in_array($normalized, ['boss', 'admin', 'jefe_supremo', 'superadmin', 'jefe_operaciones', 'inventory_chief', 'jefe_inventario', 'jefe_almacen', 'supervisor'], true);
    }
}
