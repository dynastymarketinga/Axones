<?php

namespace App\Services;

use App\Enums\DeliveryNoteStatus;
use App\Models\CorteBobinaUsage;
use App\Models\DeliveryNoteLine;
use App\Models\WorkOrder;
use App\Support\CorteDispatchMaterialResolver;
use App\Support\CortePlanillaSalida;
use Illuminate\Validation\ValidationException;

class CortePlanillaDispatchSyncService
{
    public const PLANILLA_NOTES = 'auto:planilla';

    /**
     * Sincroniza kg terminados de la planilla hacia corte_bobina_usages (despacho).
     *
     * @param  array<string, mixed>  $form
     */
    public function syncFromForm(WorkOrder $workOrder, array $form): void
    {
        $materialId = CorteDispatchMaterialResolver::resolveForWorkOrder($workOrder);

        if ($materialId === null) {
            return;
        }

        $finishedKg = CortePlanillaSalida::finishedKgFromForm($form);
        $usedKg = CortePlanillaSalida::usedKgFromForm($form);

        $usage = CorteBobinaUsage::query()
            ->where('work_order_id', $workOrder->getKey())
            ->whereNull('bobina_id')
            ->where('notes', self::PLANILLA_NOTES)
            ->orderByDesc('id')
            ->first();

        $allocated = $this->quantityAllocatedToWorkOrder((int) $workOrder->getKey());

        if (bccomp($finishedKg, $allocated, 3) < 0) {
            throw ValidationException::withMessages([
                'form.kgSalidaCorte' => [
                    sprintf(
                        'No se puede reducir el material terminado por debajo de lo ya asignado en notas de entrega (%s kg).',
                        $allocated,
                    ),
                ],
            ]);
        }

        if ($usage === null) {
            if (bccomp($finishedKg, '0', 3) <= 0) {
                return;
            }

            CorteBobinaUsage::query()->create([
                'work_order_id' => $workOrder->getKey(),
                'bobina_id' => null,
                'material_id' => $materialId,
                'quantity_used_kg' => $usedKg,
                'quantity_finished_kg' => $finishedKg,
                'notes' => self::PLANILLA_NOTES,
            ]);

            return;
        }

        $usage->update([
            'material_id' => $materialId,
            'quantity_used_kg' => $usedKg,
            'quantity_finished_kg' => $finishedKg,
        ]);
    }

    private function quantityAllocatedToWorkOrder(int $workOrderId): string
    {
        $sum = DeliveryNoteLine::query()
            ->join('delivery_notes as dn', 'delivery_note_lines.delivery_note_id', '=', 'dn.id')
            ->where('delivery_note_lines.work_order_id', $workOrderId)
            ->where('dn.status', '!=', DeliveryNoteStatus::Cancelled->value)
            ->sum('delivery_note_lines.quantity_kg');

        return number_format((float) $sum, 3, '.', '');
    }
}
