<?php

namespace App\Services;

use App\Enums\DeliveryNoteStatus;
use App\Models\CorteBobinaUsage;
use App\Models\DeliveryNoteLine;
use App\Models\WorkOrder;
use App\Models\WorkOrderTechnicalDocument;
use App\Services\CortePlanillaDispatchSyncService;
use App\Support\CortePlanillaSalida;
use Illuminate\Validation\ValidationException;

class CorteDispatchService
{
    public function __construct(
        private readonly CortePlanillaDispatchSyncService $planillaDispatchSync,
    ) {}

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
     * Suma de kg ya reservados o despachados para toda la OT (notas no canceladas).
     */
    public function quantityAllocatedToWorkOrder(int $workOrderId): string
    {
        $sum = DeliveryNoteLine::query()
            ->join('delivery_notes as dn', 'delivery_note_lines.delivery_note_id', '=', 'dn.id')
            ->where('delivery_note_lines.work_order_id', $workOrderId)
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
        $this->syncUsagesFromTechnicalDocuments($workOrderId, $productId, $clientId);

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

        $usages = $q->limit(500)->get();

        $out = [];
        foreach ($usages as $usage) {
            $wo = $usage->workOrder;
            $woId = (int) $usage->work_order_id;
            if ($woId <= 0) {
                continue;
            }
            $finished = number_format((float) $usage->quantity_finished_kg, 3, '.', '');
            $allocated = $this->quantityAllocatedToCorteUsage((int) $usage->getKey());
            $remaining = $this->quantityRemainingForCorteUsage($usage);
            if (bccomp($remaining, '0', 3) <= 0) {
                continue;
            }

            $paletaMeta = $this->paletaMetaFromUsageNotes((string) ($usage->notes ?? ''));

            $isProvisional = CortePlanillaDispatchSyncService::isProvisionalNotes((string) ($usage->notes ?? ''));

            $out[] = [
                'corte_bobina_usage_id' => (int) $usage->getKey(),
                'work_order_id' => $woId,
                'work_order_code' => $wo?->code,
                'client_id' => $wo?->client_id,
                'client_name' => $wo?->client?->name,
                'product_id' => $wo?->product_id,
                'product_name' => $wo?->product?->name,
                'product_cpe' => $wo?->product?->cpe,
                'material_id' => $usage->material_id,
                'material_sku' => $usage->material?->sku,
                'quantity_finished_kg' => $finished,
                'quantity_dispatched_kg' => $allocated,
                'quantity_remaining_kg' => $remaining,
                'bobina_id' => $usage->bobina_id,
                'bobina_code' => $usage->bobina?->code,
                'pallet_code' => $paletaMeta['pallet_code'],
                'pallet_label' => $paletaMeta['pallet_label'],
                'paleta_id' => $paletaMeta['paleta_id'],
                'rollos_kg' => $paletaMeta['rollos_kg'],
                'rollos_count' => $paletaMeta['rollos_count'],
                'bobbin_count' => $paletaMeta['rollos_count'],
                'is_provisional' => $isProvisional,
            ];
        }

        $this->mergeFormOnlyPaletaRows($out, $workOrderId, $productId, $clientId);
        $this->enrichPaletaRowsFromTechnicalDocuments($out);

        usort($out, fn ($a, $b) => ((int) ($b['corte_bobina_usage_id'] ?? 0)) <=> ((int) ($a['corte_bobina_usage_id'] ?? 0)));

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
        // Deprecated: Despacho por OT ya entrega una sola fila por OT.
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

    /**
     * Sincroniza corte_bobina_usages desde planillas con paletas o kg de salida (alineado con legacy).
     */
    private function syncUsagesFromTechnicalDocuments(
        ?int $workOrderId,
        ?int $productId,
        ?int $clientId,
    ): void {
        $q = WorkOrderTechnicalDocument::query()->with([
            'workOrder:id,code,client_id,product_id',
        ]);

        if ($workOrderId !== null) {
            $q->where('work_order_id', $workOrderId);
        }
        if ($productId !== null) {
            $q->whereHas('workOrder', fn ($w) => $w->where('product_id', $productId));
        }
        if ($clientId !== null) {
            $q->whereHas('workOrder', fn ($w) => $w->where('client_id', $clientId));
        }

        foreach ($q->get() as $doc) {
            $form = is_array($doc->form) ? $doc->form : [];
            if (! $this->formHasDispatchableCorte($form)) {
                continue;
            }

            $workOrder = $doc->workOrder;
            if ($workOrder === null) {
                continue;
            }

            try {
                $this->planillaDispatchSync->syncFromForm($workOrder, $form);
            } catch (ValidationException) {
                // p. ej. terminado por debajo de lo ya en notas
            }
        }
    }

    /**
     * Paletas cerradas en planilla sin fila de uso aún (p. ej. sin material en líneas OT).
     *
     * @param  list<array<string, mixed>>  $out
     */
    private function mergeFormOnlyPaletaRows(
        array &$out,
        ?int $workOrderId,
        ?int $productId,
        ?int $clientId,
    ): void {
        $existingUsageIds = [];
        foreach ($out as $row) {
            $id = (int) ($row['corte_bobina_usage_id'] ?? 0);
            if ($id > 0) {
                $existingUsageIds[$id] = true;
            }
        }

        $q = WorkOrderTechnicalDocument::query()->with([
            'workOrder:id,code,client_id,product_id',
            'workOrder.client:id,name',
            'workOrder.product:id,name,cpe',
        ]);

        if ($workOrderId !== null) {
            $q->where('work_order_id', $workOrderId);
        }
        if ($productId !== null) {
            $q->whereHas('workOrder', fn ($w) => $w->where('product_id', $productId));
        }
        if ($clientId !== null) {
            $q->whereHas('workOrder', fn ($w) => $w->where('client_id', $clientId));
        }

        foreach ($q->get() as $doc) {
            $form = is_array($doc->form) ? $doc->form : [];
            $wo = $doc->workOrder;
            if ($wo === null) {
                continue;
            }

            foreach ([
                ['paletas' => CortePlanillaSalida::closedPaletasFromForm($form), 'provisional' => false],
                ['paletas' => CortePlanillaSalida::openPaletasWithKgFromForm($form), 'provisional' => true],
            ] as $batch) {
                foreach ($batch['paletas'] as $paleta) {
                    if (! is_array($paleta)) {
                        continue;
                    }
                    $paletaId = trim((string) ($paleta['id'] ?? ''));
                    if ($paletaId === '') {
                        continue;
                    }
                    $finished = number_format(CortePlanillaSalida::sumPaletaKg($paleta), 3, '.', '');
                    if (bccomp($finished, '0', 3) <= 0) {
                        continue;
                    }

                    $notes = $batch['provisional']
                        ? CortePlanillaDispatchSyncService::paletaProvisionalNotes($paletaId)
                        : CortePlanillaDispatchSyncService::paletaNotes($paletaId);
                    $usageId = (int) (CorteBobinaUsage::query()
                        ->where('work_order_id', $wo->getKey())
                        ->where('notes', $notes)
                        ->value('id') ?? 0);

                    if ($usageId > 0 && isset($existingUsageIds[$usageId])) {
                        continue;
                    }

                    $label = trim((string) ($paleta['label'] ?? ''));
                    if ($label === '') {
                        $label = $paletaId;
                    }
                    $rollos = is_array($paleta['rollosKg'] ?? null) ? $paleta['rollosKg'] : [];
                    $rollosCount = 0;
                    foreach ($rollos as $kg) {
                        if ((float) str_replace(',', '.', (string) $kg) > 0) {
                            $rollosCount++;
                        }
                    }

                    $out[] = [
                        'corte_bobina_usage_id' => $usageId > 0 ? $usageId : null,
                        'work_order_id' => (int) $wo->getKey(),
                        'work_order_code' => $wo->code,
                        'client_id' => $wo->client_id,
                        'client_name' => $wo->client?->name,
                        'product_id' => $wo->product_id,
                        'product_name' => $wo->product?->name,
                        'product_cpe' => $wo->product?->cpe,
                        'material_id' => null,
                        'material_sku' => null,
                        'quantity_finished_kg' => $finished,
                        'quantity_dispatched_kg' => '0.000',
                        'quantity_remaining_kg' => $finished,
                        'bobina_id' => null,
                        'bobina_code' => null,
                        'pallet_code' => $label,
                        'pallet_label' => $label,
                        'paleta_id' => $paletaId,
                        'rollos_kg' => array_values(array_map('strval', $rollos)),
                        'rollos_count' => $rollosCount,
                        'bobbin_count' => $rollosCount,
                        'is_provisional' => $batch['provisional'],
                    ];
                }
            }
        }
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function enrichPaletaRowsFromTechnicalDocuments(array &$rows): void
    {
        $woIds = [];
        foreach ($rows as $row) {
            $woId = (int) ($row['work_order_id'] ?? 0);
            if ($woId > 0) {
                $woIds[$woId] = true;
            }
        }
        if ($woIds === []) {
            return;
        }

        $docs = WorkOrderTechnicalDocument::query()
            ->whereIn('work_order_id', array_keys($woIds))
            ->get(['work_order_id', 'form']);

        $paletasByWo = [];
        foreach ($docs as $doc) {
            $form = is_array($doc->form) ? $doc->form : [];
            $woId = (int) $doc->work_order_id;
            $paletasByWo[$woId] = [];
            foreach (CortePlanillaSalida::paletasArrayFromForm($form) as $paleta) {
                if (! is_array($paleta)) {
                    continue;
                }
                $id = trim((string) ($paleta['id'] ?? ''));
                if ($id !== '') {
                    $paletasByWo[$woId][$id] = $paleta;
                }
            }
        }

        foreach ($rows as $idx => $row) {
            $woId = (int) ($row['work_order_id'] ?? 0);
            $paletaId = (string) ($row['paleta_id'] ?? '');
            if ($woId <= 0 || $paletaId === '') {
                continue;
            }
            $paleta = $paletasByWo[$woId][$paletaId] ?? null;
            if (! is_array($paleta)) {
                continue;
            }
            $label = trim((string) ($paleta['label'] ?? ''));
            if ($label !== '') {
                $rows[$idx]['pallet_label'] = $label;
                $rows[$idx]['pallet_code'] = $label;
            }
            $rollos = is_array($paleta['rollosKg'] ?? null) ? $paleta['rollosKg'] : [];
            $rollosCount = 0;
            foreach ($rollos as $kg) {
                if ((float) str_replace(',', '.', (string) $kg) > 0) {
                    $rollosCount++;
                }
            }
            $rows[$idx]['rollos_kg'] = array_values(array_map('strval', $rollos));
            $rows[$idx]['rollos_count'] = $rollosCount;
            $rows[$idx]['bobbin_count'] = $rollosCount;
        }
    }

    /**
     * @return array{paleta_id: string|null, pallet_label: string|null, pallet_code: string|null, rollos_kg: list<string>, rollos_count: int}
     */
    private function paletaMetaFromUsageNotes(string $notes): array
    {
        $paletaId = CortePlanillaDispatchSyncService::paletaIdFromNotes($notes);
        if ($paletaId === null) {
            return [
                'paleta_id' => null,
                'pallet_label' => null,
                'pallet_code' => null,
                'rollos_kg' => [],
                'rollos_count' => 0,
            ];
        }

        return [
            'paleta_id' => $paletaId,
            'pallet_label' => $paletaId,
            'pallet_code' => $paletaId,
            'rollos_kg' => [],
            'rollos_count' => 0,
        ];
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private function formHasDispatchableCorte(array $form): bool
    {
        foreach (CortePlanillaSalida::closedPaletasFromForm($form) as $paleta) {
            if (is_array($paleta) && CortePlanillaSalida::sumPaletaKg($paleta) > 0) {
                return true;
            }
        }

        foreach (CortePlanillaSalida::openPaletasWithKgFromForm($form) as $paleta) {
            if (is_array($paleta) && CortePlanillaSalida::sumPaletaKg($paleta) > 0) {
                return true;
            }
        }

        return false;
    }
}
