<?php

namespace App\Http\Controllers\Api;

use App\Enums\InventoryMovementType;
use App\Http\Controllers\Controller;
use App\Http\Requests\MaterialIndexRequest;
use App\Http\Requests\StoreMaterialRequest;
use App\Http\Requests\UpdateMaterialRequest;
use App\Models\Material;
use App\Models\TintaSubarea;
use App\Services\InventoryLedgerService;
use Carbon\Carbon;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MaterialController extends Controller
{
    public function __construct(
        private readonly InventoryLedgerService $ledger,
    ) {}

    public function index(MaterialIndexRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $stockMode = (string) ($validated['stock_mode'] ?? 'current');
        $asOfDate = isset($validated['as_of_date'])
            ? Carbon::parse((string) $validated['as_of_date'])->startOfDay()
            : null;

        $query = Material::query()->with(['tintaSubareas', 'substrateProducts:id,name']);
        $stockExpr = 'CAST(COALESCE(materials.quantity_on_hand, 0) AS DECIMAL(20,3))';

        if ($stockMode === 'as_of_date' && $asOfDate instanceof Carbon) {
            $end = $asOfDate->copy()->endOfDay();
            $afterDay = DB::table('inventory_movements as im')
                ->select('im.material_id')
                ->selectRaw("
                    SUM(
                        CASE im.movement_type
                            WHEN 'in' THEN im.quantity
                            WHEN 'adjustment_add' THEN im.quantity
                            WHEN 'out' THEN -im.quantity
                            WHEN 'adjustment_sub' THEN -im.quantity
                            ELSE 0
                        END
                    ) as net_after_day
                ")
                ->where('im.occurred_at', '>', $end)
                ->groupBy('im.material_id');

            $query->leftJoinSub($afterDay, 'after_day', fn ($join) => $join->on('after_day.material_id', '=', 'materials.id'));
            $query->select('materials.*');
            $stockExpr = 'CAST(COALESCE(materials.quantity_on_hand, 0) - COALESCE(after_day.net_after_day, 0) AS DECIMAL(20,3))';
            $query->selectRaw($stockExpr.' as quantity_on_hand');
        }

        if ($area = ($validated['inventory_area'] ?? null)) {
            $query->where('inventory_area', $area);
        }

        if ($tintaSubarea = trim((string) ($validated['tinta_subarea'] ?? ''))) {
            $query->whereHas('tintaSubareas', function ($q) use ($tintaSubarea): void {
                $q->where('subarea', $tintaSubarea);
            });
        }

        $productId = (int) ($validated['product_id'] ?? 0);
        if ($productId > 0) {
            $inkIds = DB::table('product_ink_material')
                ->where('product_id', $productId)
                ->pluck('material_id');
            $substrateIds = DB::table('material_product')
                ->where('product_id', $productId)
                ->pluck('material_id');
            $ids = $inkIds->merge($substrateIds)->unique()->values();
            if ($ids->isNotEmpty()) {
                $query->whereIn('id', $ids->all());
            }
        }

        if ($search = ($validated['q'] ?? null)) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%'.$search.'%')
                    ->orWhere('sku', 'like', '%'.$search.'%')
                    ->orWhere('barcode', 'like', '%'.$search.'%');
            });
        }

        if ($unit = trim((string) ($validated['unit'] ?? ''))) {
            $query->where('unit', $unit);
        }

        if ($stockState = (string) ($validated['stock_state'] ?? '')) {
            if ($stockState === 'sin_stock') {
                $query->whereRaw($stockExpr.' <= 0');
            } elseif ($stockState === 'bajo_minimo') {
                $query->whereRaw($stockExpr.' > 0');
                $query->whereRaw($stockExpr.' < COALESCE(materials.min_stock, 0)');
            } elseif ($stockState === 'ok') {
                $query->whereRaw($stockExpr.' >= COALESCE(materials.min_stock, 0)');
            }
        }

        if (array_key_exists('stock_min', $validated) && $validated['stock_min'] !== null && $validated['stock_min'] !== '') {
            $query->whereRaw($stockExpr.' >= ?', [(float) $validated['stock_min']]);
        }

        if (array_key_exists('stock_max', $validated) && $validated['stock_max'] !== null && $validated['stock_max'] !== '') {
            $query->whereRaw($stockExpr.' <= ?', [(float) $validated['stock_max']]);
        }

        $sortBy = (string) ($validated['sort_by'] ?? 'name');
        $sortDir = mb_strtolower((string) ($validated['sort_dir'] ?? 'asc')) === 'desc' ? 'desc' : 'asc';

        if ($sortBy === 'quantity_on_hand') {
            $query->orderByRaw($stockExpr.' '.$sortDir);
            $query->orderBy('materials.name');
        } else {
            $column = $sortBy === 'sku' ? 'materials.sku' : 'materials.name';
            $query->orderBy($column, $sortDir);
        }

        $per = min((int) ($validated['per_page'] ?? 20), 500);

        return response()->json($query->paginate($per));
    }

    public function checkDuplicates(Request $request): JsonResponse
    {
        $this->assertCanManageMaterials($request);

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
            ->get(['id', 'sku', 'name', 'inventory_area', 'updated_at']);

        return response()->json([
            'has_duplicates' => $matches->isNotEmpty(),
            'total_matches' => $matches->count(),
            'matches' => $matches,
        ]);
    }

    public function store(StoreMaterialRequest $request): JsonResponse
    {
        $this->assertCanManageMaterials($request);

        $material = DB::transaction(function () use ($request) {
            $data = $request->validated();
            $initial = $data['quantity_on_hand'] ?? '0';
            $tintaSubarea = $data['tinta_subarea'] ?? null;
            $productIds = collect($data['product_ids'] ?? [])->map(fn ($id) => (int) $id)->filter(fn ($id) => $id > 0)->unique()->values()->all();
            unset($data['quantity_on_hand']);
            unset($data['tinta_subarea']);
            unset($data['product_ids']);

            $material = Material::query()->create($data);

            if ($material->inventory_area === 'tintas' && is_string($tintaSubarea) && trim($tintaSubarea) !== '') {
                TintaSubarea::query()->updateOrCreate(
                    ['material_id' => $material->getKey()],
                    ['subarea' => trim($tintaSubarea)]
                );
            }

            if ($material->inventory_area === 'material') {
                $material->substrateProducts()->sync($productIds);
            }

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

            return $material->fresh(['tintaSubareas', 'substrateProducts']);
        });

        return response()->json($material, 201);
    }

    public function show(Material $material): JsonResponse
    {
        $material->load(['tintaSubareas', 'substrateProducts']);

        return response()->json($material);
    }

    public function update(UpdateMaterialRequest $request, Material $material): JsonResponse
    {
        $this->assertCanManageMaterials($request);

        $data = $request->validated();
        $tintaSubarea = $data['tinta_subarea'] ?? null;
        $productIds = collect($data['product_ids'] ?? [])->map(fn ($id) => (int) $id)->filter(fn ($id) => $id > 0)->unique()->values()->all();
        unset($data['tinta_subarea']);
        unset($data['product_ids']);

        $material->update($data);

        if ($material->inventory_area !== 'tintas') {
            $material->tintaSubareas()->delete();
        } elseif (is_string($tintaSubarea) && trim($tintaSubarea) !== '') {
            $material->tintaSubareas()->where('subarea', '!=', trim($tintaSubarea))->delete();
            TintaSubarea::query()->updateOrCreate(
                ['material_id' => $material->getKey()],
                ['subarea' => trim($tintaSubarea)]
            );
        }

        if ($material->inventory_area === 'material') {
            $material->substrateProducts()->sync($productIds);
        } else {
            $material->substrateProducts()->detach();
        }

        return response()->json($material->fresh(['tintaSubareas', 'substrateProducts']));
    }

    /**
     * @throws AuthorizationException
     */
    private function assertCanManageMaterials(Request $request): void
    {
        $role = mb_strtolower(trim((string) ($request->user()?->role ?? '')));
        $allowed = ['inventory', 'inventario', 'inventory_chief', 'jefe_inventario', 'boss', 'admin', 'jefe_supremo', 'superadmin'];
        if (! in_array($role, $allowed, true)) {
            throw new AuthorizationException('No autorizado para gestionar materiales.');
        }
    }
}
