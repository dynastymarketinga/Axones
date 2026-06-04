<?php

namespace App\Services;

use App\Enums\AlertSeverity;
use App\Enums\OperationalAlertType;
use App\Enums\PrintingTimeSegmentType;
use App\Models\Material;
use App\Models\MaterialRequest;
use App\Models\OperationalAlert;
use App\Services\PlanillaSustratoMaterialRequestSyncService;
use App\Models\CorteTimeSegment;
use App\Models\LaminacionTimeSegment;
use App\Models\MontajeTimeSegment;
use App\Models\PrintingTimeSegment;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Support\Str;

class OperationalAlertService
{
    /**
     * Al crear una OT con líneas: avisar si el stock actual no alcanza lo pedido (PDF §6).
     *
     * @param  list<array{material_id: int, quantity: string|float}>  $linesInput
     */
    public function recordOtMaterialShortages(WorkOrder $workOrder, ?User $user, array $linesInput): void
    {
        foreach ($linesInput as $line) {
            $materialId = (int) $line['material_id'];
            $qtyRequested = (string) $line['quantity'];
            $this->recordOtMaterialShortageLine(
                $workOrder,
                $user,
                $materialId,
                $qtyRequested,
                null,
                null,
                'ot_lines',
            );
        }
    }

    /**
     * Escasez de material en OT (líneas de consumo o sustratos virgen en planilla).
     */
    public function recordOtMaterialShortageLine(
        ?WorkOrder $workOrder,
        ?User $user,
        int $materialId,
        string $qtyRequested,
        ?string $areaLabel = null,
        ?string $originatingArea = null,
        string $source = 'ot_lines',
        ?int $clientOrderId = null,
    ): void {
        /** @var Material|null $material */
        $material = Material::query()->find($materialId);
        if (! $material) {
            return;
        }

        $clientOrderId = $clientOrderId ?? ($workOrder?->client_order_id ? (int) $workOrder->client_order_id : null);

        $qoh = (string) $material->quantity_on_hand;
        if (bccomp($qoh, $qtyRequested, 3) >= 0) {
            return;
        }

        if ($workOrder === null && $clientOrderId === null) {
            return;
        }

        $areaSuffix = $areaLabel !== null && $areaLabel !== ''
            ? sprintf(' (%s)', $areaLabel)
            : '';

        $otRef = $workOrder !== null
            ? $workOrder->code
            : sprintf('borrador pedido cliente #%d', $clientOrderId);

        $message = sprintf(
            'Stock insuficiente para %s (%s) en OT %s%s: hay %s %s, se piden %s %s.',
            $material->sku,
            $material->name,
            $otRef,
            $areaSuffix,
            $qoh,
            $material->unit,
            $qtyRequested,
            $material->unit,
        );

        $metadata = [
            'quantity_on_hand' => $qoh,
            'quantity_requested' => $qtyRequested,
            'source' => $source,
        ];
        if ($areaLabel !== null && $areaLabel !== '') {
            $metadata['area_label'] = $areaLabel;
        }
        if ($originatingArea !== null && $originatingArea !== '') {
            $metadata['target_area'] = $originatingArea;
        }
        if ($clientOrderId !== null) {
            $metadata['client_order_id'] = $clientOrderId;
        }

        $existingUnreadQuery = OperationalAlert::query()
            ->where('alert_type', OperationalAlertType::OtMaterialShortage->value)
            ->where('material_id', $material->getKey())
            ->whereNull('acknowledged_at');

        if ($workOrder !== null) {
            $existingUnreadQuery->where('work_order_id', $workOrder->getKey());
        } elseif ($clientOrderId !== null) {
            $existingUnreadQuery
                ->whereNull('work_order_id')
                ->where('metadata->client_order_id', $clientOrderId);
        }

        /** @var OperationalAlert|null $existingUnread */
        $existingUnread = $existingUnreadQuery->first();

        if ($existingUnread !== null) {
            $payload = [
                'message' => $message,
                'metadata' => $metadata,
            ];
            if ($workOrder !== null && $existingUnread->work_order_id === null) {
                $payload['work_order_id'] = $workOrder->getKey();
            }
            $existingUnread->update($payload);

            return;
        }

        if ($workOrder !== null && $clientOrderId !== null) {
            $draftAlert = OperationalAlert::query()
                ->where('alert_type', OperationalAlertType::OtMaterialShortage->value)
                ->where('material_id', $material->getKey())
                ->whereNull('work_order_id')
                ->whereNull('acknowledged_at')
                ->where('metadata->client_order_id', $clientOrderId)
                ->first();

            if ($draftAlert !== null) {
                $draftAlert->update([
                    'work_order_id' => $workOrder->getKey(),
                    'message' => $message,
                    'metadata' => $metadata,
                ]);

                return;
            }
        }

        OperationalAlert::query()->create([
            'alert_type' => OperationalAlertType::OtMaterialShortage->value,
            'severity' => AlertSeverity::Critical->value,
            'message' => $message,
            'work_order_id' => $workOrder?->getKey(),
            'material_id' => $material->getKey(),
            'metadata' => $metadata,
            'created_by' => $user?->getKey(),
        ]);
    }

