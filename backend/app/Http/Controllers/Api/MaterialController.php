<?php

namespace App\Http\Controllers\Api;

use App\Enums\InventoryMovementType;
use App\Http\Controllers\Controller;
use App\Http\Requests\MaterialIndexRequest;
use App\Http\Requests\StoreMaterialRequest;
use App\Http\Requests\UpdateMaterialRequest;
use App\Models\InventoryChangeApproval;
use App\Models\InventoryMovement;
use App\Models\Material;
use App\Models\TintaSubarea;
use Carbon\Carbon;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class MaterialController extends Controller
{
    public function index(MaterialIndexRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $stockMode = (string) ($validated['stock_mode'] ?? 'current');
        $asOfDate = isset($validated['as_of_date'])
            ? Carbon::parse((string) $validated['as_of_date'])->startOfDay()
            : null;

        $query = Material::query()->with(['tintaSubareas', 'substrateProducts:id,name', 'supplier:id,name']);
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
            $inventoryArea = (string) ($validated['inventory_area'] ?? '');
            $inkIds = DB::table('product_ink_material')
                ->where('product_id', $productId)
                ->pluck('material_id');
            if ($inventoryArea === 'tintas') {
                $ids = $inkIds->unique()->values();
            } else {
                $substrateIds = DB::table('material_product')
                    ->where('product_id', $productId)
                    ->pluck('material_id');
                $ids = $inkIds->merge($substrateIds)->unique()->values();
            }
            if ($ids->isNotEmpty()) {
                $matchingIds = Material::query()
                    ->when($inventoryArea !== '', fn ($q) => $q->where('inventory_area', $inventoryArea))
                    ->whereIn('id', $ids->all())
                    ->pluck('id');
                if ($matchingIds->isNotEmpty()) {
                    $query->whereIn('id', $matchingIds->all());
                }
                // Sin coincidencias en el área: no filtrar por producto (listar todo el inventario del área).
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
            $tintaSubarea = $data['tinta_subarea'] ?? null;
            $productIds = collect($data['product_ids'] ?? [])->map(fn ($id) => (int) $id)->filter(fn ($id) => $id > 0)->unique()->values()->all();
            unset($data['quantity_on_hand']);
            unset($data['tinta_subarea']);
            unset($data['product_ids']);

            $material = Material::query()->create($data);

            if (in_array($material->inventory_area, ['tintas', 'cementerio_tintas'], true) && is_string($tintaSubarea) && trim($tintaSubarea) !== '') {
                TintaSubarea::query()->updateOrCreate(
                    ['material_id' => $material->getKey()],
                    ['subarea' => trim($tintaSubarea)]
                );
            }

            if ($material->inventory_area === 'material') {
                $material->substrateProducts()->sync($productIds);
            }

            return $material->fresh(['tintaSubareas', 'substrateProducts', 'supplier']);
        });

        return response()->json($material, 201);
    }

    public function show(Material $material): JsonResponse
    {
        $material->load(['tintaSubareas', 'substrateProducts', 'supplier']);

        return response()->json($material);
    }

    public function update(UpdateMaterialRequest $request, Material $material): JsonResponse
    {
        $this->assertCanManageMaterials($request);

        $data = $request->validated();
        $reasonText = trim((string) ($data['change_reason'] ?? ''));
        $requestApproval = (bool) ($data['request_approval'] ?? false);
        $tintaSubarea = $data['tinta_subarea'] ?? null;
        $productIds = collect($data['product_ids'] ?? [])->map(fn ($id) => (int) $id)->filter(fn ($id) => $id > 0)->unique()->values()->all();
        if ($requestApproval && $this->isMajorMaterialChange($material, $data) && ! $this->isApproverRole((string) ($request->user()?->role ?? ''))) {
            $approval = InventoryChangeApproval::query()->create([
                'entity_type' => 'material',
                'entity_id' => $material->getKey(),
                'change_payload' => $data,
                'reason_text' => $reasonText,
                'requested_by' => (int) $request->user()->getKey(),
                'status' => 'pending',
            ]);

            return response()->json([
                'status' => 'pending_approval',
                'message' => 'Cambio mayor enviado para aprobación de jefatura.',
                'approval_id' => $approval->id,
            ], 202);
        }

        unset($data['change_reason']);
        unset($data['request_approval']);
        unset($data['tinta_subarea']);
        unset($data['product_ids']);

        $before = $this->snapshotForAudit($material);
        $material->update($data);

        if (! in_array($material->inventory_area, ['tintas', 'cementerio_tintas'], true)) {
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

        $material->refresh()->load(['tintaSubareas', 'substrateProducts']);
        $after = $this->snapshotForAudit($material);
        $changed = $this->changedFields($before, $after);
        if ($changed !== [] && $reasonText !== '') {
            $this->auditMaterialChange($material, $request, $reasonText, $changed, $before, $after);
        }

        return response()->json($material->fresh(['tintaSubareas', 'substrateProducts', 'supplier']));
    }

    /**
     * @throws AuthorizationException
     */
    private function assertCanManageMaterials(Request $request): void
    {
        $role = mb_strtolower(trim((string) ($request->user()?->role ?? '')));
        $allowed = ['inventory', 'inventario', 'inventory_chief', 'jefe_inventario', 'jefe_almacen', 'boss', 'admin', 'jefe_supremo', 'superadmin', 'jefe_operaciones'];
        if (! in_array($role, $allowed, true)) {
            throw new AuthorizationException('No autorizado para gestionar materiales.');
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshotForAudit(Material $material): array
    {
        return [
            'sku' => $material->sku,
            'internal_code' => $material->internal_code,
            'created_by_user_id' => $material->created_by_user_id,
            'name' => $material->name,
            'barcode' => $material->barcode,
            'inventory_area' => $material->inventory_area,
            'unit' => $material->unit,
            'micras' => $material->micras,
            'ancho' => $material->ancho,
            'min_stock' => (string) $material->min_stock,
            'supplier_id' => $material->supplier_id,
            'no_supplier_reason' => $material->no_supplier_reason,
            'notes' => $material->notes,
            'tinta_subarea' => optional($material->tintaSubareas->first())->subarea,
            'product_ids' => $material->substrateProducts->pluck('id')->map(fn ($id) => (int) $id)->sort()->values()->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @return array<int, string>
     */
    private function changedFields(array $before, array $after): array
    {
        $changed = [];
        foreach (array_keys($before) as $key) {
            $beforeValue = Arr::get($before, $key);
            $afterValue = Arr::get($after, $key);
            $beforeComparable = is_array($beforeValue) ? json_encode($beforeValue) : (string) $beforeValue;
            $afterComparable = is_array($afterValue) ? json_encode($afterValue) : (string) $afterValue;
            if ($beforeComparable !== $afterComparable) {
                $changed[] = $key;
            }
        }

        return $changed;
    }

    /**
     * @param  array<int, string>  $changedFields
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     */
    private function auditMaterialChange(
        Material $material,
        Request $request,
        string $reasonText,
        array $changedFields,
        array $before,
        array $after
    ): void {
        InventoryMovement::query()->create([
            'material_id' => $material->getKey(),
            'movement_type' => InventoryMovementType::AdjustmentAdd->value,
            'quantity' => '0',
            'reference_type' => 'inventory_adjustment',
            'reference_id' => $material->getKey(),
            'user_id' => $request->user()?->getKey(),
            'metadata' => [
                'reason_scope' => 'master_edit',
                'reason_text' => $reasonText,
                'reason_code' => 'material_master_update',
                'changed_fields' => $changedFields,
                'before' => $before,
                'after' => $after,
            ],
            'occurred_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function isMajorMaterialChange(Material $material, array $payload): bool
    {
        if (array_key_exists('inventory_area', $payload) && (string) $payload['inventory_area'] !== (string) $material->inventory_area) {
            return true;
        }
        if (array_key_exists('supplier_id', $payload) && (string) ($payload['supplier_id'] ?? '') !== (string) ($material->supplier_id ?? '')) {
            return true;
        }

        if (array_key_exists('no_supplier_reason', $payload)) {
            $beforeReason = trim((string) ($material->no_supplier_reason ?? ''));
            $afterReason = trim((string) ($payload['no_supplier_reason'] ?? ''));
            if ($beforeReason !== $afterReason) {
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
