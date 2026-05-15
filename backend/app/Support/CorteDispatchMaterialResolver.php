<?php

namespace App\Support;

use App\Models\CorteBobinaUsage;
use App\Models\WorkOrder;
use App\Models\WorkOrderLine;

final class CorteDispatchMaterialResolver
{
    public static function resolveForWorkOrder(WorkOrder $workOrder): ?int
    {
        $fromLine = WorkOrderLine::query()
            ->where('work_order_id', $workOrder->getKey())
            ->whereNotNull('material_id')
            ->orderBy('id')
            ->value('material_id');

        if ($fromLine !== null) {
            return (int) $fromLine;
        }

        $fromUsage = CorteBobinaUsage::query()
            ->where('work_order_id', $workOrder->getKey())
            ->whereNotNull('material_id')
            ->orderByDesc('id')
            ->value('material_id');

        return $fromUsage !== null ? (int) $fromUsage : null;
    }
}