    /**
     * Tras movimiento de inventario: avisar si la existencia queda bajo el mínimo.
     */
    public function evaluateMaterialLowStock(Material $material, ?User $user = null): void
    {
        $qoh = (string) $material->quantity_on_hand;
        $min = (string) $material->min_stock;

        if (bccomp($min, '0', 3) <= 0) {
            return;
        }

        if (bccomp($qoh, $min, 3) >= 0) {
            return;
        }

        $alreadyUnread = OperationalAlert::query()
            ->where('alert_type', OperationalAlertType::MaterialLowStock->value)
            ->where('material_id', $material->getKey())
            ->whereNull('acknowledged_at')
            ->exists();

        if ($alreadyUnread) {
            return;
        }

        OperationalAlert::query()->create([
            'alert_type' => OperationalAlertType::MaterialLowStock->value,
            'severity' => bccomp($qoh, '0', 3) <= 0
                ? AlertSeverity::Critical->value
                : AlertSeverity::Warning->value,
            'message' => sprintf(
                'Stock bajo: %s (%s) tiene %s %s; mínimo %s %s.',
                $material->sku,
                $material->name,
                $qoh,
                $material->unit,
                $min,
                $material->unit,
            ),
            'work_order_id' => null,
            'material_id' => $material->getKey(),
            'metadata' => [
                'quantity_on_hand' => $qoh,
                'min_stock' => $min,
                'inventory_area' => $material->inventory_area,
            ],
            'created_by' => $user?->getKey(),
        ]);
    }

    public function evaluateClosedTimeSegment(PrintingTimeSegment $segment): void
    {
        if ($segment->ended_at === null || $segment->started_at === null) {
            return;
        }

        $duration = $segment->ended_at->getTimestamp() - $segment->started_at->getTimestamp();
        if ($duration < 0) {
            return;
        }

        $workOrder = $segment->workOrder;
        if (! $workOrder) {
            return;
        }

        $this->evaluateProductionTimeSegmentClosed(
            $workOrder,
            $segment->segment_type,
            $duration,
            [
                'printing_time_segment_id' => $segment->getKey(),
            ],
        );
    }

    /**
     * Igual que impresión, para el área de corte (PDF §3.F).
     */
    public function evaluateClosedCorteTimeSegment(CorteTimeSegment $segment): void
    {
        if ($segment->ended_at === null || $segment->started_at === null) {
            return;
        }

        $duration = $segment->ended_at->getTimestamp() - $segment->started_at->getTimestamp();
        if ($duration < 0) {
            return;
        }

        $workOrder = $segment->workOrder;
        if (! $workOrder) {
            return;
        }

        $this->evaluateProductionTimeSegmentClosed(
            $workOrder,
            $segment->segment_type,
            $duration,
            [
                'corte_time_segment_id' => $segment->getKey(),
            ],
        );
    }

