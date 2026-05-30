<?php

namespace App\Services;

use App\Enums\AreaRequestStatus;
use App\Enums\WorkOrderPriority;
use App\Models\AreaRequest;
use App\Models\User;
use App\Models\WorkOrder;

class ProductionNotificationService
{
    /** Áreas que reciben despacho simultáneo de OT (sin secuencia obligatoria). */
    public const PRODUCTIVE_AREAS = ['montaje', 'impresion', 'laminacion', 'corte', 'tintas'];

    public function __construct(
        private readonly AreaRequestService $areaRequests,
    ) {}

    /**
     * Al crear una OT, la distribuye de inmediato a las áreas productivas para visibilidad por rol.
     * Las alertas operativas (/alertas) solo cubren desperdicio y escasez de material; aquí solo solicitudes de área.
     */
    public function notifyOnWorkOrderCreated(WorkOrder $workOrder, ?User $user): array
    {
        $summary = [
            'event' => 'work_order_created',
            'work_order_id' => $workOrder->getKey(),
            'origin_area' => 'planificacion',
            'sent_to' => [],
            'skipped' => [],
            'errors' => [],
            'areas' => [],
        ];

        foreach (self::PRODUCTIVE_AREAS as $targetArea) {
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

            $areaRequestStatus = 'existing';
            if (! $alreadyPending) {
                $this->areaRequests->supersedePendingWorkOrderCoordination(
                    (int) $workOrder->getKey(),
                    $targetArea,
                );
                AreaRequest::query()->create([
                    'area' => $targetArea,
                    'title' => $title,
                    'body' => $body,
                    'status' => AreaRequestStatus::Pending->value,
                    'work_order_id' => $workOrder->getKey(),
                    'requested_by' => $user?->getKey(),
                ]);
                $areaRequestStatus = 'created';
            }

            $status = $areaRequestStatus === 'created' ? 'sent' : 'skipped';
            if ($status === 'sent') {
                $summary['sent_to'][] = $targetArea;
            } else {
                $summary['skipped'][] = $targetArea;
            }
            $summary['areas'][] = [
                'area' => $targetArea,
                'status' => $status,
                'area_request' => $areaRequestStatus,
            ];
        }

        return $summary;
    }

    /**
     * Tras guardar la planilla OT (orden de trabajo): avisa a todas las áreas en paralelo vía solicitudes de área.
     * Idempotente por huella de guardado (p. ej. updated_at del documento técnico).
     */
    public function notifyOnWorkOrderSavedBroadcast(WorkOrder $workOrder, ?User $user, string $saveFingerprint): array
    {
        $summary = [
            'event' => 'work_order_saved_broadcast',
            'work_order_id' => $workOrder->getKey(),
            'origin_area' => 'orden_trabajo',
            'save_fingerprint' => $saveFingerprint,
            'sent_to' => [],
            'skipped' => [],
            'errors' => [],
            'areas' => [],
        ];

        foreach (self::PRODUCTIVE_AREAS as $targetArea) {
            $title = sprintf('OT %s — orden guardada', $workOrder->code);
            $body = sprintf(
                'Se guardó la orden de trabajo de la OT %s. Revise en %s.',
                $workOrder->code,
                ucfirst($targetArea),
            );

            $alreadyPending = AreaRequest::query()
                ->where('work_order_id', $workOrder->getKey())
                ->where('area', $targetArea)
                ->where('status', AreaRequestStatus::Pending->value)
                ->where('title', $title)
                ->exists();

            $areaRequestStatus = 'existing';
            if (! $alreadyPending) {
                $this->areaRequests->supersedePendingWorkOrderCoordination(
                    (int) $workOrder->getKey(),
                    $targetArea,
                );
                AreaRequest::query()->create([
                    'area' => $targetArea,
                    'title' => $title,
                    'body' => $body,
                    'status' => AreaRequestStatus::Pending->value,
                    'work_order_id' => $workOrder->getKey(),
                    'requested_by' => $user?->getKey(),
                ]);
                $areaRequestStatus = 'created';
            }

            $summary['sent_to'][] = $targetArea;
            $summary['areas'][] = [
                'area' => $targetArea,
                'status' => 'sent',
                'area_request' => $areaRequestStatus,
            ];
        }

        return $summary;
    }

