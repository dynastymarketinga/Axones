<?php

namespace App\Services;

use App\Models\WorkOrder;
use App\Support\PlanillaScrapPercent;

class PlanillaScrapAlertService
{
    private const AREA_LABELS = [
        'impresion' => 'impresión',
        'laminacion' => 'laminación',
        'corte' => 'corte',
        'montaje' => 'montaje',
    ];

    public function __construct(
        private readonly OperationalAlertService $alerts,
    ) {}

    /**
     * Evalúa % desperdicio desde planilla y crea alerta si supera el umbral (5% por defecto).
     *
     * @param  array<string, mixed>  $form
     * @param  list<string>|null  $onlyAreas  impresion, laminacion, corte, montaje
     */
    public function evaluateFromPlanillaForm(WorkOrder $workOrder, array $form, ?array $onlyAreas = null): void
    {
        $targets = $onlyAreas ?? array_keys(self::AREA_LABELS);

        foreach ($targets as $rawArea) {
            $area = strtolower(trim((string) $rawArea));
            if (! isset(self::AREA_LABELS[$area])) {
                continue;
            }

            $percent = PlanillaScrapPercent::forArea($form, $area);
            if ($percent === null) {
                continue;
            }

            $this->alerts->evaluateScrapPercent(
                $workOrder,
                $percent,
                self::AREA_LABELS[$area],
            );
        }
    }
}