    /**
     * Igual que corte, para laminación (PDF §3.E).
     */
    public function evaluateClosedLaminacionTimeSegment(LaminacionTimeSegment $segment): void
    {
        if ($segment->ended_at === null || $segment->started_at === null) {
            return;
        }

        $duration = $segment->ended_at->getTimestamp() - $segment->started_at->getTimestamp();
        if ($duration < 0) {
            return;
        }

        $workOrder = $segment->workOrder;
        if (! $workOrder) {
            return;
        }

        $this->evaluateProductionTimeSegmentClosed(
            $workOrder,
            $segment->segment_type,
            $duration,
            [
                'laminacion_time_segment_id' => $segment->getKey(),
            ],
        );
    }

    public function evaluateClosedMontajeTimeSegment(MontajeTimeSegment $segment): void
    {
        if ($segment->ended_at === null || $segment->started_at === null) {
            return;
        }

        $duration = $segment->ended_at->getTimestamp() - $segment->started_at->getTimestamp();
        if ($duration < 0) {
            return;
        }

        $workOrder = $segment->workOrder;
        if (! $workOrder) {
            return;
        }

        $this->evaluateProductionTimeSegmentClosed(
            $workOrder,
            $segment->segment_type,
            $duration,
            [
                'montaje_time_segment_id' => $segment->getKey(),
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $segmentMetadata  Incluye el id de segmento (p. ej. printing_time_segment_id o corte_time_segment_id).
     */
    private function evaluateProductionTimeSegmentClosed(WorkOrder $workOrder, string $segmentType, int $duration, array $segmentMetadata): void
    {
        if ($segmentType === PrintingTimeSegmentType::Mount->value) {
            $threshold = (int) config('axones.alerts.mount_seconds_threshold', 3600);
            if ($duration >= $threshold) {
                $this->createTimeAlert(
                    OperationalAlertType::MountTimeExceeded,
                    AlertSeverity::Warning,
                    sprintf(
                        'Montaje superó %d min en OT %s (duración real: %d min).',
                        (int) ($threshold / 60),
                        $workOrder->code,
                        (int) round($duration / 60),
                    ),
                    $workOrder,
                    array_merge($segmentMetadata, [
                        'duration_seconds' => $duration,
                        'threshold_seconds' => $threshold,
                    ]),
                );
            }
        }

        if ($segmentType === PrintingTimeSegmentType::Downtime->value) {
            $threshold = (int) config('axones.alerts.downtime_seconds_threshold', 1800);
            if ($duration >= $threshold) {
                $this->createTimeAlert(
                    OperationalAlertType::DowntimeExceeded,
                    AlertSeverity::Warning,
                    sprintf(
                        'Tiempo muerto prolongado en OT %s: %d min (umbral: %d min).',
                        $workOrder->code,
                        (int) round($duration / 60),
                        (int) round($threshold / 60),
                    ),
                    $workOrder,
                    array_merge($segmentMetadata, [
                        'duration_seconds' => $duration,
                        'threshold_seconds' => $threshold,
                    ]),
                );
            }
        }
    }

    /**
     * Tras guardar % merma en impresión o corte (u otras áreas que reutilicen el umbral).
     */
    public function evaluateScrapPercent(WorkOrder $workOrder, mixed $scrapPercent, string $areaLabel = 'impresión'): void
    {
        if ($scrapPercent === null || $scrapPercent === '') {
            return;
        }

        $threshold = (string) config('axones.alerts.scrap_percent_threshold', 5);
        $scrap = is_string($scrapPercent) ? $scrapPercent : (string) $scrapPercent;

        if (bccomp($scrap, $threshold, 3) < 0) {
            return;
        }

        $message = sprintf(
            'Desperdicio elevado en %s (OT %s): %s%% (umbral %s%%).',
            $areaLabel,
            $workOrder->code,
            $scrap,
            $threshold,
        );

        $metadata = [
            'scrap_percent' => $scrap,
            'threshold_percent' => $threshold,
            'area' => $areaLabel,
        ];

        $existingUnread = OperationalAlert::query()
            ->where('work_order_id', $workOrder->getKey())
            ->where('alert_type', OperationalAlertType::ScrapThresholdExceeded->value)
            ->where('metadata->area', $areaLabel)
            ->whereNull('acknowledged_at')
            ->first();

        if ($existingUnread !== null) {
            $existingUnread->update([
                'message' => $message,
                'metadata' => $metadata,
            ]);

            return;
        }

        OperationalAlert::query()->create([
            'alert_type' => OperationalAlertType::ScrapThresholdExceeded->value,
            'severity' => AlertSeverity::Warning->value,
            'message' => $message,
            'work_order_id' => $workOrder->getKey(),
            'material_id' => null,
            'metadata' => $metadata,
            'created_by' => null,
        ]);
    }

    /**
     * Crea alertas de campana para solicitudes ya pendientes (p. ej. antes de activar notificaciones).
     */
    public function syncWarehouseAlertsForPendingMaterialRequests(): int
    {
        $created = 0;
        $pendingMrs = MaterialRequest::query()
            ->whereIn('status', ['pending', 'partial'])
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        foreach ($pendingMrs as $mr) {
            $before = OperationalAlert::query()
                ->where('alert_type', OperationalAlertType::MaterialRequestPendingWarehouse->value)
                ->whereNull('acknowledged_at')
                ->where('metadata->material_request_id', $mr->getKey())
                ->count();

            $this->recordMaterialRequestPendingForWarehouse($mr, null);

            $after = OperationalAlert::query()
                ->where('alert_type', OperationalAlertType::MaterialRequestPendingWarehouse->value)
                ->whereNull('acknowledged_at')
                ->where('metadata->material_request_id', $mr->getKey())
                ->count();

            if ($after > $before) {
                $created++;
            }
        }

        return $created;
    }

    /**
     * Campana / alertas: nueva solicitud de insumos o sustratos planilla OT pendiente de despacho.
     */
    public function recordMaterialRequestPendingForWarehouse(MaterialRequest $mr, ?User $user): void
    {
        if (! in_array($mr->status, ['pending', 'partial'], true)) {
            return;
        }

        $mr->loadMissing(['workOrder', 'lines.material']);

        $already = OperationalAlert::query()
            ->where('alert_type', OperationalAlertType::MaterialRequestPendingWarehouse->value)
            ->whereNull('acknowledged_at')
            ->where('metadata->material_request_id', $mr->getKey())
            ->exists();

        if ($already) {
            return;
        }

        $fromPlanilla = str_starts_with(
            trim((string) $mr->notes),
            PlanillaSustratoMaterialRequestSyncService::NOTES_MARKER,
        );

        $woCode = $mr->workOrder?->code;
        $otRef = $woCode !== null && $woCode !== ''
            ? $woCode
            : 'sin OT';

        $origin = $fromPlanilla
            ? 'sustratos virgen (planilla OT)'
            : 'solicitud de insumos';

        $lineSummary = $mr->lines
            ->map(function ($ln) {
                $sku = $ln->material?->sku;
                $name = $ln->material?->name ?? $ln->description;
                $qty = (string) $ln->quantity_requested;

                return trim(($sku ? $sku.' · ' : '').($name ?? '—').' · '.$qty);
            })
            ->filter()
            ->take(3)
            ->implode('; ');

        $message = sprintf(
            'Almacén: despacho pendiente (%s) · OT %s · solicitud #%d%s.',
            $origin,
            $otRef,
            $mr->getKey(),
            $lineSummary !== '' ? ' · '.$lineSummary : '',
        );

        OperationalAlert::query()->create([
            'alert_type' => OperationalAlertType::MaterialRequestPendingWarehouse->value,
            'severity' => AlertSeverity::Info->value,
            'message' => Str::limit($message, 500),
            'work_order_id' => $mr->work_order_id,
            'material_id' => $mr->lines->first()?->material_id,
            'metadata' => [
                'target_area' => 'inventario',
                'channel' => 'bell',
                'material_request_id' => $mr->getKey(),
                'from_planilla' => $fromPlanilla,
            ],
            'created_by' => $user?->getKey(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    private function createTimeAlert(
        OperationalAlertType $type,
        AlertSeverity $severity,
        string $message,
        WorkOrder $workOrder,
        array $metadata,
    ): void {
        OperationalAlert::query()->create([
            'alert_type' => $type->value,
            'severity' => $severity->value,
            'message' => $message,
            'work_order_id' => $workOrder->getKey(),
            'material_id' => null,
            'metadata' => $metadata,
            'created_by' => null,
        ]);
    }
}
