<?php

namespace App\Services;

use App\Models\User;
use App\Models\WorkOrder;
use App\Support\PlanillaSustratoFormLines;

class PlanillaSustratoShortageAlertService
{
    public function __construct(
        private readonly OperationalAlertService $alerts,
    ) {}

    /**
     * Registra escasez de sustratos virgen (planilla OT) en /alertas para jefatura.
     *
     * @param  array<string, mixed>  $form
     */
    public function evaluateFromPlanillaForm(WorkOrder $workOrder, array $form, ?User $user = null): void
    {
        foreach (PlanillaSustratoFormLines::catalogMaterialLines($form) as $line) {
            $this->alerts->recordOtMaterialShortageLine(
                $workOrder,
                $user,
                (int) $line['material_id'],
                (string) $line['quantity_requested'],
                (string) $line['area_label'],
                (string) $line['originating_area'],
                'planilla',
            );
        }
    }
}
