<?php

namespace App\Http\Controllers\Api;

use App\Enums\InventoryMovementType;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMaterialRequest;
use App\Http\Requests\UpdateMaterialRequest;
use App\Models\Material;
use App\Services\InventoryLedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MaterialController extends Controller
{
    public function __construct(
        private readonly InventoryLedgerService $ledger,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Material::query()->orderBy('sku');

        if ($area = $request->query('inventory_area')) {
            $query->where('inventory_area', $area);
        }

        if ($search = $request->query('q')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%'.$search.'%')
                    ->orWhere('sku', 'like', '%'.$search.'%')
                    ->orWhere('barcode', 'like', '%'.$search.'%');
            });
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function store(StoreMaterialRequest $request): JsonResponse
    {
        $material = DB::transaction(function () use ($request) {
            $data = $request->validated();
            $initial = $data['quantity_on_hand'] ?? '0';
            unset($data['quantity_on_hand']);

            $material = Material::query()->create($data);

            if (bccomp((string) $initial, '0', 3) === 1) {
                $this->ledger->apply(
                    $material,
                    InventoryMovementType::In,
                    (string) $initial,
                    $request->user(),
                    'material_opening',
                    $material->getKey(),
                    ['note' => 'Stock inicial al crear material'],
                );
                $material->refresh();
            }

            return $material;
        });

        return response()->json($material, 201);
    }

    public function show(Material $material): JsonResponse
    {
        return response()->json($material);
    }

    public function update(UpdateMaterialRequest $request, Material $material): JsonResponse
    {
        $material->update($request->validated());

        return response()->json($material->fresh());
    }
}
