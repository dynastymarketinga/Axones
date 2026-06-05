<?php

namespace App\Support;

use App\Models\PrintingChemicalUsage;
use App\Models\PrintingInkControlLine;
use App\Models\WorkOrderTechnicalDocument;

/**
 * Agrega métricas de controles de producción (planilla JSON) para el resumen por OT.
 */
final class WorkOrderProductionControlsAggregator
{
    /**
     * Totales de material producido (salida impresión, laminación y corte) desde la planilla JSON.
     *
     * @param  array<string, mixed>|null  $form
     * @return array{
     *   impreso_kg: float,
     *   laminado_kg: float,
     *   corte_kg: float,
     *   impreso_bobinas: int,
     *   laminado_bobinas: int
     * }
     */
    public static function materialTotalsFromForm(?array $form): array
    {
        $printing = self::aggregatePrinting($form);
        $laminacion = self::aggregateLaminacion($form);
        $corte = self::aggregateCorte($form);

        return [
            'impreso_kg' => $printing['salida_kg'],
            'laminado_kg' => $laminacion['salida_kg'],
            'corte_kg' => $corte['salida_kg'],
            'impreso_bobinas' => $printing['salida_bobinas'],
            'laminado_bobinas' => $laminacion['salida_bobinas'],
        ];
    }

    /**
     * Desglose de kg de salida por referencia / sustrato (planilla).
     *
     * @param  array<string, mixed>|null  $form
     * @param  array<int, string>  $materialNames  material_id => name
     * @return array{
     *   impreso: list<array{label: string, kg: float, bobinas: int}>,
     *   laminado: list<array{label: string, kg: float, bobinas: int}>,
     *   cortado: list<array{label: string, kg: float, bobinas: int}>
     * }
     */
    public static function materialSalidaBreakdownFromForm(
        ?array $form,
        array $materialNames = [],
        ?string $productStructure = null,
        array $productSubstrateLabels = [],
        ?string $productFinishedLabel = null,
    ): array {
        return [
            'impreso' => self::formatBreakdownBuckets(
                self::breakdownPrintingSalidaBuckets($form, $materialNames, $productStructure, $productSubstrateLabels),
            ),
            'laminado' => self::formatBreakdownBuckets(
                self::breakdownLaminacionSalidaBuckets($form, $materialNames, $productStructure, $productSubstrateLabels),
            ),
            'cortado' => self::formatBreakdownBuckets(
                self::breakdownCorteSalidaBuckets($form, $materialNames, $productStructure, $productFinishedLabel),
            ),
        ];
    }

