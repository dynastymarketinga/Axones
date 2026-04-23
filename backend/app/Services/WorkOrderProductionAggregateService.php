<?php

namespace App\Services;

use App\Models\WorkOrder;
use Illuminate\Support\Arr;

class WorkOrderProductionAggregateService
{
    public function __construct(
        private readonly PrintingProductionService $printing,
        private readonly CorteProductionService $corte,
        private readonly LaminacionProductionService $laminacion,
        private readonly MontajeProductionService $montaje,
        private readonly InventoryReportService $inventoryReports,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function fullProductionState(WorkOrder $workOrder): array
    {
        $workOrder->loadMissing(['client', 'product', 'clientOrder']);

        $inv = $this->inventoryReports->workOrderMaterialSummary((int) $workOrder->getKey());
        $printing = $this->printing->getPrintingState($workOrder);
        $corte = $this->corte->getCorteState($workOrder);
        $laminacion = $this->laminacion->getLaminacionState($workOrder);
        $montaje = $this->montaje->getMontajeState($workOrder);

        return [
            'work_order' => $workOrder,
            'inventory_and_dispatch' => Arr::only($inv, [
                'dispatch_by_material',
                'printing_bobina_usages',
                'corte_bobina_usages',
                'laminacion_bobina_usages',
                'montaje_material_usages',
                'inventory_returns',
            ]),
            'printing' => Arr::except($printing, ['work_order']),
            'corte' => Arr::except($corte, ['work_order']),
            'laminacion' => Arr::except($laminacion, ['work_order']),
            'montaje' => Arr::except($montaje, ['work_order']),
        ];
    }
}
