<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\InventoryMovementsIndexRequest;
use App\Models\InventoryMovement;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

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

        // Misma ventana que reports/inventory-movements-general (inicio/fin de día).
        if (! empty($filters['from'])) {
            $query->where('occurred_at', '>=', Carbon::parse($filters['from'])->startOfDay());
        }

        if (! empty($filters['to'])) {
            $query->where('occurred_at', '<=', Carbon::parse($filters['to'])->endOfDay());
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

        $applyInvalidReferenceFilter = function (Builder $q): void {
            $q->where(function (Builder $inner) {
                $inner->whereNull('reference_type')
                    ->orWhere(function (Builder $x) {
                        $x->where('reference_type', '!=', 'inventory_adjustment')
                            ->whereNull('reference_id');
                    })
                    ->orWhereNotIn('reference_type', [
                        'purchase_receipt',
                        'miscellaneous_receipt',
                        'material_request',
                        'inventory_return',
                        'inventory_adjustment',
                    ])
                    ->orWhere(function (Builder $x) {
                        $x->where('reference_type', 'purchase_receipt')
                            ->whereNotExists(function ($sub) {
                                $sub->selectRaw('1')
                                    ->from('purchase_receipts as pr')
                                    ->whereColumn('pr.id', 'inventory_movements.reference_id');
                            });
                    })
                    ->orWhere(function (Builder $x) {
                        $x->where('reference_type', 'miscellaneous_receipt')
                            ->whereNotExists(function ($sub) {
                                $sub->selectRaw('1')
                                    ->from('miscellaneous_receipts as mr')
                                    ->whereColumn('mr.id', 'inventory_movements.reference_id');
                            });
                    })
                    ->orWhere(function (Builder $x) {
                        $x->where('reference_type', 'material_request')
                            ->whereNotExists(function ($sub) {
                                $sub->selectRaw('1')
                                    ->from('material_requests as rq')
                                    ->whereColumn('rq.id', 'inventory_movements.reference_id');
                            });
                    })
                    ->orWhere(function (Builder $x) {
                        $x->where('reference_type', 'inventory_return')
                            ->whereNotExists(function ($sub) {
                                $sub->selectRaw('1')
                                    ->from('inventory_returns as ir')
                                    ->whereColumn('ir.id', 'inventory_movements.reference_id');
                            });
                    });
            });
        };

        if (! empty($filters['invalid_only']) && (bool) $filters['invalid_only'] === true) {
            $applyInvalidReferenceFilter($query);
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

        $paginator = $query->paginate($perPage);
        $ids = $paginator->getCollection()->pluck('id')->all();
        $invalidIds = [];
        if ($ids !== []) {
            $invalidQuery = InventoryMovement::query()->whereIn('id', $ids);
            $applyInvalidReferenceFilter($invalidQuery);
            $invalidIds = $invalidQuery->pluck('id')->all();
        }
        $invalidLookup = array_fill_keys($invalidIds, true);
        $paginator->setCollection(
            $paginator->getCollection()->map(function (InventoryMovement $m) use ($invalidLookup) {
                $metadata = is_array($m->metadata) ? $m->metadata : [];
                $reasonText = trim((string) ($metadata['reason_text'] ?? $metadata['note'] ?? ''));
                $reasonScope = trim((string) ($metadata['reason_scope'] ?? ''));
                $isManualAdjustment = in_array($m->movement_type, ['adjustment_add', 'adjustment_sub'], true)
                    || $reasonScope === 'manual_adjustment';
                $m->setAttribute('is_invalid_reference', isset($invalidLookup[$m->id]));
                $m->setAttribute('reason', $reasonText !== '' ? $reasonText : null);
                $m->setAttribute('reason_scope', $reasonScope !== '' ? $reasonScope : null);
                $m->setAttribute('is_manual_adjustment', $isManualAdjustment);

                return $m;
            })
        );

        return response()->json($paginator);
    }
}
