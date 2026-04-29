<?php

namespace App\Services;

use App\Enums\DeliveryNoteStatus;
use App\Models\CorteBobinaUsage;
use App\Models\DeliveryNoteLine;
use App\Models\WorkOrder;
use Illuminate\Validation\ValidationException;

class CorteDispatchService
{
    /**
     * Suma de kg ya reservados o despachados contra esta línea de corte (notas no canceladas).
     */
    public function quantityAllocatedToCorteUsage(int $corteBobinaUsageId): string
    {
        $sum = DeliveryNoteLine::query()
            ->join('delivery_notes as dn', 'delivery_note_lines.delivery_note_id', '=', 'dn.id')
            ->where('delivery_note_lines.corte_bobina_usage_id', $corteBobinaUsageId)
            ->where('dn.status', '!=', DeliveryNoteStatus::Cancelled->value)
            ->sum('delivery_note_lines.quantity_kg');

        return number_format((float) $sum, 3, '.', '');
    }

    /**
     * Remanente despachable = material terminado en corte − ya en notas (draft o despachadas).
     */
    public function quantityRemainingForCorteUsage(CorteBobinaUsage $usage): string
    {
        $finished = number_format((float) $usage->quantity_finished_kg, 3, '.', '');
        $allocated = $this->quantityAllocatedToCorteUsage((int) $usage->getKey());

        return bcsub($finished, $allocated, 3);
    }

    /**
     * @throws ValidationException
     */
    public function assertCanAllocateFromCorteUsage(
        int $corteBobinaUsageId,
        string $quantityKg,
        ?int $workOrderIdFromLine,
    ): void {
        $usage = CorteBobinaUsage::query()->findOrFail($corteBobinaUsageId);

        if ($workOrderIdFromLine !== null && (int) $workOrderIdFromLine !== (int) $usage->work_order_id) {
            throw ValidationException::withMessages([
                'lines' => ['La orden de trabajo de la línea no coincide con la línea de corte seleccionada.'],
            ]);
        }

        $remaining = $this->quantityRemainingForCorteUsage($usage);
        if (bccomp($quantityKg, '0', 3) <= 0) {
            throw ValidationException::withMessages([
                'lines' => ['La cantidad a despachar debe ser mayor que cero.'],
            ]);
        }
        if (bccomp($quantityKg, $remaining, 3) > 0) {
            throw ValidationException::withMessages([
                'lines' => [
                    sprintf(
                        'Cantidad excede lo disponible desde corte (OT %s, línea corte #%d): quedan %s kg, se pidieron %s kg.',
                        WorkOrder::query()->whereKey($usage->work_order_id)->value('code') ?? '?',
                        $usage->getKey(),
                        $remaining,
                        $quantityKg,
                    ),
                ],
            ]);
        }
    }

    /**
     * Bloquea cada línea de corte referenciada y valida remanente (agrupa varias líneas de la misma nota contra el mismo uso).
     * Ejecutar dentro del mismo DB::transaction que crea la nota.
     *
     * @param  list<array<string, mixed>>  $linesInput
     */
    public function validateAndLockCorteLines(array $linesInput): void
    {
        $totalsByUsage = [];
        foreach ($linesInput as $line) {
            if (! is_array($line)) {
                continue;
            }
            $cid = isset($line['corte_bobina_usage_id']) ? (int) $line['corte_bobina_usage_id'] : null;
            if ($cid === null) {
                continue;
            }
            $qty = number_format((float) ($line['quantity_kg'] ?? 0), 3, '.', '');
            $totalsByUsage[$cid] = bcadd($totalsByUsage[$cid] ?? '0.000', $qty, 3);
        }

        foreach ($totalsByUsage as $cid => $totalQty) {
            CorteBobinaUsage::query()->whereKey($cid)->lockForUpdate()->firstOrFail();
            $firstLine = null;
            foreach ($linesInput as $line) {
                if (is_array($line) && (int) ($line['corte_bobina_usage_id'] ?? 0) === (int) $cid) {
                    $firstLine = $line;
                    break;
                }
            }
            $wo = $firstLine !== null && isset($firstLine['work_order_id']) ? (int) $firstLine['work_order_id'] : null;
            $this->assertCanAllocateFromCorteUsage((int) $cid, $totalQty, $wo);
        }
    }

