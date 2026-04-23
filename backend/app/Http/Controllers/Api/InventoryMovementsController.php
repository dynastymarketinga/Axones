<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\InventoryMovementsIndexRequest;
use App\Models\InventoryMovement;
use Illuminate\Http\JsonResponse;

class InventoryMovementsController extends Controller
{
    /**
     * Listado global de movimientos con filtros (base de reportes entrada/salida por fecha).
     */
    public function index(InventoryMovementsIndexRequest $request): JsonResponse
    {
        $filters = $request->validated();

        $query = InventoryMovement::query()
            ->with([
                'material:id,sku,name,inventory_area,unit',
                'user:id,name,email',
            ])
            ->orderByDesc('occurred_at')
            ->orderByDesc('id');

        if (! empty($filters['from'])) {
            $query->where('occurred_at', '>=', $filters['from']);
        }

        if (! empty($filters['to'])) {
            $query->where('occurred_at', '<=', $filters['to']);
        }

        if (! empty($filters['movement_type'])) {
            $query->where('movement_type', $filters['movement_type']);
        }

        if (! empty($filters['material_id'])) {
            $query->where('material_id', $filters['material_id']);
        }

        if (! empty($filters['inventory_area'])) {
            $query->whereHas('material', function ($q) use ($filters) {
                $q->where('inventory_area', $filters['inventory_area']);
            });
        }

        if (! empty($filters['reference_type'])) {
            $query->where('reference_type', $filters['reference_type']);
        }

        if (array_key_exists('reference_id', $filters) && $filters['reference_id'] !== null) {
            $query->where('reference_id', $filters['reference_id']);
        }

        if (! empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }

        if (! empty($filters['search'])) {
            $term = '%'.addcslashes($filters['search'], '%_\\').'%';
            $query->whereHas('material', function ($q) use ($term) {
                $q->where('sku', 'like', $term)->orWhere('name', 'like', $term);
            });
        }

        $perPage = min((int) ($filters['per_page'] ?? $request->query('per_page', 50)), 200);

        return response()->json($query->paginate($perPage));
    }
}