    /**
     * Dispara avisos inter-área al guardar producción (solo solicitudes de área; sin alertas operativas).
     * El avance de tablero (board_stage) no se fuerza aquí; queda manual/editable.
     */
    public function notifyOnProductionSave(WorkOrder $workOrder, ?User $user, string $originArea): array
    {
        $origin = strtolower(trim($originArea));
        $summary = [
            'event' => 'production_saved',
            'work_order_id' => $workOrder->getKey(),
            'origin_area' => $origin,
            'sent_to' => [],
            'skipped' => [],
            'errors' => [],
            'areas' => [],
        ];

        if (! in_array($origin, self::PRODUCTIVE_AREAS, true)) {
            $summary['errors'][] = sprintf('origin_area_invalid:%s', $originArea);

            return $summary;
        }

        foreach (self::PRODUCTIVE_AREAS as $targetArea) {
            if ($targetArea === $origin) {
                continue;
            }

            $title = sprintf('OT %s actualizada por %s', $workOrder->code, ucfirst($origin));
            $body = sprintf(
                'Nueva actualización de producción de la OT %s. Revisar en módulo de %s.',
                $workOrder->code,
                ucfirst($targetArea),
            );

            $alreadyPending = AreaRequest::query()
                ->where('work_order_id', $workOrder->getKey())
                ->where('area', $targetArea)
                ->where('status', AreaRequestStatus::Pending->value)
                ->where('title', $title)
                ->exists();

            $areaRequestStatus = 'existing';
            if (! $alreadyPending) {
                $this->areaRequests->supersedePendingWorkOrderCoordination(
                    (int) $workOrder->getKey(),
                    $targetArea,
                );
                AreaRequest::query()->create([
                    'area' => $targetArea,
                    'title' => $title,
                    'body' => $body,
                    'status' => AreaRequestStatus::Pending->value,
                    'work_order_id' => $workOrder->getKey(),
                    'requested_by' => $user?->getKey(),
                ]);
                $areaRequestStatus = 'created';
            }

            $summary['sent_to'][] = $targetArea;
            $summary['areas'][] = [
                'area' => $targetArea,
                'status' => 'sent',
                'area_request' => $areaRequestStatus,
            ];
        }

        $summary['sent_to'][] = $origin;
        $summary['areas'][] = [
            'area' => $origin,
            'status' => 'sent',
            'area_request' => 'not_applicable',
            'note' => 'production_saved_self',
        ];

        return $summary;
    }

    /**
     * Asignación dirigida: solicitudes pendientes por área con motivo (sin alertas operativas).
     *
     * @param  list<string>  $areas  Valores en minúsculas: impresion, laminacion, corte, tintas
     * @return array{event: string, work_order_id: int, priority: string, sent_to: list<string>, skipped: list<string>, errors: list<string>, areas: list<array<string, mixed>>}
     */
    public function notifyAssignedAreasWithReason(
        WorkOrder $workOrder,
        ?User $user,
        array $areas,
        string $reason,
        string $priority,
    ): array {
        $summary = [
            'event' => 'work_order_area_assignment',
            'work_order_id' => $workOrder->getKey(),
            'priority' => strtolower(trim($priority)) ?: WorkOrderPriority::Normal->value,
            'sent_to' => [],
            'skipped' => [],
            'errors' => [],
            'areas' => [],
        ];

        $reason = trim($reason);
        if ($reason === '') {
            $reason = 'Asignación sin motivo.';
        }

        $seen = [];
        foreach ($areas as $raw) {
            $targetArea = strtolower(trim((string) $raw));
            if ($targetArea === '' || ! in_array($targetArea, self::PRODUCTIVE_AREAS, true)) {
                continue;
            }
            if (isset($seen[$targetArea])) {
                continue;
            }
            $seen[$targetArea] = true;

            $title = sprintf('OT %s — asignada a %s', $workOrder->code, ucfirst($targetArea));

            $alreadyPending = AreaRequest::query()
                ->where('work_order_id', $workOrder->getKey())
                ->where('area', $targetArea)
                ->where('status', AreaRequestStatus::Pending->value)
                ->where('title', $title)
                ->exists();

            $areaRequestStatus = 'existing';
            if (! $alreadyPending) {
                $this->areaRequests->supersedePendingWorkOrderCoordination(
                    (int) $workOrder->getKey(),
                    $targetArea,
                );
                AreaRequest::query()->create([
                    'area' => $targetArea,
                    'title' => $title,
                    'body' => $reason,
                    'status' => AreaRequestStatus::Pending->value,
                    'work_order_id' => $workOrder->getKey(),
                    'requested_by' => $user?->getKey(),
                ]);
                $areaRequestStatus = 'created';
            } else {
                AreaRequest::query()
                    ->where('work_order_id', $workOrder->getKey())
                    ->where('area', $targetArea)
                    ->where('status', AreaRequestStatus::Pending->value)
                    ->where('title', $title)
                    ->update(['body' => $reason]);
                $areaRequestStatus = 'updated';
            }

            $summary['sent_to'][] = $targetArea;
            $summary['areas'][] = [
                'area' => $targetArea,
                'status' => 'sent',
                'area_request' => $areaRequestStatus,
            ];
        }

        return $summary;
    }
}