    /**
     * Líneas de corte con saldo > 0 para armar despacho (PDF §5).
     *
     * @return list<array<string, mixed>>
     */
    public function listAvailableForDispatch(?int $workOrderId = null, ?int $productId = null, ?int $clientId = null): array
    {
        $q = CorteBobinaUsage::query()
            ->with([
                'workOrder:id,code,client_id,product_id,client_order_reference',
                'workOrder.client:id,name',
                'workOrder.product:id,name,cpe',
                'material:id,sku,name,unit',
                'bobina:id,code',
            ])
            ->where('quantity_finished_kg', '>', 0)
            ->orderByDesc('id');

        if ($workOrderId !== null) {
            $q->where('work_order_id', $workOrderId);
        }
        if ($productId !== null) {
            $q->whereHas('workOrder', fn ($w) => $w->where('product_id', $productId));
        }
        if ($clientId !== null) {
            $q->whereHas('workOrder', fn ($w) => $w->where('client_id', $clientId));
        }

        $out = [];
        foreach ($q->limit(500)->get() as $usage) {
            $remaining = $this->quantityRemainingForCorteUsage($usage);
            if (bccomp($remaining, '0', 3) <= 0) {
                continue;
            }
            $wo = $usage->workOrder;
            $out[] = [
                'corte_bobina_usage_id' => $usage->getKey(),
                'work_order_id' => $usage->work_order_id,
                'work_order_code' => $wo?->code,
                'client_id' => $wo?->client_id,
                'client_name' => $wo?->client?->name,
                'product_id' => $wo?->product_id,
                'product_name' => $wo?->product?->name,
                'product_cpe' => $wo?->product?->cpe,
                'material_id' => $usage->material_id,
                'material_sku' => $usage->material?->sku,
                'quantity_finished_kg' => number_format((float) $usage->quantity_finished_kg, 3, '.', ''),
                'quantity_dispatched_kg' => $this->quantityAllocatedToCorteUsage((int) $usage->getKey()),
                'quantity_remaining_kg' => $remaining,
                'bobina_id' => $usage->bobina_id,
                'bobina_code' => $usage->bobina?->code,
                'pallet_code' => $usage->bobina?->code ?? ($usage->bobina_id ? 'BOB-'.$usage->bobina_id : null),
                'bobbin_count' => 1,
            ];
        }

        return $out;
    }

    /**
     * Consolida saldo disponible por producto y conserva detalle por línea/paleta.
     *
     * @param  list<array<string, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    public function groupAvailableByProduct(array $rows): array
    {
        $groups = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $productId = isset($row['product_id']) ? (int) $row['product_id'] : 0;
            $groupKey = $productId > 0 ? 'p:'.$productId : 'p:unknown';
            if (! isset($groups[$groupKey])) {
                $groups[$groupKey] = [
                    'product_id' => $row['product_id'] ?? null,
                    'product_name' => $row['product_name'] ?? null,
                    'product_cpe' => $row['product_cpe'] ?? null,
                    'material_id' => $row['material_id'] ?? null,
                    'material_sku' => $row['material_sku'] ?? null,
                    'total_finished_kg' => '0.000',
                    'total_dispatched_kg' => '0.000',
                    'total_remaining_kg' => '0.000',
                    'work_order_count' => 0,
                    'rows' => [],
                ];
            }

            $groups[$groupKey]['rows'][] = $row;
            $groups[$groupKey]['total_finished_kg'] = bcadd(
                $groups[$groupKey]['total_finished_kg'],
                number_format((float) ($row['quantity_finished_kg'] ?? 0), 3, '.', ''),
                3,
            );
            $groups[$groupKey]['total_dispatched_kg'] = bcadd(
                $groups[$groupKey]['total_dispatched_kg'],
                number_format((float) ($row['quantity_dispatched_kg'] ?? 0), 3, '.', ''),
                3,
            );
            $groups[$groupKey]['total_remaining_kg'] = bcadd(
                $groups[$groupKey]['total_remaining_kg'],
                number_format((float) ($row['quantity_remaining_kg'] ?? 0), 3, '.', ''),
                3,
            );
        }

        foreach ($groups as $key => $group) {
            $uniqueWorkOrders = [];
            foreach ($group['rows'] as $detailRow) {
                $woId = isset($detailRow['work_order_id']) ? (int) $detailRow['work_order_id'] : 0;
                if ($woId > 0) {
                    $uniqueWorkOrders[$woId] = true;
                }
            }
            $groups[$key]['work_order_count'] = count($uniqueWorkOrders);
        }

        usort($groups, function (array $a, array $b): int {
            return bccomp(
                (string) ($b['total_remaining_kg'] ?? '0.000'),
                (string) ($a['total_remaining_kg'] ?? '0.000'),
                3,
            );
        });

        return array_values($groups);
    }
}
