<?php

namespace App\Services;

use App\Enums\DeliveryNoteStatus;
use App\Enums\PurchaseOrderStatus;
use App\Models\CorteBobinaUsage;
use App\Models\DeliveryNote;
use App\Models\InventoryMovement;
use App\Models\LaminacionBobinaUsage;
use App\Models\PrintingBobinaUsage;
use App\Models\PurchaseOrder;
use Illuminate\Support\Facades\DB;

/**
 * Recalcula el estado de las órdenes de compra (open/partial/completed) bajo la
 * regla nueva: una OC se considera "Completada" cuando TODAS las órdenes de
 * trabajo que consumieron material trazable a ella tienen al menos una nota
 * de entrega despachada (status = dispatched), o cuando el jefe la cerró
 * manualmente. Caso contrario queda en "Abierta" o "Parcial".
 *
 * Trazabilidad: bobinas no tienen FK directa a purchase_receipt_lines, pero
 * su movimiento de creación (`inventory_movements` con reference_type='bobina')
 * incluye en `metadata` la `purchase_order_id` original. A partir de esos
 * `bobina_id` se busca consumo en printing/laminacion/corte_bobina_usages para
 * obtener las work_orders consumidoras.
 */
class PurchaseOrderClosingService
{
    /**
     * Recalcula y guarda el estado de la OC dada.
     */
    public function recompute(PurchaseOrder $po): void
    {
        $po->loadMissing('lines');
        $lines = $po->lines;

        if ($lines->isEmpty()) {
            $this->persistStatus($po, PurchaseOrderStatus::Open->value);

            return;
        }

        if ($po->manually_closed_at !== null) {
            $this->persistStatus($po, PurchaseOrderStatus::Completed->value);

            return;
        }

        $anyReceived = $lines->contains(
            fn ($l) => bccomp((string) $l->quantity_received, '0', 3) === 1,
        );

        if (! $anyReceived) {
            $this->persistStatus($po, PurchaseOrderStatus::Open->value);

            return;
        }

        $workOrderIds = $this->workOrderIdsConsumingFromPo((int) $po->getKey());

        if (empty($workOrderIds)) {
            $this->persistStatus($po, PurchaseOrderStatus::Partial->value);

            return;
        }

        $allDispatched = true;
        foreach ($workOrderIds as $woId) {
            $hasDispatched = DeliveryNote::query()
                ->where('work_order_id', $woId)
                ->where('status', DeliveryNoteStatus::Dispatched->value)
                ->exists();
            if (! $hasDispatched) {
                $allDispatched = false;
                break;
            }
        }

        $this->persistStatus(
            $po,
            $allDispatched
                ? PurchaseOrderStatus::Completed->value
                : PurchaseOrderStatus::Partial->value,
        );
    }

    /**
     * Para un work_order_id (típicamente disparado al despachar una nota),
     * recalcula todas las OCs cuyo material fue consumido por esa OT.
     */
    public function syncFromWorkOrder(int $workOrderId): void
    {
        if ($workOrderId < 1) {
            return;
        }

        $bobinaIds = $this->bobinaIdsConsumedByWorkOrder($workOrderId);
        if (empty($bobinaIds)) {
            return;
        }

        $purchaseOrderIds = InventoryMovement::query()
            ->where('reference_type', 'bobina')
            ->whereIn('reference_id', $bobinaIds)
            ->whereNotNull('metadata->purchase_order_id')
            ->get(['metadata'])
            ->map(fn ($mov) => (int) (is_array($mov->metadata) ? ($mov->metadata['purchase_order_id'] ?? 0) : 0))
            ->filter(fn ($value) => $value > 0)
            ->unique()
            ->values()
            ->all();

        if (empty($purchaseOrderIds)) {
            return;
        }

        PurchaseOrder::query()
            ->whereIn('id', $purchaseOrderIds)
            ->each(function (PurchaseOrder $po): void {
                $this->recompute($po);
            });
    }

    /**
     * Recorre todas las OCs y las recalcula. Útil para backfill / migraciones
     * de datos legacy que estén con el estado antiguo (calculado solo por
     * recepciones).
     *
     * @return array{updated:int,unchanged:int}
     */
    public function recomputeAll(): array
    {
        $updated = 0;
        $unchanged = 0;
        PurchaseOrder::query()->orderBy('id')->each(function (PurchaseOrder $po) use (&$updated, &$unchanged): void {
            $before = (string) $po->status;
            $this->recompute($po);
            $after = (string) $po->fresh()->status;
            if ($before === $after) {
                $unchanged++;
            } else {
                $updated++;
            }
        });

        return ['updated' => $updated, 'unchanged' => $unchanged];
    }

    /**
     * @return list<int>
     */
    private function workOrderIdsConsumingFromPo(int $purchaseOrderId): array
    {
        $bobinaIds = $this->bobinaIdsForPurchaseOrder($purchaseOrderId);
        if (empty($bobinaIds)) {
            return [];
        }

        $workOrderIds = collect()
            ->merge(PrintingBobinaUsage::query()->whereIn('bobina_id', $bobinaIds)->pluck('work_order_id'))
            ->merge(LaminacionBobinaUsage::query()->whereIn('bobina_id', $bobinaIds)->pluck('work_order_id'))
            ->merge(CorteBobinaUsage::query()->whereIn('bobina_id', $bobinaIds)->pluck('work_order_id'))
            ->map(fn ($v) => (int) $v)
            ->filter(fn ($v) => $v > 0)
            ->unique()
            ->values()
            ->all();

        return $workOrderIds;
    }

    /**
     * @return list<int>
     */
    private function bobinaIdsForPurchaseOrder(int $purchaseOrderId): array
    {
        return InventoryMovement::query()
            ->where('reference_type', 'bobina')
            ->where('metadata->purchase_order_id', $purchaseOrderId)
            ->get(['reference_id'])
            ->map(fn ($mov) => (int) $mov->reference_id)
            ->filter(fn ($v) => $v > 0)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @return list<int>
     */
    private function bobinaIdsConsumedByWorkOrder(int $workOrderId): array
    {
        $bobinaIds = collect()
            ->merge(PrintingBobinaUsage::query()->where('work_order_id', $workOrderId)->pluck('bobina_id'))
            ->merge(LaminacionBobinaUsage::query()->where('work_order_id', $workOrderId)->pluck('bobina_id'))
            ->merge(CorteBobinaUsage::query()->where('work_order_id', $workOrderId)->pluck('bobina_id'))
            ->map(fn ($v) => (int) $v)
            ->filter(fn ($v) => $v > 0)
            ->unique()
            ->values()
            ->all();

        return $bobinaIds;
    }

    private function persistStatus(PurchaseOrder $po, string $status): void
    {
        if ((string) $po->status === $status) {
            return;
        }
        DB::table('purchase_orders')
            ->where('id', $po->getKey())
            ->update(['status' => $status, 'updated_at' => now()]);
        $po->status = $status;
    }
}
