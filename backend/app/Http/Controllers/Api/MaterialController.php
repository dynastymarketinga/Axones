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
        $query = Material::query()->orderBy('name');

        $active = $request->query('is_active');
        if ($active !== null && $active !== '') {
            $query->where('is_active', filter_var($active, FILTER_VALIDATE_BOOLEAN));
        } elseif (!filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN)) {
            $query->where('is_active', true);
        }

        if ($area = $request->query('inventory_area')) {
            $query->where('inventory_area', $area);
        }

        $productId = (int) $request->query('product_id', 0);
        if ($productId > 0) {
            $ids = DB::table('product_ink_material')
                ->where('product_id', $productId)
                ->pluck('material_id');
            if ($ids->isNotEmpty()) {
                $query->whereIn('id', $ids);
            }
        }

        if ($search = $request->query('q')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%'.$search.'%')
                    ->orWhere('sku', 'like', '%'.$search.'%')
                    ->orWhere('barcode', 'like', '%'.$search.'%');
            });
        }

        $per = min((int) $request->query('per_page', 20), 500);

        return response()->json($query->paginate($per));
    }

    public function checkDuplicates(Request $request): JsonResponse
    {
        $sku = trim((string) $request->query('sku', ''));
        $name = trim((string) $request->query('name', ''));
        $area = trim((string) $request->query('inventory_area', ''));
        $exceptId = (int) $request->query('except_id', 0);

        if ($sku === '' && ($name === '' || $area === '')) {
            return response()->json([
                'has_duplicates' => false,
                'total_matches' => 0,
                'matches' => [],
            ]);
        }

        $matches = Material::query()
            ->when($exceptId > 0, fn ($q) => $q->where('id', '!=', $exceptId))
            ->where(function ($q) use ($sku, $name, $area): void {
                if ($sku !== '') {
                    $q->orWhereRaw('LOWER(sku) = ?', [mb_strtolower($sku)]);
                }
                if ($name !== '' && $area !== '') {
                    $q->orWhere(function ($sq) use ($name, $area): void {
                        $sq->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                            ->where('inventory_area', $area);
                    });
                }
            })
            ->orderByDesc('updated_at')
            ->limit(10)
            ->get(['id', 'sku', 'name', 'inventory_area', 'is_active', 'updated_at']);

        return response()->json([
            'has_duplicates' => $matches->isNotEmpty(),
            'total_matches' => $matches->count(),
            'matches' => $matches,
        ]);
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