    /**
     * Consumibles agregados por OT (tintas, químicos laminación, entradas de material).
     *
     * @return array{
     *   tintas_original_kg: float,
     *   tintas_solventadas_kg: float,
     *   tintas_alcohol_kg: float,
     *   tintas_metoxil_kg: float,
     *   tintas_npa_kg: float,
     *   lam_adhesivo_sobra_kg: float,
     *   lam_catalizador_sobra_kg: float,
     *   lam_acetato_sobra_lt: float,
     *   lam_adhesivo_consumido_kg: float,
     *   lam_catalizador_consumido_kg: float,
     *   lam_acetato_consumido_lt: float,
     *   impresion_entrada_kg: float,
     *   laminacion_virgen_entrada_kg: float
     * }
     */
    public static function consumablesTotals(int $workOrderId): array
    {
        $form = self::loadForm($workOrderId);
        $printing = self::aggregatePrinting($form);
        $laminacion = self::aggregateLaminacion($form);
        $tintas = self::aggregateTintasRaw($workOrderId);
        $lamQ = self::aggregateLaminacionQuimicosRaw($form);

        return [
            'tintas_original_kg' => $tintas['original_kg'],
            'tintas_solventadas_kg' => $tintas['solventadas_kg'],
            'tintas_alcohol_kg' => $tintas['alcohol_kg'],
            'tintas_metoxil_kg' => $tintas['metoxil_kg'],
            'tintas_npa_kg' => $tintas['npa_kg'],
            'lam_adhesivo_sobra_kg' => $lamQ['adhesivo_sobra_kg'],
            'lam_catalizador_sobra_kg' => $lamQ['catalizador_sobra_kg'],
            'lam_acetato_sobra_lt' => $lamQ['acetato_sobra_lt'],
            'lam_adhesivo_consumido_kg' => $lamQ['adhesivo_consumido_kg'],
            'lam_catalizador_consumido_kg' => $lamQ['catalizador_consumido_kg'],
            'lam_acetato_consumido_lt' => $lamQ['acetato_consumido_lt'],
            'impresion_entrada_kg' => $printing['entrada_kg'],
            'laminacion_virgen_entrada_kg' => $laminacion['entrada_virgen_kg'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function summarize(int $workOrderId): array
    {
        $form = self::loadForm($workOrderId);

        $printing = self::aggregatePrinting($form);
        $laminacion = self::aggregateLaminacion($form);
        $corte = self::aggregateCorte($form);
        $scrap = self::aggregateScrap($form);
        $montaje = self::aggregateMontaje($form);
        $tintas = self::aggregateTintas($workOrderId);
        $lamQuimicos = self::aggregateLaminacionQuimicos($form);

        $corteSalidaKg = $corte['salida_kg'];
        $impresoKg = $printing['salida_kg'];
        $laminadoKg = $laminacion['salida_kg'];
        $totalGeneralKg = $impresoKg + $laminadoKg + $corteSalidaKg;

        return [
            'virgin_material' => [
                'printing_total_entrada_kg' => self::fmtKg($printing['entrada_kg']),
                'laminacion_total_virgen_kg' => self::fmtKg($laminacion['entrada_virgen_kg']),
            ],
            'material_listo' => [
                'impreso' => [
                    'num_bobinas' => $printing['salida_bobinas'],
                    'peso_total_kg' => self::fmtKg($impresoKg),
                ],
                'laminado' => [
                    'peso_total_salida_kg' => self::fmtKg($laminadoKg),
                    'num_bobinas' => $laminacion['salida_bobinas'],
                ],
                'corte_kg_salida' => self::fmtKg($corteSalidaKg),
                /** Kg de salida de corte (listo para despacho en corte). */
                'total_listo_despacho_kg' => self::fmtKg($corteSalidaKg),
                /** Suma impreso + laminado + corte (resumen general). */
                'total_general_kg' => self::fmtKg($totalGeneralKg),
            ],
            'scrap' => $scrap,
            'montaje_consumo' => $montaje,
            'tintas' => $tintas,
            'laminacion_quimicos' => $lamQuimicos,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function loadForm(int $workOrderId): ?array
    {
        $doc = WorkOrderTechnicalDocument::query()
            ->where('work_order_id', $workOrderId)
            ->first();

        $form = $doc?->form;

        return is_array($form) ? $form : null;
    }

    /**
     * @param  array<string, mixed>|null  $form
     * @return array{entrada_kg: float, salida_kg: float, salida_bobinas: int}
     */
    private static function aggregatePrinting(?array $form): array
    {
        return PlanillaSalidaAggregator::resolvePrintingSalida($form);
    }

    /**
     * @param  array<string, mixed>|null  $form
     * @return array{entrada_virgen_kg: float, salida_kg: float, salida_bobinas: int}
     */
    private static function aggregateLaminacion(?array $form): array
    {
        return PlanillaSalidaAggregator::resolveLaminacionSalida($form);
    }

    /**
     * @param  array<string, mixed>|null  $form
     * @return array{salida_kg: float}
     */
    private static function aggregateCorte(?array $form): array
    {
        return PlanillaSalidaAggregator::resolveCorteSalida($form);
    }

    /**
     * @param  array<string, mixed>|null  $form
     * @return array<string, mixed>
     */
    private static function aggregateScrap(?array $form): array
    {
        $parseKg = static fn (?array $f, string $key): float => self::readKg($f[$key] ?? null);

        $resolved = PlanillaScrapAggregator::resolvePrintingLaminacionScrap($form, $parseKg);

        $impT = $resolved['imp_transparente'];
        $impI = $resolved['imp_impreso'];
        $lamT = $resolved['lam_transparente'];
        $lamI = $resolved['lam_impreso'];
        $lamL = $resolved['lam_laminado'];

        $corteResolved = PlanillaScrapAggregator::resolveCorteScrap($form, $parseKg);
        $corR = $corteResolved['refile'];
        $corI = $corteResolved['impreso'];
        $corM = $corteResolved['mal_corte'];

        $impTotal = $impT + $impI;
        $lamTotal = $lamT + $lamI + $lamL;
        $corTotal = $corR + $corI + $corM;

        return [
            'printing' => [
                'transparente_kg' => self::fmtKg($impT),
                'impreso_kg' => self::fmtKg($impI),
                'total_kg' => self::fmtKg($impTotal),
            ],
            'laminacion' => [
                'transparente_kg' => self::fmtKg($lamT),
                'impreso_kg' => self::fmtKg($lamI),
                'laminado_kg' => self::fmtKg($lamL),
                'total_kg' => self::fmtKg($lamTotal),
            ],
            'corte' => [
                'refile_kg' => self::fmtKg($corR),
                'impreso_kg' => self::fmtKg($corI),
                'mal_corte_kg' => self::fmtKg($corM),
                'total_kg' => self::fmtKg($corTotal),
            ],
            'grand_total_kg' => self::fmtKg($impTotal + $lamTotal + $corTotal),
        ];
    }

    /**
     * @param  array<string, mixed>|null  $form
     * @return array{lines: list<array<string, mixed>>}
     */
    private static function aggregateMontaje(?array $form): array
    {
        $lines = [];
        $produccionKg = 0.0;
        $mermaKg = 0.0;

        if ($form === null) {
            return [
                'lines' => $lines,
                'total_produccion_kg' => self::fmtKg(0),
                'total_merma_kg' => self::fmtKg(0),
            ];
        }

        foreach ((array) ($form['montTurnosMontaje'] ?? []) as $turn) {
            if (! is_array($turn)) {
                continue;
            }
            $produccionKg += self::parseKgValue($turn['kgProduccion'] ?? null);
            $mermaKg += self::parseKgValue($turn['mermaKg'] ?? null);
        }

        $actual = $form['montTurnoActual'] ?? null;
        if (is_array($actual)) {
            $produccionKg += self::parseKgValue($actual['kgProduccion'] ?? null);
            $mermaKg += self::parseKgValue($actual['mermaKg'] ?? null);
        }

        $raw = $form['montMaterialesMontaje'] ?? $form['montMaterialesUsados'] ?? [];
        if (is_array($raw)) {
            foreach ($raw as $row) {
                if (! is_array($row)) {
                    continue;
                }
                $sticky = trim((string) ($row['stickyBack'] ?? $row['sticky_back'] ?? ''));
                $codigo = trim((string) ($row['codigo'] ?? ''));
                $color = trim((string) ($row['color'] ?? ''));
                $cantidad = trim((string) ($row['cantidad'] ?? ''));
                if ($sticky === '' && $codigo === '' && $color === '' && $cantidad === '') {
                    continue;
                }
                $lines[] = [
                    'sticky_back' => $sticky,
                    'codigo' => $codigo,
                    'color' => $color,
                    'cantidad' => $cantidad,
                ];
            }
        }

        return [
            'lines' => $lines,
            'total_produccion_kg' => self::fmtKg($produccionKg),
            'total_merma_kg' => self::fmtKg($mermaKg),
        ];
    }

    private static function parseKgValue(mixed $raw): float
    {
        if ($raw === null || $raw === '') {
            return 0.0;
        }
        $s = str_replace(',', '.', trim((string) $raw));
        if ($s === '' || ! is_numeric($s)) {
            return 0.0;
        }

        return (float) $s;
    }

    /**
     * @return array<string, mixed>
     */
    /**
     * @return array{original_kg: float, solventadas_kg: float, return_kg: float, alcohol_kg: float, metoxil_kg: float, npa_kg: float}
     */
    private static function aggregateTintasRaw(int $workOrderId): array
    {
        $original = 0.0;
        $solventadas = 0.0;
        $returns = 0.0;

        $inkLines = PrintingInkControlLine::query()
            ->where('work_order_id', $workOrderId)
            ->get();

        foreach ($inkLines as $line) {
            $original += (float) $line->quantity_original_kg;
            $solventadas += (float) $line->quantity_solventada_kg;
            $returns += (float) $line->quantity_return_kg;
        }

        $chemTotals = [
            'alcohol_kg' => 0.0,
            'metoxil_kg' => 0.0,
            'npa_kg' => 0.0,
        ];

        $chems = PrintingChemicalUsage::query()
            ->where('work_order_id', $workOrderId)
            ->get();

        foreach ($chems as $chem) {
            $type = strtolower(trim((string) $chem->chemical_type));
            $consumed = (float) $chem->quantity_consumed_kg;
            if ($type === 'alcohol') {
                $chemTotals['alcohol_kg'] += $consumed;
            } elseif ($type === 'metoxil') {
                $chemTotals['metoxil_kg'] += $consumed;
            } elseif ($type === 'npa') {
                $chemTotals['npa_kg'] += $consumed;
            }
        }

        return [
            'original_kg' => round($original, 3),
            'solventadas_kg' => round($solventadas, 3),
            'return_kg' => round($returns, 3),
            'alcohol_kg' => round($chemTotals['alcohol_kg'], 3),
            'metoxil_kg' => round($chemTotals['metoxil_kg'], 3),
            'npa_kg' => round($chemTotals['npa_kg'], 3),
        ];
    }

    private static function aggregateTintas(int $workOrderId): array
    {
        $raw = self::aggregateTintasRaw($workOrderId);
        $consumed = $raw['original_kg'] + $raw['solventadas_kg'] - $raw['return_kg'];

        return [
            'total_original_kg' => self::fmtKg($raw['original_kg']),
            'total_solventadas_kg' => self::fmtKg($raw['solventadas_kg']),
            'total_return_kg' => self::fmtKg($raw['return_kg']),
            'total_consumed_kg' => self::fmtKg($consumed),
            'alcohol_kg' => self::fmtKg($raw['alcohol_kg']),
            'metoxil_kg' => self::fmtKg($raw['metoxil_kg']),
            'npa_kg' => self::fmtKg($raw['npa_kg']),
        ];
    }

    /**
     * @return array{
     *   adhesivo_sobra_kg: float,
     *   catalizador_sobra_kg: float,
     *   acetato_sobra_lt: float,
     *   adhesivo_consumido_kg: float,
     *   catalizador_consumido_kg: float,
     *   acetato_consumido_lt: float
     * }
     */
    private static function aggregateLaminacionQuimicosRaw(?array $form): array
    {
        $adhesivoEntrada = 0.0;
        $adhesivoSobra = 0.0;
        $catalizadorEntrada = 0.0;
        $catalizadorSobra = 0.0;
        $acetatoEntrada = 0.0;
        $acetatoSobra = 0.0;

        if ($form !== null) {
            foreach (self::laminacionTurns($form) as $turn) {
                $adhesivoEntrada += self::readKg($turn['adhesivoEntradaKg'] ?? null);
                $adhesivoSobra += self::readKg($turn['adhesivoSobroKg'] ?? null);
                $catalizadorEntrada += self::readKg($turn['catalizadorEntradaKg'] ?? null);
                $catalizadorSobra += self::readKg($turn['catalizadorSobroKg'] ?? null);
                $acetatoEntrada += self::readKg($turn['acetatoEntradaLt'] ?? null);
                $acetatoSobra += self::readKg($turn['acetatoSobroLt'] ?? null);
            }

            if ($adhesivoEntrada + $adhesivoSobra + $catalizadorEntrada + $catalizadorSobra + $acetatoEntrada + $acetatoSobra < 0.0005) {
                $adhesivoEntrada = self::readKg($form['lamAdhesivoEntradaKg'] ?? null);
                $adhesivoSobra = self::readKg($form['lamAdhesivoSobroKg'] ?? null);
                $catalizadorEntrada = self::readKg($form['lamCatalizadorEntradaKg'] ?? null);
                $catalizadorSobra = self::readKg($form['lamCatalizadorSobroKg'] ?? null);
                $acetatoEntrada = self::readKg($form['lamAcetatoEntradaLt'] ?? null);
                $acetatoSobra = self::readKg($form['lamAcetatoSobroLt'] ?? null);
            }
        }

        return [
            'adhesivo_sobra_kg' => round($adhesivoSobra, 3),
            'catalizador_sobra_kg' => round($catalizadorSobra, 3),
            'acetato_sobra_lt' => round($acetatoSobra, 3),
            'adhesivo_consumido_kg' => round(max(0.0, $adhesivoEntrada - $adhesivoSobra), 3),
            'catalizador_consumido_kg' => round(max(0.0, $catalizadorEntrada - $catalizadorSobra), 3),
            'acetato_consumido_lt' => round(max(0.0, $acetatoEntrada - $acetatoSobra), 3),
        ];
    }

    private static function aggregateLaminacionQuimicos(?array $form): array
    {
        $raw = self::aggregateLaminacionQuimicosRaw($form);

        return [
            'adhesivo_consumido_kg' => self::fmtKg($raw['adhesivo_consumido_kg']),
            'catalizador_consumido_kg' => self::fmtKg($raw['catalizador_consumido_kg']),
            'acetato_consumido_lt' => self::fmtKg($raw['acetato_consumido_lt']),
        ];
    }

    /**
     * @param  array<string, mixed>  $form
     * @return list<array<string, mixed>>
     */
    private static function printingTurns(array $form): array
    {
        $turns = [];
        foreach ((array) ($form['impTurnosImpresion'] ?? []) as $turn) {
            if (is_array($turn)) {
                $turns[] = $turn;
            }
        }
        $actual = $form['impTurnoActual'] ?? null;
        if (is_array($actual)) {
            $turns[] = $actual;
        }

        return $turns;
    }

    /**
     * @param  array<string, mixed>  $form
     * @return list<array<string, mixed>>
     */
    private static function laminacionTurns(array $form): array
    {
        $turns = [];
        foreach ((array) ($form['lamTurnosLaminacion'] ?? []) as $turn) {
            if (is_array($turn)) {
                $turns[] = $turn;
            }
        }
        $actual = $form['lamTurnoActual'] ?? null;
        if (is_array($actual)) {
            $turns[] = $actual;
        }

        return $turns;
    }

    /**
     * @param  array<int|string, mixed>  $series
     */
    private static function sumSeriesKg(array $series): float
    {
        $sum = 0.0;
        foreach ($series as $value) {
            $sum += self::readKg($value);
        }

        return round($sum, 3);
    }

    private static function readKg(mixed $raw): float
    {
        if ($raw === null || $raw === '') {
            return 0.0;
        }
        if (is_numeric($raw)) {
            $n = (float) $raw;

            return is_finite($n) && $n > 0 ? round($n, 3) : 0.0;
        }
        $s = trim(str_replace(',', '.', (string) $raw));
        if ($s === '' || ! is_numeric($s)) {
            return 0.0;
        }
        $n = (float) $s;

        return is_finite($n) && $n > 0 ? round($n, 3) : 0.0;
    }

    private static function fmtKg(float $value): string
    {
        return number_format(round($value, 3), 3, '.', '');
    }

    /**
     * @param  array<int, string>  $materialNames
     * @return array<string, array{kg: float, bobinas: int}>
     */
    private static function breakdownPrintingSalidaBuckets(
        ?array $form,
        array $materialNames,
        ?string $productStructure,
        array $productMaterialLabels = [],
    ): array {
        $buckets = [];
        if ($form === null) {
            return $buckets;
        }

        $defaultLabel = self::resolveDefaultMaterialLabel(
            $form,
            $materialNames,
            $productStructure,
            'impreso',
            $productMaterialLabels,
        );
        $planillaSustratoLabels = self::planillaSustratoLabels($form, 'impresion', $materialNames);

        foreach (self::printingTurns($form) as $turn) {
            $slotKgBeforeTurn = self::sumBucketKg($buckets);

            foreach ((array) ($turn['capturas'] ?? []) as $cap) {
                if (! is_array($cap)) {
                    continue;
                }
                self::accumulateSalidaBuckets(
                    $buckets,
                    (array) ($cap['salidaBobinasKg'] ?? []),
                    (array) ($cap['salidaBobinasMeta'] ?? []),
                    $defaultLabel,
                    (array) ($cap['entradaBobinasMeta'] ?? []),
                    $planillaSustratoLabels,
                );
            }
            self::accumulateSalidaBuckets(
                $buckets,
                (array) ($turn['salidaBobinasKg'] ?? []),
                (array) ($turn['salidaBobinasMeta'] ?? []),
                $defaultLabel,
                (array) ($turn['entradaBobinasMeta'] ?? []),
                $planillaSustratoLabels,
            );

            self::accumulatePrintingResumenCierreGap(
                $buckets,
                $turn,
                $slotKgBeforeTurn,
                $defaultLabel,
                $planillaSustratoLabels,
            );
        }

        self::accumulateSalidaBuckets(
            $buckets,
            (array) ($form['impSalidaBobinasKg'] ?? []),
            (array) ($form['impSalidaBobinasMeta'] ?? []),
            $defaultLabel,
            (array) ($form['impEntradaBobinasMeta'] ?? []),
            $planillaSustratoLabels,
        );

        return self::rebuildBucketsFromPlanillaSustratosIfUnlabeled(
            $buckets,
            $form,
            'impresion',
            $materialNames,
        );
    }

    /**
     * @param  array<int, string>  $materialNames
     * @return array<string, array{kg: float, bobinas: int}>
     */
    private static function breakdownLaminacionSalidaBuckets(
        ?array $form,
        array $materialNames,
        ?string $productStructure,
        array $productMaterialLabels = [],
    ): array {
        $buckets = [];
        if ($form === null) {
            return $buckets;
        }

        $defaultLabel = self::resolveDefaultMaterialLabel(
            $form,
            $materialNames,
            $productStructure,
            'laminacion',
            $productMaterialLabels,
        );
        $planillaSustratoLabels = self::planillaSustratoLabels($form, 'laminacion', $materialNames);

        foreach (self::laminacionTurns($form) as $turn) {
            self::accumulateSalidaBuckets(
                $buckets,
                (array) ($turn['salidaBobinasKg'] ?? []),
                (array) ($turn['salidaBobinasMeta'] ?? []),
                $defaultLabel,
                (array) ($turn['entradaVirgenBobinasMeta'] ?? []),
                $planillaSustratoLabels,
            );
        }

        self::accumulateSalidaBuckets(
            $buckets,
            (array) ($form['lamSalidaBobinasKg'] ?? []),
            (array) ($form['lamSalidaBobinasMeta'] ?? []),
            $defaultLabel,
            [],
            $planillaSustratoLabels,
        );

        return self::rebuildBucketsFromPlanillaSustratosIfUnlabeled(
            $buckets,
            $form,
            'laminacion',
            $materialNames,
        );
    }

    /**
     * @param  array<int, string>  $materialNames
     * @return array<string, array{kg: float, bobinas: int}>
     */
    private static function breakdownCorteSalidaBuckets(
        ?array $form,
        array $materialNames,
        ?string $productStructure,
        ?string $productFinishedLabel = null,
    ): array {
        if ($form === null) {
            return [];
        }

        $salidaKg = self::aggregateCorte($form)['salida_kg'];
        if ($salidaKg < 0.0005) {
            return [];
        }

        $labels = self::resolveAreaMaterialLabels($form, $materialNames, $productStructure);
        $finished = trim((string) ($productFinishedLabel ?? ''));
        $label = $labels[0] ?? ($finished !== '' ? $finished : 'Material cortado (rollos / paletas)');

        return [
            $label => [
                'kg' => round($salidaKg, 3),
                'bobinas' => self::countCorteRollosWithKg($form),
            ],
        ];
    }

    /**
     * @param  array<string, array{kg: float, bobinas: int}>  $buckets
     * @param  array<int|string, mixed>  $slots
     * @param  array<int|string, mixed>  $metas
     * @param  array<int|string, mixed>  $entradaMetas
     * @param  list<string>  $planillaSustratoLabels
     */
    private static function accumulateSalidaBuckets(
        array &$buckets,
        array $slots,
        array $metas,
        string $defaultLabel,
        array $entradaMetas = [],
        array $planillaSustratoLabels = [],
    ): void {
        $size = max(count($slots), count($metas), count($entradaMetas));
        for ($i = 0; $i < $size; $i++) {
            $kg = self::salidaKgFromSlotAndMeta($slots[$i] ?? null, $metas[$i] ?? null);
            if ($kg < 0.0005) {
                continue;
            }
            $salidaMeta = is_array($metas[$i] ?? null) ? $metas[$i] : null;
            $entradaMeta = is_array($entradaMetas[$i] ?? null) ? $entradaMetas[$i] : null;
            $planillaLabel = $planillaSustratoLabels[$i] ?? $planillaSustratoLabels[0] ?? null;
            $label = self::resolveSalidaSlotLabel($salidaMeta, $entradaMeta, $planillaLabel, $defaultLabel);
            if (! isset($buckets[$label])) {
                $buckets[$label] = ['kg' => 0.0, 'bobinas' => 0];
            }
            $buckets[$label]['kg'] = round($buckets[$label]['kg'] + $kg, 3);
            $buckets[$label]['bobinas']++;
        }
    }

    /**
     * @param  array<string, mixed>|null  $salidaMeta
     * @param  array<string, mixed>|null  $entradaMeta
     */
    private static function resolveSalidaSlotLabel(
        ?array $salidaMeta,
        ?array $entradaMeta,
        ?string $planillaSustratoLabel,
        string $defaultLabel,
    ): string {
        $label = self::bobinaMetaLabel($salidaMeta, '');
        if ($label !== '') {
            return $label;
        }

        $label = self::bobinaMetaLabel($entradaMeta, '');
        if ($label !== '') {
            return $label;
        }

        $planilla = trim((string) ($planillaSustratoLabel ?? ''));
        if ($planilla !== '') {
            return $planilla;
        }

        return $defaultLabel;
    }

    /**
     * @param  array<string, mixed>  $turn
     * @param  list<string>  $planillaSustratoLabels
     */
    private static function accumulatePrintingResumenCierreGap(
        array &$buckets,
        array $turn,
        float $slotKgBeforeTurn,
        string $defaultLabel,
        array $planillaSustratoLabels,
    ): void {
        $resumen = $turn['resumenCierre'] ?? null;
        if (! is_array($resumen)) {
            return;
        }

        $resumenKg = self::readKg($resumen['pesoSalidaKg'] ?? null);
        if ($resumenKg < 0.0005) {
            return;
        }

        $slotKgAfterTurn = self::sumBucketKg($buckets);
        $gapKg = round($resumenKg - ($slotKgAfterTurn - $slotKgBeforeTurn), 3);
        if ($gapKg < 0.0005) {
            return;
        }

        $label = $planillaSustratoLabels[0] ?? $defaultLabel;
        if (! isset($buckets[$label])) {
            $buckets[$label] = ['kg' => 0.0, 'bobinas' => 0];
        }
        $buckets[$label]['kg'] = round($buckets[$label]['kg'] + $gapKg, 3);

        $resumenBobinas = (int) ($resumen['numBobinasSalida'] ?? 0);
        $slotBobinasThisTurn = self::countBobinasFromTurnSlots($turn);
        if ($slotBobinasThisTurn === 0 && $resumenBobinas > 0) {
            $buckets[$label]['bobinas'] += $resumenBobinas;
        }
    }

    /**
     * @param  array<string, mixed>  $turn
     */
    private static function countBobinasFromTurnSlots(array $turn): int
    {
        $count = 0;
        foreach ((array) ($turn['capturas'] ?? []) as $cap) {
            if (! is_array($cap)) {
                continue;
            }
            $count += self::countBobinasWithKg(
                (array) ($cap['salidaBobinasKg'] ?? []),
                (array) ($cap['salidaBobinasMeta'] ?? []),
            );
        }
        $count += self::countBobinasWithKg(
            (array) ($turn['salidaBobinasKg'] ?? []),
            (array) ($turn['salidaBobinasMeta'] ?? []),
        );

        return $count;
    }

    /**
     * @param  array<int|string, mixed>  $slots
     * @param  array<int|string, mixed>  $metas
     */
    private static function countBobinasWithKg(array $slots, array $metas): int
    {
        $count = 0;
        $size = max(count($slots), count($metas));
        for ($i = 0; $i < $size; $i++) {
            if (self::salidaKgFromSlotAndMeta($slots[$i] ?? null, $metas[$i] ?? null) > 0) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * @param  array<string, array{kg: float, bobinas: int}>  $buckets
     */
    private static function sumBucketKg(array $buckets): float
    {
        $sum = 0.0;
        foreach ($buckets as $totals) {
            $sum += (float) ($totals['kg'] ?? 0);
        }

        return round($sum, 3);
    }

    /**
     * @param  array<string, array{kg: float, bobinas: int}>  $buckets
     */
    private static function sumBucketBobinas(array $buckets): int
    {
        $sum = 0;
        foreach ($buckets as $totals) {
            $sum += (int) ($totals['bobinas'] ?? 0);
        }

        return $sum;
    }

    /**
     * @param  array<string, mixed>|null  $meta
     */
    private static function bobinaMetaLabel(?array $meta, string $fallback): string
    {
        if ($meta === null) {
            return $fallback;
        }

        $ref = trim((string) ($meta['referencia'] ?? ''));
        $prov = trim((string) ($meta['proveedor'] ?? ''));
        if ($ref !== '' && $prov !== '') {
            return $ref.' ('.$prov.')';
        }
        if ($ref !== '') {
            return $ref;
        }
        if ($prov !== '') {
            return $prov;
        }

        foreach (['tratamiento_interno', 'tratamiento_externo', 'lote', 'pedido_lote'] as $key) {
            $value = trim((string) ($meta[$key] ?? ''));
            if ($value !== '') {
                return $value;
            }
        }

        return $fallback;
    }

    private static function salidaKgFromSlotAndMeta(mixed $slot, mixed $meta): float
    {
        $fromSlot = self::readKg($slot);
        if ($fromSlot > 0) {
            return $fromSlot;
        }
        if (! is_array($meta)) {
            return 0.0;
        }

        return self::readKg($meta['peso'] ?? null);
    }

    /**
     * @param  array<string, mixed>|null  $form
     * @param  array<int, string>  $materialNames
     * @return list<string>
     */
    private static function planillaSustratoLabels(?array $form, string $area, array $materialNames): array
    {
        return array_map(
            fn (array $row): string => (string) $row['label'],
            self::planillaSustratoRows($form, $area, $materialNames),
        );
    }

    /**
     * @param  array<string, mixed>|null  $form
     * @param  array<int, string>  $materialNames
     * @return list<array{label: string, kg: float}>
     */
    private static function planillaSustratoRows(?array $form, string $area, array $materialNames): array
    {
        if ($form === null) {
            return [];
        }

        $key = $area === 'laminacion' ? 'sustratosVirgenLam' : 'sustratosVirgenImp';
        $rows = [];

        foreach ((array) ($form[$key] ?? []) as $row) {
            if (! is_array($row)) {
                continue;
            }
            $label = self::sustratoLabelFromPlanillaRow($row, $materialNames);
            if ($label === '') {
                continue;
            }
            $rows[] = [
                'label' => $label,
                'kg' => self::readKg($row['kg'] ?? null),
            ];
        }

        if ($rows === [] && $area === 'impresion') {
            $legacyMid = trim((string) ($form['sustratoVirgenImp1'] ?? ''));
            $legacyKg = self::readKg($form['kgUtilizarImp1'] ?? null);
            if ($legacyMid !== '' && is_numeric($legacyMid)) {
                $mid = (int) $legacyMid;
                $label = $mid > 0 && isset($materialNames[$mid])
                    ? trim((string) $materialNames[$mid])
                    : '';
                if ($label !== '') {
                    $rows[] = ['label' => $label, 'kg' => $legacyKg];
                }
            }
        }

        return $rows;
    }

    /**
     * @param  array<string, mixed>  $row
     * @param  array<int, string>  $materialNames
     */
    private static function sustratoLabelFromPlanillaRow(array $row, array $materialNames): string
    {
        $free = trim((string) ($row['material_free_text'] ?? ''));
        if ($free !== '') {
            return $free;
        }

        $mid = isset($row['material_id']) && is_numeric($row['material_id'])
            ? (int) $row['material_id']
            : 0;
        if ($mid > 0 && isset($materialNames[$mid])) {
            return trim((string) $materialNames[$mid]);
        }

        return '';
    }

    private static function isUnlabeledFallbackLabel(string $label): bool
    {
        return in_array($label, [
            'Bobina impresa (sin referencia)',
            'Bobina laminada (sin referencia)',
        ], true);
    }

    /**
     * @param  array<string, array{kg: float, bobinas: int}>  $buckets
     * @param  array<string, mixed>|null  $form
     * @param  array<int, string>  $materialNames
     * @return array<string, array{kg: float, bobinas: int}>
     */
    private static function rebuildBucketsFromPlanillaSustratosIfUnlabeled(
        array $buckets,
        ?array $form,
        string $area,
        array $materialNames,
    ): array {
        if ($buckets === []) {
            return $buckets;
        }

        $planillaRows = self::planillaSustratoRows($form, $area, $materialNames);
        if ($planillaRows === []) {
            return $buckets;
        }

        $planillaLabelSet = array_map(fn (array $row): string => (string) $row['label'], $planillaRows);

        $onlyUnlabeled = true;
        foreach (array_keys($buckets) as $label) {
            if (! self::isUnlabeledFallbackLabel((string) $label)) {
                $onlyUnlabeled = false;
                break;
            }
        }

        $singleBucketMatchesFirstPlanilla = count($buckets) === 1
            && count($planillaRows) > 1
            && array_key_exists($planillaRows[0]['label'], $buckets);

        if (! $onlyUnlabeled && ! $singleBucketMatchesFirstPlanilla) {
            return $buckets;
        }

        $totalKg = self::sumBucketKg($buckets);
        $totalBobinas = self::sumBucketBobinas($buckets);
        if ($totalKg < 0.0005) {
            return $buckets;
        }

        if (count($planillaRows) === 1) {
            return [
                $planillaRows[0]['label'] => [
                    'kg' => $totalKg,
                    'bobinas' => $totalBobinas,
                ],
            ];
        }

        $weightSum = 0.0;
        foreach ($planillaRows as $row) {
            $weightSum += $row['kg'] > 0 ? $row['kg'] : 1.0;
        }

        $rebuilt = [];
        $allocatedKg = 0.0;
        $allocatedBobinas = 0;
        $lastIndex = count($planillaRows) - 1;
        foreach ($planillaRows as $index => $row) {
            $weight = $row['kg'] > 0 ? $row['kg'] : 1.0;
            $share = $weight / $weightSum;
            $kg = $index === $lastIndex
                ? round($totalKg - $allocatedKg, 3)
                : round($totalKg * $share, 3);
            $bobinas = $index === $lastIndex
                ? max(0, $totalBobinas - $allocatedBobinas)
                : (int) round($totalBobinas * $share);
            $label = $row['label'];
            if (! isset($rebuilt[$label])) {
                $rebuilt[$label] = ['kg' => 0.0, 'bobinas' => 0];
            }
            $rebuilt[$label]['kg'] = round($rebuilt[$label]['kg'] + $kg, 3);
            $rebuilt[$label]['bobinas'] += $bobinas;
            $allocatedKg += $kg;
            $allocatedBobinas += $bobinas;
        }

        return $rebuilt;
    }

    /**
     * Etiquetas de material/sustrato desde datos de áreas en la planilla OT.
     *
     * @param  array<string, mixed>  $form
     * @param  array<int, string>  $materialNames
     * @return list<string>
     */
    private static function resolveAreaMaterialLabels(
        array $form,
        array $materialNames,
        ?string $productStructure,
    ): array {
        $labels = [];

        self::appendMetaLabels($labels, (array) ($form['corEntradaBobinasMeta'] ?? []));

        foreach ((array) ($form['cor_turnos'] ?? []) as $turn) {
            if (! is_array($turn)) {
                continue;
            }
            self::appendMetaLabels($labels, (array) ($turn['entradaBobinasMeta'] ?? []));
        }

        $actual = $form['corTurnoActual'] ?? $form['cor_turno_actual'] ?? null;
        if (is_array($actual)) {
            self::appendMetaLabels($labels, (array) ($actual['entradaBobinasMeta'] ?? []));
        }

        foreach (self::printingTurns($form) as $turn) {
            foreach ((array) ($turn['capturas'] ?? []) as $cap) {
                if (! is_array($cap)) {
                    continue;
                }
                self::appendMetaLabels($labels, (array) ($cap['salidaBobinasMeta'] ?? []));
            }
            self::appendMetaLabels($labels, (array) ($turn['salidaBobinasMeta'] ?? []));
            self::appendMetaLabels($labels, (array) ($turn['entradaBobinasMeta'] ?? []));
        }
        self::appendMetaLabels($labels, (array) ($form['impSalidaBobinasMeta'] ?? []));
        self::appendMetaLabels($labels, (array) ($form['impEntradaBobinasMeta'] ?? []));

        foreach (self::laminacionTurns($form) as $turn) {
            self::appendMetaLabels($labels, (array) ($turn['salidaBobinasMeta'] ?? []));
            self::appendMetaLabels($labels, (array) ($turn['entradaVirgenBobinasMeta'] ?? []));
        }
        self::appendMetaLabels($labels, (array) ($form['lamSalidaBobinasMeta'] ?? []));

        foreach (self::planillaSustratoLabels($form, 'impresion', $materialNames) as $label) {
            $labels[] = $label;
        }
        foreach (self::planillaSustratoLabels($form, 'laminacion', $materialNames) as $label) {
            $labels[] = $label;
        }

        $substrate = trim((string) ($form['corDesperdicioSustrato'] ?? ''));
        if ($substrate !== '') {
            $labels[] = ScrapSubstrateCatalog::labelFor(ScrapSubstrateCatalog::normalizeGroupId($substrate));
        }

        foreach (self::structureInferenceLabels($productStructure) as $label) {
            $labels[] = $label;
        }

        return array_values(array_unique(array_filter($labels, fn (string $l): bool => $l !== '')));
    }

    /**
     * @param  array<string, mixed>|null  $form
     * @param  array<int, string>  $materialNames
     */
    private static function resolveDefaultMaterialLabel(
        ?array $form,
        array $materialNames,
        ?string $productStructure,
        string $area,
        array $productSubstrateLabels = [],
    ): string {
        if ($form !== null) {
            $planilla = self::planillaSustratoLabels(
                $form,
                $area === 'laminacion' ? 'laminacion' : 'impresion',
                $materialNames,
            );
            if ($planilla !== []) {
                return $planilla[0];
            }

            $labels = self::resolveAreaMaterialLabels($form, $materialNames, $productStructure);
            if ($labels !== []) {
                return $labels[0];
            }
        }

        $inferred = self::structureInferenceLabels($productStructure);
        if ($inferred !== []) {
            return $inferred[0];
        }

        foreach ($productSubstrateLabels as $label) {
            $label = trim((string) $label);
            if ($label !== '') {
                return $label;
            }
        }

        return $area === 'laminacion'
            ? 'Bobina laminada (sin referencia)'
            : 'Bobina impresa (sin referencia)';
    }

    /**
     * @param  array<int|string, mixed>  $metas
     * @param  list<string>  $labels
     */
    private static function appendMetaLabels(array &$labels, array $metas): void
    {
        foreach ($metas as $meta) {
            if (! is_array($meta)) {
                continue;
            }
            $label = self::bobinaMetaLabel($meta, '');
            if ($label !== '') {
                $labels[] = $label;
            }
        }
    }

    /**
     * @return list<string>
     */
    private static function structureInferenceLabels(?string $productStructure): array
    {
        $matched = ScrapSubstrateCatalog::structureMatchedGroupIds($productStructure);
        if ($matched === []) {
            return [];
        }

        return array_values(array_map(
            fn (string $id): string => ScrapSubstrateCatalog::labelFor($id),
            $matched,
        ));
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private static function countCorteRollosWithKg(array $form): int
    {
        $count = 0;
        foreach (CortePlanillaSalida::paletasArrayFromForm($form) as $paleta) {
            if (! is_array($paleta)) {
                continue;
            }
            $rollos = $paleta['rollosKg'] ?? null;
            if (! is_array($rollos)) {
                continue;
            }
            foreach ($rollos as $kg) {
                if (CortePlanillaSalida::readPlausibleRollKg($kg) > 0) {
                    $count++;
                }
            }
        }

        return $count;
    }

    /**
     * @param  array<string, array{kg: float, bobinas: int}>  $buckets
     * @return list<array{label: string, kg: float, bobinas: int}>
     */
    private static function formatBreakdownBuckets(array $buckets): array
    {
        $lines = [];
        foreach ($buckets as $label => $totals) {
            if (($totals['kg'] ?? 0) < 0.0005) {
                continue;
            }
            $lines[] = [
                'label' => (string) $label,
                'kg' => round((float) $totals['kg'], 3),
                'bobinas' => (int) ($totals['bobinas'] ?? 0),
            ];
        }

        usort($lines, fn (array $a, array $b): int => $b['kg'] <=> $a['kg']);

        return $lines;
    }

    /**
     * @param  list<array{label: string, kg: float, bobinas: int}>  $lines
     * @return list<array{label: string, kg: string, bobinas: int}>
     */
    public static function formatBreakdownLinesForApi(array $lines): array
    {
        return array_map(
            fn (array $line): array => [
                'label' => $line['label'],
                'kg' => self::fmtKg((float) $line['kg']),
                'bobinas' => (int) ($line['bobinas'] ?? 0),
            ],
            $lines,
        );
    }

    /**
     * @param  list<array{label: string, kg: float, bobinas: int}>  ...$groups
     * @return list<array{label: string, kg: float, bobinas: int}>
     */
    public static function mergeBreakdownLineGroups(array ...$groups): array
    {
        $buckets = [];
        foreach ($groups as $lines) {
            foreach ($lines as $line) {
                $label = (string) ($line['label'] ?? '');
                if ($label === '') {
                    continue;
                }
                if (! isset($buckets[$label])) {
                    $buckets[$label] = ['kg' => 0.0, 'bobinas' => 0];
                }
                $buckets[$label]['kg'] = round($buckets[$label]['kg'] + (float) ($line['kg'] ?? 0), 3);
                $buckets[$label]['bobinas'] += (int) ($line['bobinas'] ?? 0);
            }
        }

        return self::formatBreakdownBuckets($buckets);
    }
}
