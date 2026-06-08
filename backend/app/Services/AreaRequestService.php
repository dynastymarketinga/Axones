<?php

namespace App\Services;

use App\Enums\AreaRequestStatus;
use App\Models\AreaRequest;
use Illuminate\Database\Eloquent\Builder;

class AreaRequestService
{
    /**
     * Cierra solicitudes pendientes anteriores de coordinación OT (misma área),
     * para dejar una sola fila activa por OT y área. No afecta avisos de insumos.
     */
    public function supersedePendingWorkOrderCoordination(int $workOrderId, string $area, ?int $exceptRequestId = null): int
    {
        $area = strtolower(trim($area));
        if ($area === '') {
            return 0;
        }

        $query = AreaRequest::query()
            ->where('work_order_id', $workOrderId)
            ->where('area', $area)
            ->whereNull('material_request_id')
            ->where('status', AreaRequestStatus::Pending->value);

        if ($exceptRequestId !== null) {
            $query->where('id', '!=', $exceptRequestId);
        }

        return $query->update(['status' => AreaRequestStatus::Done->value]);
    }

    /** Solo avisos espejo de solicitudes de insumos (formulario /api/material-requests). */
    public function applyMaterialInsumosOnlyFilter(Builder $query): void
    {
        $query->whereNotNull('material_request_id');
    }

    /**
     * Separa bandeja manual vs sustratos virgen generados al guardar planilla OT.
     *
     * @param  'manual'|'ot_planilla'  $origin
     */
    public function applyInsumosOriginFilter(Builder $query, string $origin): void
    {
        $marker = PlanillaSustratoMaterialRequestSyncService::NOTES_MARKER.'%';

        $query->whereHas('materialRequest', function (Builder $q) use ($origin, $marker): void {
            if ($origin === 'ot_planilla') {
                $q->where('notes', 'like', $marker);
            } else {
                $q->where(function (Builder $q2) use ($marker): void {
                    $q2->whereNull('notes')->orWhere('notes', 'not like', $marker);
                });
            }
        });
    }

    /**
     * En listados: una fila por OT y área (la más reciente) para coordinación entre áreas.
     * Las solicitudes de insumos (material_request_id) y las manuales sin OT se listan completas.
     */
    public function applyWorkOrderCoordinationListFilter(Builder $query): void
    {
        $latestIds = AreaRequest::query()
            ->selectRaw('MAX(id) as id')
            ->whereNotNull('work_order_id')
            ->whereNull('material_request_id')
            ->groupBy('work_order_id', 'area');

        $query->where(function (Builder $q) use ($latestIds): void {
            $q->whereNotNull('material_request_id')
                ->orWhereNull('work_order_id')
                ->orWhereIn('id', $latestIds);
        });
    }

    /**
     * Marca como completadas las solicitudes OT duplicadas, dejando solo la más reciente por área.
     *
     * @return array{groups: int, closed: int}
     */
    public function consolidateDuplicateWorkOrderCoordination(): array
    {
        $groups = AreaRequest::query()
            ->selectRaw('work_order_id, area, MAX(id) as keep_id')
            ->whereNotNull('work_order_id')
            ->whereNull('material_request_id')
            ->where('status', AreaRequestStatus::Pending->value)
            ->groupBy('work_order_id', 'area')
            ->get();

        $closed = 0;
        foreach ($groups as $group) {
            $closed += AreaRequest::query()
                ->where('work_order_id', $group->work_order_id)
                ->where('area', $group->area)
                ->whereNull('material_request_id')
                ->where('status', AreaRequestStatus::Pending->value)
                ->where('id', '!=', (int) $group->keep_id)
                ->update(['status' => AreaRequestStatus::Done->value]);
        }

        return [
            'groups' => $groups->count(),
            'closed' => $closed,
        ];
    }

    /** Avisos espejo de solicitudes de insumos pendientes de despacho (bandeja almacén). */
    public function countPendingWarehouseInsumos(): int
    {
        return $this->pendingWarehouseInsumosBreakdown()['total'];
    }

    /**
     * @return array{total: int, manual: int, ot_planilla: int}
     */
    public function pendingWarehouseInsumosBreakdown(): array
    {
        $rows = AreaRequest::query()
            ->whereNotNull('material_request_id')
            ->where('status', AreaRequestStatus::Pending->value)
            ->with(['materialRequest:id,notes'])
            ->get(['id', 'material_request_id']);

        $marker = PlanillaSustratoMaterialRequestSyncService::NOTES_MARKER;
        $manual = 0;
        $otPlanilla = 0;

        foreach ($rows as $row) {
            $notes = trim((string) ($row->materialRequest?->notes ?? ''));
            if (str_starts_with($notes, $marker)) {
                $otPlanilla++;
            } else {
                $manual++;
            }
        }

        return [
            'total' => $manual + $otPlanilla,
            'manual' => $manual,
            'ot_planilla' => $otPlanilla,
        ];
    }

    /**
     * Depura solicitudes `done` antiguas para producción.
     *
     * Conserva siempre:
     * - Todas las filas `pending` (y `cancelled`)
     * - La fila más reciente por OT+área de coordinación (historial / listado)
     *
     * Elimina cuando superan la retención:
     * - Coordinación OT `done` duplicada u obsoleta
     * - Espejos de insumos al almacén ya completados
     * - Solicitudes manuales sin OT completadas
     *
     * @return array{deleted: int, candidates: int, retention_days: int, dry_run: bool}
     */
    public function purgeDoneAreaRequests(int $retentionDays, bool $dryRun = false): array
    {
        $retentionDays = max(1, $retentionDays);
        $cutoff = now()->subDays($retentionDays);

        $latestCoordinationIds = AreaRequest::query()
            ->selectRaw('MAX(id) as id')
            ->whereNotNull('work_order_id')
            ->whereNull('material_request_id')
            ->groupBy('work_order_id', 'area')
            ->pluck('id')
            ->map(static fn ($id) => (int) $id)
            ->all();

        $query = AreaRequest::query()
            ->where('status', AreaRequestStatus::Done->value)
            ->where('updated_at', '<', $cutoff)
            ->where(function (Builder $q) use ($latestCoordinationIds): void {
                $q->whereNotNull('material_request_id')
                    ->orWhereNull('work_order_id');

                if ($latestCoordinationIds !== []) {
                    $q->orWhereNotIn('id', $latestCoordinationIds);
                }
            });

        $candidates = (clone $query)->count();

        if ($dryRun || $candidates === 0) {
            return [
                'deleted' => $candidates,
                'candidates' => $candidates,
                'retention_days' => $retentionDays,
                'dry_run' => $dryRun,
            ];
        }

        $deleted = 0;
        (clone $query)
            ->orderBy('id')
            ->select('id')
            ->chunkById(500, function ($rows) use (&$deleted): void {
                $ids = $rows->pluck('id')->all();
                if ($ids === []) {
                    return;
                }
                $deleted += AreaRequest::query()->whereIn('id', $ids)->delete();
            });

        return [
            'deleted' => $deleted,
            'candidates' => $candidates,
            'retention_days' => $retentionDays,
            'dry_run' => false,
        ];
    }
}
