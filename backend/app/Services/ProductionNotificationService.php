<?php

namespace App\Services;

use App\Enums\AlertSeverity;
use App\Enums\AreaRequestStatus;
use App\Enums\WorkOrderBoardStage;
use App\Models\AreaRequest;
use App\Models\OperationalAlert;
use App\Models\User;
use App\Models\WorkOrder;

class ProductionNotificationService
{
    /**
     * Al crear una OT, la distribuye de inmediato a las áreas productivas para visibilidad por rol.
     */
    public function notifyOnWorkOrderCreated(WorkOrder $workOrder, ?User $user): void
    {
        $targetAreas = ['impresion', 'laminacion', 'corte'];

        foreach ($targetAreas as $targetArea) {
            $title = sprintf('OT %s creada', $workOrder->code);
            $body = sprintf(
                'Nueva OT %s creada en planificación. Revise y programe en %s.',
                $workOrder->code,
                ucfirst($targetArea),
            );

            $alreadyPending = AreaRequest::query()
                ->where('work_order_id', $workOrder->getKey())
                ->where('area', $targetArea)
                ->where('status', AreaRequestStatus::Pending->value)
                ->where('title', $title)
                ->exists();

            if (! $alreadyPending) {
                AreaRequest::query()->create([
                    'area' => $targetArea,
                    'title' => $title,
                    'body' => $body,
                    'status' => AreaRequestStatus::Pending->value,
                    'work_order_id' => $workOrder->getKey(),
                    'requested_by' => $user?->getKey(),
                ]);
            }

            OperationalAlert::query()->create([
                'alert_type' => 'work_order_created',
                'severity' => AlertSeverity::Info->value,
                'message' => sprintf(
                    'OT %s creada y asignada a %s.',
                    $workOrder->code,
                    ucfirst($targetArea),
                ),
                'work_order_id' => $workOrder->getKey(),
                'material_id' => null,
                'metadata' => [
                    'origin_area' => 'planificacion',
                    'target_area' => $targetArea,
                    'channel' => 'bell',
                ],
                'created_by' => $user?->getKey(),
            ]);
        }
    }

    /**
     * Dispara avisos inter-área al guardar producción.
     * - Tabla: crea solicitudes por área (area_requests)
     * - Campana: crea alertas operativas (operational_alerts)
     * - Bandera: mueve tablero al siguiente stage según origen
     */
    public function notifyOnProductionSave(WorkOrder $workOrder, ?User $user, string $originArea): void
    {
        $origin = strtolower(trim($originArea));
        if (! in_array($origin, ['impresion', 'laminacion', 'corte'], true)) {
            return;
        }

        $targetAreas = ['impresion', 'laminacion', 'corte'];
        foreach ($targetAreas as $targetArea) {
            if ($targetArea === $origin) {
                continue;
            }

            $title = sprintf('OT %s actualizada por %s', $workOrder->code, ucfirst($origin));
            $body = sprintf(
                'Nueva actualización de producción de la OT %s. Revisar en módulo de %s.',
                $workOrder->code,
                ucfirst($targetArea),
            );

            // 1) Tabla de solicitudes por área
            $alreadyPending = AreaRequest::query()
                ->where('work_order_id', $workOrder->getKey())
                ->where('area', $targetArea)
                ->where('status', AreaRequestStatus::Pending->value)
                ->where('title', $title)
                ->exists();

            if (! $alreadyPending) {
                AreaRequest::query()->create([
                    'area' => $targetArea,
                    'title' => $title,
                    'body' => $body,
                    'status' => AreaRequestStatus::Pending->value,
                    'work_order_id' => $workOrder->getKey(),
                    'requested_by' => $user?->getKey(),
                ]);
            }

            // 2) Campana / alerta operativa
            OperationalAlert::query()->create([
                'alert_type' => 'production_handoff',
                'severity' => AlertSeverity::Info->value,
                'message' => sprintf(
                    'OT %s: %s guardó producción. Aviso para %s.',
                    $workOrder->code,
                    ucfirst($origin),
                    ucfirst($targetArea),
                ),
                'work_order_id' => $workOrder->getKey(),
                'material_id' => null,
                'metadata' => [
                    'origin_area' => $origin,
                    'target_area' => $targetArea,
                    'channel' => 'bell',
                ],
                'created_by' => $user?->getKey(),
            ]);
        }

        // Confirmación en el mismo área (campana visible para quien guardó / su rol)
        OperationalAlert::query()->create([
            'alert_type' => 'production_saved',
            'severity' => AlertSeverity::Info->value,
            'message' => sprintf(
                'OT %s: producción guardada en %s. Otras áreas fueron notificadas.',
                $workOrder->code,
                ucfirst($origin),
            ),
            'work_order_id' => $workOrder->getKey(),
            'material_id' => null,
            'metadata' => [
                'origin_area' => $origin,
                'target_area' => $origin,
                'channel' => 'bell',
            ],
            'created_by' => $user?->getKey(),
        ]);

        // 3) Bandera de entrada por tablero
        $nextStage = match ($origin) {
            'impresion' => WorkOrderBoardStage::Laminacion,
            'laminacion' => WorkOrderBoardStage::Corte,
            'corte' => WorkOrderBoardStage::Completada,
            default => null,
        };

        if ($nextStage !== null && $workOrder->board_stage !== $nextStage) {
            $workOrder->forceFill([
                'board_stage' => $nextStage->value,
            ])->save();
        }
    }
}
