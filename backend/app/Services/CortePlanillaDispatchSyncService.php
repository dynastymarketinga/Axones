<?php

namespace App\Services;

use App\Enums\DeliveryNoteStatus;
use App\Models\CorteBobinaUsage;
use App\Models\DeliveryNoteLine;
use App\Models\WorkOrder;
use App\Support\CorteDispatchMaterialResolver;
use App\Support\CortePlanillaSalida;
use Illuminate\Validation\ValidationException;

/**
 * Sincroniza kg de paletas hacia corte_bobina_usages (despacho).
 * - Paleta cerrada: fila definitiva (nota de entrega).
 * - Paleta en progreso con pesos: fila provisional (visible en despacho, no seleccionable para nota).
 * Guardar en planilla no finaliza corEstadoArea; solo «Finalizar área de corte» cierra el área.
 */
class CortePlanillaDispatchSyncService
{
    public const PLANILLA_NOTES = 'auto:planilla';

    public const PROVISIONAL_SUFFIX = ':provisional';

    public static function paletaNotes(string $paletaId): string
    {
        return self::PLANILLA_NOTES.':paleta:'.trim($paletaId);
    }

    public static function paletaProvisionalNotes(string $paletaId): string
    {
        return self::paletaNotes($paletaId).self::PROVISIONAL_SUFFIX;
    }

    public static function isProvisionalNotes(string $notes): bool
    {
        return str_ends_with($notes, self::PROVISIONAL_SUFFIX);
    }

    /**
     * ID de paleta sin sufijo provisional (para cruce con cor_paletas).
     */
    public static function paletaIdFromNotes(string $notes): ?string
    {
        $prefix = self::PLANILLA_NOTES.':paleta:';
        if (! str_starts_with($notes, $prefix)) {
            return null;
        }
        $rest = trim(substr($notes, strlen($prefix)));
        if ($rest === '') {
            return null;
        }
        if (str_ends_with($rest, self::PROVISIONAL_SUFFIX)) {
            $rest = substr($rest, 0, -strlen(self::PROVISIONAL_SUFFIX));
        }

        return $rest !== '' ? $rest : null;
    }

    /**
     * Sincroniza paletas cerradas (definitivas) y abiertas con kg (provisionales).
     *
     * @param  array<string, mixed>  $form
     */
    public function syncFromForm(WorkOrder $workOrder, array $form): void
    {
        $materialId = CorteDispatchMaterialResolver::ensureForWorkOrder($workOrder);

        if ($materialId === null) {
            return;
        }

        $usedKg = CortePlanillaSalida::usedKgFromForm($form);
        $closedPaletas = CortePlanillaSalida::closedPaletasFromForm($form);
        $openPaletas = CortePlanillaSalida::openPaletasWithKgFromForm($form);
        $syncedDefinitiveNotes = [];
        $closedPaletaIds = [];
        $activeProvisionalNotes = [];

        foreach ($closedPaletas as $paleta) {
            if (! is_array($paleta)) {
                continue;
            }
            $paletaId = trim((string) ($paleta['id'] ?? ''));
            if ($paletaId === '') {
                continue;
            }
            $closedPaletaIds[$paletaId] = true;
            $finishedKg = number_format(CortePlanillaSalida::sumPaletaKg($paleta), 3, '.', '');
            $notes = self::paletaNotes($paletaId);
            $syncedDefinitiveNotes[] = $notes;

            $this->deleteUsageIfUnallocated($workOrder, self::paletaProvisionalNotes($paletaId));

            if (bccomp($finishedKg, '0', 3) <= 0) {
                $this->deleteUsageIfUnallocated($workOrder, $notes);

                continue;
            }

            $this->upsertPaletaUsage($workOrder, $materialId, $notes, $usedKg, $finishedKg);
        }

        foreach ($openPaletas as $paleta) {
            if (! is_array($paleta)) {
                continue;
            }
            $paletaId = trim((string) ($paleta['id'] ?? ''));
            if ($paletaId === '' || isset($closedPaletaIds[$paletaId])) {
                continue;
            }
            $finishedKg = number_format(CortePlanillaSalida::sumPaletaKg($paleta), 3, '.', '');
            $notes = self::paletaProvisionalNotes($paletaId);
            $activeProvisionalNotes[] = $notes;

            if (bccomp($finishedKg, '0', 3) <= 0) {
                $this->deleteUsageIfUnallocated($workOrder, $notes);

                continue;
            }

            $this->upsertPaletaUsage($workOrder, $materialId, $notes, $usedKg, $finishedKg);
        }

        $this->retireStaleProvisionalUsages($workOrder, $activeProvisionalNotes);
        $this->retireLegacyAggregateUsage($workOrder, $syncedDefinitiveNotes);
    }

