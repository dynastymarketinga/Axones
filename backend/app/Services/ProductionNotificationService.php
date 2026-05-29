<?php

namespace App\Services;

use App\Enums\AlertSeverity;
use App\Enums\AreaRequestStatus;
use App\Enums\WorkOrderPriority;
use App\Models\AreaRequest;
use App\Models\OperationalAlert;
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

            $alertExists = OperationalAlert::query()
                ->where('work_order_id', $workOrder->getKey())
                ->where('alert_type', 'work_order_created')
                ->where('metadata->target_area', $targetArea)
                ->exists();

            $alertStatus = 'duplicate';
            if (! $alertExists) {
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
                $alertStatus = 'created';
            }

            $status = $alertStatus === 'created' || $areaRequestStatus === 'created'
                ? 'sent'
                : 'skipped';
            if ($status === 'sent') {
                $summary['sent_to'][] = $targetArea;
            } else {
                $summary['skipped'][] = $targetArea;
            }
            $summary['areas'][] = [
                'area' => $targetArea,
                'status' => $status,
                'area_request' => $areaRequestStatus,
                'alert' => $alertStatus,
            ];
        }

        return $summary;
    }

    /**
     * Tras guardar la planilla OT (orden de trabajo): avisa a todas las áreas en paralelo.
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
            $dupAlert = OperationalAlert::query()
                ->where('work_order_id', $workOrder->getKey())
                ->where('alert_type', 'work_order_saved_broadcast')
                ->where('metadata->save_fingerprint', $saveFingerprint)
                ->where('metadata->target_area', $targetArea)
                ->exists();

            if ($dupAlert) {
                $summary['skipped'][] = $targetArea;
                $summary['areas'][] = [
                    'area' => $targetArea,
                    'status' => 'skipped',
                    'area_request' => 'not_evaluated',
                    'alert' => 'duplicate',
                ];

                continue;
            }

            $title = sprintf('OT %s — orden guardada', $workOrder->code);
            $body = sprintf(
                'Se guardó la orden de trabajo de la OT %s. Revise en %s.',
                $workOrder->code,
                ucfirst($targetArea),
            );

            // Este bloque verifica si ya existe una solicitud pendiente (AreaRequest) para este área y esta OT con el mismo título.
            // AreaRequest es una tabla que gestiona solicitudes inter-área sobre una orden de trabajo.
            // La consulta chequea:
            // - La orden de trabajo específica ($workOrder->getKey())
            // - El área destino ($targetArea)
            // - El estado 'Pending' (pendiente)
            // - El título que corresponde a este evento/tipo de notificación
            // Si ya existe (exists() devuelve true), se omite la creación para evitar duplicados.
            $alreadyPending = AreaRequest::query()
                ->where('work_order_id', $workOrder->getKey())
                ->where('area', $targetArea)
                ->where('status', AreaRequestStatus::Pending->value)
                ->where('title', $title)
                ->exists();

            // Si NO existe ya una solicitud pendiente para este área y título, crea un nuevo registro AreaRequest como pendiente
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

            OperationalAlert::query()->create([
                'alert_type' => 'work_order_saved_broadcast',
                'severity' => AlertSeverity::Info->value,
                'message' => sprintf(
                    'OT %s: orden de trabajo guardada (aviso para %s).',
                    $workOrder->code,
                    ucfirst($targetArea),
                ),
                'work_order_id' => $workOrder->getKey(),
                'material_id' => null,
                'metadata' => [
                    'origin_area' => 'orden_trabajo',
                    'target_area' => $targetArea,
                    'channel' => 'bell',
                    'save_fingerprint' => $saveFingerprint,
                ],
                'created_by' => $user?->getKey(),
            ]);

            $summary['sent_to'][] = $targetArea;
            $summary['areas'][] = [
                'area' => $targetArea,
                'status' => 'sent',
                'area_request' => $areaRequestStatus,
                'alert' => 'created',
            ];
        }

        return $summary;
    }

    /**
     * Dispara avisos inter-área al guardar producción.
     * - Tabla: crea solicitudes por área (area_requests)
     * - Campana: crea alertas operativas (operational_alerts)
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

            $summary['sent_to'][] = $targetArea;
            $summary['areas'][] = [
                'area' => $targetArea,
                'status' => 'sent',
                'area_request' => $areaRequestStatus,
                'alert' => 'created',
            ];
        }

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

        $summary['sent_to'][] = $origin;
        $summary['areas'][] = [
            'area' => $origin,
            'status' => 'sent',
            'area_request' => 'not_applicable',
            'alert' => 'created',
            'note' => 'production_saved_self',
        ];

        return $summary;
    }

    /**
     * Asignación dirigida: solicitudes pendientes por área con motivo y alertas según prioridad.
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

        $p = strtolower(trim($priority));
        $severity = match ($p) {
            WorkOrderPriority::Alta->value => AlertSeverity::Warning,
            WorkOrderPriority::Urgente->value => AlertSeverity::Critical,
            default => AlertSeverity::Info,
        };

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

            OperationalAlert::query()->create([
                'alert_type' => 'work_order_area_assignment',
                'severity' => $severity->value,
                'message' => sprintf(
                    'OT %s asignada a %s (%s).',
                    $workOrder->code,
                    ucfirst($targetArea),
                    ucfirst($summary['priority']),
                ),
                'work_order_id' => $workOrder->getKey(),
                'material_id' => null,
                'metadata' => [
                    'origin_area' => 'orden_trabajo',
                    'target_area' => $targetArea,
                    'channel' => 'bell',
                    'priority' => $summary['priority'],
                    'reason' => $reason,
                ],
                'created_by' => $user?->getKey(),
            ]);

            $summary['sent_to'][] = $targetArea;
            $summary['areas'][] = [
                'area' => $targetArea,
                'status' => 'sent',
                'area_request' => $areaRequestStatus,
                'alert' => 'created',
            ];
        }

        return $summary;
    }
}
