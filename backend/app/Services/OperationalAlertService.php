<?php

namespace App\Services;

use App\Enums\AlertSeverity;
use App\Enums\OperationalAlertType;
use App\Enums\PrintingTimeSegmentType;
use App\Models\Material;
use App\Models\OperationalAlert;
use App\Models\CorteTimeSegment;
use App\Models\LaminacionTimeSegment;
use App\Models\MontajeTimeSegment;
use App\Models\PrintingTimeSegment;
use App\Models\User;
use App\Models\WorkOrder;

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
            /** @var Material|null $material */
            $material = Material::query()->find($materialId);
            if (! $material) {
                continue;
            }
            $qoh = (string) $material->quantity_on_hand;
            if (bccomp($qoh, $qtyRequested, 3) >= 0) {
                continue;
            }

            OperationalAlert::query()->create([
                'alert_type' => OperationalAlertType::OtMaterialShortage->value,
                'severity' => AlertSeverity::Critical->value,
                'message' => sprintf(
                    'Stock insuficiente para %s (%s) en OT %s: hay %s %s, la línea pide %s %s.',
                    $material->sku,
                    $material->name,
                    $workOrder->code,
                    $qoh,
                    $material->unit,
                    $qtyRequested,
                    $material->unit,
                ),
                'work_order_id' => $workOrder->getKey(),
                'material_id' => $material->getKey(),
                'metadata' => [
                    'quantity_on_hand' => $qoh,
                    'quantity_requested' => $qtyRequested,
                ],
                'created_by' => $user?->getKey(),
            ]);
        }
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