    /**
     * Estado de sincronización tras guardar corte (para avisos en UI).
     *
     * @param  array<string, mixed>  $form
     * @return array{
     *   material_resolved: bool,
     *   closed_paletas_with_kg: int,
     *   usages_synced: int,
     *   provisional_paletas_with_kg: int,
     *   provisional_synced: int
     * }
     */
    public function dispatchSyncStatus(WorkOrder $workOrder, array $form): array
    {
        $materialResolved = CorteDispatchMaterialResolver::canEnsureForWorkOrder($workOrder);
        $closedWithKg = 0;
        $synced = 0;
        $provisionalWithKg = 0;
        $provisionalSynced = 0;

        foreach (CortePlanillaSalida::closedPaletasFromForm($form) as $paleta) {
            if (! is_array($paleta)) {
                continue;
            }
            if (CortePlanillaSalida::sumPaletaKg($paleta) <= 0) {
                continue;
            }
            $closedWithKg++;
            $paletaId = trim((string) ($paleta['id'] ?? ''));
            if ($paletaId === '') {
                continue;
            }
            $exists = CorteBobinaUsage::query()
                ->where('work_order_id', $workOrder->getKey())
                ->where('notes', self::paletaNotes($paletaId))
                ->where('quantity_finished_kg', '>', 0)
                ->exists();
            if ($exists) {
                $synced++;
            }
        }

        foreach (CortePlanillaSalida::openPaletasWithKgFromForm($form) as $paleta) {
            if (! is_array($paleta)) {
                continue;
            }
            $provisionalWithKg++;
            $paletaId = trim((string) ($paleta['id'] ?? ''));
            if ($paletaId === '') {
                continue;
            }
            $exists = CorteBobinaUsage::query()
                ->where('work_order_id', $workOrder->getKey())
                ->where('notes', self::paletaProvisionalNotes($paletaId))
                ->where('quantity_finished_kg', '>', 0)
                ->exists();
            if ($exists) {
                $provisionalSynced++;
            }
        }

        return [
            'material_resolved' => $materialResolved,
            'closed_paletas_with_kg' => $closedWithKg,
            'usages_synced' => $synced,
            'provisional_paletas_with_kg' => $provisionalWithKg,
            'provisional_synced' => $provisionalSynced,
        ];
    }

    private function upsertPaletaUsage(
        WorkOrder $workOrder,
        int $materialId,
        string $notes,
        string $usedKg,
        string $finishedKg,
    ): void {
        $usage = CorteBobinaUsage::query()
            ->where('work_order_id', $workOrder->getKey())
            ->whereNull('bobina_id')
            ->where('notes', $notes)
            ->orderByDesc('id')
            ->first();

        $allocated = $usage !== null
            ? $this->quantityAllocatedToUsage((int) $usage->getKey())
            : '0.000';

        if (bccomp($finishedKg, $allocated, 3) < 0) {
            $label = self::paletaIdFromNotes($notes) ?? $notes;
            throw ValidationException::withMessages([
                'form.cor_paletas' => [
                    sprintf(
                        'No se puede reducir el material terminado de la paleta %s por debajo de lo ya asignado en notas (%s kg).',
                        $label,
                        $allocated,
                    ),
                ],
            ]);
        }

        if ($usage === null) {
            CorteBobinaUsage::query()->create([
                'work_order_id' => $workOrder->getKey(),
                'bobina_id' => null,
                'material_id' => $materialId,
                'quantity_used_kg' => $usedKg,
                'quantity_finished_kg' => $finishedKg,
                'notes' => $notes,
            ]);

            return;
        }

        $usage->update([
            'material_id' => $materialId,
            'quantity_used_kg' => $usedKg,
            'quantity_finished_kg' => $finishedKg,
        ]);
    }

    /**
     * @param  list<string>  $activePaletaNotes
     */
    private function retireLegacyAggregateUsage(WorkOrder $workOrder, array $activePaletaNotes): void
    {
        $legacy = CorteBobinaUsage::query()
            ->where('work_order_id', $workOrder->getKey())
            ->whereNull('bobina_id')
            ->where('notes', self::PLANILLA_NOTES)
            ->first();

        if ($legacy === null) {
            return;
        }

        if ($activePaletaNotes !== []) {
            $this->deleteUsageIfUnallocated($workOrder, self::PLANILLA_NOTES);
        }
    }

    /**
     * Elimina filas provisionales que ya no corresponden a paletas abiertas con kg.
     *
     * @param  list<string>  $activeProvisionalNotes
     */
    private function retireStaleProvisionalUsages(WorkOrder $workOrder, array $activeProvisionalNotes): void
    {
        $keep = array_fill_keys($activeProvisionalNotes, true);

        $stale = CorteBobinaUsage::query()
            ->where('work_order_id', $workOrder->getKey())
            ->whereNull('bobina_id')
            ->where('notes', 'like', self::PLANILLA_NOTES.':paleta:%'.self::PROVISIONAL_SUFFIX)
            ->get();

        foreach ($stale as $usage) {
            $notes = (string) ($usage->notes ?? '');
            if (isset($keep[$notes])) {
                continue;
            }
            $allocated = $this->quantityAllocatedToUsage((int) $usage->getKey());
            if (bccomp($allocated, '0', 3) > 0) {
                continue;
            }
            $usage->delete();
        }
    }

    private function deleteUsageIfUnallocated(WorkOrder $workOrder, string $notes): void
    {
        $usage = CorteBobinaUsage::query()
            ->where('work_order_id', $workOrder->getKey())
            ->whereNull('bobina_id')
            ->where('notes', $notes)
            ->first();

        if ($usage === null) {
            return;
        }

        $allocated = $this->quantityAllocatedToUsage((int) $usage->getKey());
        if (bccomp($allocated, '0', 3) > 0) {
            return;
        }

        $usage->delete();
    }

    private function quantityAllocatedToUsage(int $usageId): string
    {
        $sum = DeliveryNoteLine::query()
            ->join('delivery_notes as dn', 'delivery_note_lines.delivery_note_id', '=', 'dn.id')
            ->where('delivery_note_lines.corte_bobina_usage_id', $usageId)
            ->where('dn.status', '!=', DeliveryNoteStatus::Cancelled->value)
            ->sum('delivery_note_lines.quantity_kg');

        return number_format((float) $sum, 3, '.', '');
    }
}
