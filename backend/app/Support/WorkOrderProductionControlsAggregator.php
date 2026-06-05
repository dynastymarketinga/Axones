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
        ?string $productLabel = null,
    ): array {
        $impresoFallback = self::planillaSustratoLabels($form, 'impresion', $materialNames);
        $lamFallback = self::planillaSustratoLabels($form, 'laminacion', $materialNames);

        return [
            'impreso' => self::formatBreakdownBuckets(
                self::breakdownPrintingSalidaBuckets($form, $impresoFallback),
            ),
            'laminado' => self::formatBreakdownBuckets(
                self::breakdownLaminacionSalidaBuckets($form, $lamFallback),
            ),
            'cortado' => self::formatBreakdownBuckets(
                self::breakdownCorteSalidaBuckets($form, $productLabel),
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
     * @param  list<string>  $fallbackLabels
     * @return array<string, array{kg: float, bobinas: int}>
     */
    private static function breakdownPrintingSalidaBuckets(?array $form, array $fallbackLabels): array
    {
        $buckets = [];
        if ($form === null) {
            return $buckets;
        }

        $defaultLabel = $fallbackLabels[0] ?? 'Bobina impresa (sin referencia)';

        foreach (self::printingTurns($form) as $turn) {
            foreach ((array) ($turn['capturas'] ?? []) as $cap) {
                if (! is_array($cap)) {
                    continue;
                }
                self::accumulateSalidaBuckets(
                    $buckets,
                    (array) ($cap['salidaBobinasKg'] ?? []),
                    (array) ($cap['salidaBobinasMeta'] ?? []),
                    $defaultLabel,
                );
            }
            self::accumulateSalidaBuckets(
                $buckets,
                (array) ($turn['salidaBobinasKg'] ?? []),
                (array) ($turn['salidaBobinasMeta'] ?? []),
                $defaultLabel,
            );
        }

        self::accumulateSalidaBuckets(
            $buckets,
            (array) ($form['impSalidaBobinasKg'] ?? []),
            (array) ($form['impSalidaBobinasMeta'] ?? []),
            $defaultLabel,
        );

        return $buckets;
    }

    /**
     * @param  list<string>  $fallbackLabels
     * @return array<string, array{kg: float, bobinas: int}>
     */
    private static function breakdownLaminacionSalidaBuckets(?array $form, array $fallbackLabels): array
    {
        $buckets = [];
        if ($form === null) {
            return $buckets;
        }

        $defaultLabel = $fallbackLabels[0] ?? 'Bobina laminada (sin referencia)';

        foreach (self::laminacionTurns($form) as $turn) {
            self::accumulateSalidaBuckets(
                $buckets,
                (array) ($turn['salidaBobinasKg'] ?? []),
                (array) ($turn['salidaBobinasMeta'] ?? []),
                $defaultLabel,
            );
        }

        self::accumulateSalidaBuckets(
            $buckets,
            (array) ($form['lamSalidaBobinasKg'] ?? []),
            (array) ($form['lamSalidaBobinasMeta'] ?? []),
            $defaultLabel,
        );

        return $buckets;
    }

    /**
     * @return array<string, array{kg: float, bobinas: int}>
     */
    private static function breakdownCorteSalidaBuckets(?array $form, ?string $productLabel): array
    {
        if ($form === null) {
            return [];
        }

        $salidaKg = self::aggregateCorte($form)['salida_kg'];
        if ($salidaKg < 0.0005) {
            return [];
        }

        $labels = self::corteEntradaLabels($form, $productLabel);
        $label = $labels[0] ?? ($productLabel !== null && trim($productLabel) !== ''
            ? trim($productLabel)
            : 'Material cortado (rollos / paletas)');

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
     */
    private static function accumulateSalidaBuckets(
        array &$buckets,
        array $slots,
        array $metas,
        string $defaultLabel,
    ): void {
        $size = max(count($slots), count($metas));
        for ($i = 0; $i < $size; $i++) {
            $kg = self::salidaKgFromSlotAndMeta($slots[$i] ?? null, $metas[$i] ?? null);
            if ($kg < 0.0005) {
                continue;
            }
            $meta = is_array($metas[$i] ?? null) ? $metas[$i] : null;
            $label = self::bobinaMetaLabel($meta, $defaultLabel);
            if (! isset($buckets[$label])) {
                $buckets[$label] = ['kg' => 0.0, 'bobinas' => 0];
            }
            $buckets[$label]['kg'] = round($buckets[$label]['kg'] + $kg, 3);
            $buckets[$label]['bobinas']++;
        }
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
        if ($form === null) {
            return [];
        }

        $key = $area === 'laminacion' ? 'sustratosVirgenLam' : 'sustratosVirgenImp';
        $labels = [];

        foreach ((array) ($form[$key] ?? []) as $row) {
            if (! is_array($row)) {
                continue;
            }
            $free = trim((string) ($row['material_free_text'] ?? ''));
            if ($free !== '') {
                $labels[] = $free;
                continue;
            }
            $mid = isset($row['material_id']) && is_numeric($row['material_id'])
                ? (int) $row['material_id']
                : 0;
            if ($mid > 0 && isset($materialNames[$mid])) {
                $labels[] = trim((string) $materialNames[$mid]);
            }
        }

        if ($labels === [] && $area === 'impresion') {
            $legacyMid = trim((string) ($form['sustratoVirgenImp1'] ?? ''));
            if ($legacyMid !== '' && is_numeric($legacyMid)) {
                $mid = (int) $legacyMid;
                if ($mid > 0 && isset($materialNames[$mid])) {
                    $labels[] = trim((string) $materialNames[$mid]);
                }
            }
        }

        return array_values(array_unique(array_filter($labels, fn (string $l): bool => $l !== '')));
    }

    /**
     * @param  array<string, mixed>  $form
     * @return list<string>
     */
    private static function corteEntradaLabels(array $form, ?string $productLabel): array
    {
        $labels = [];

        foreach ((array) ($form['corEntradaBobinasMeta'] ?? []) as $meta) {
            if (! is_array($meta)) {
                continue;
            }
            $label = self::bobinaMetaLabel($meta, '');
            if ($label !== '') {
                $labels[] = $label;
            }
        }

        foreach ((array) ($form['cor_turnos'] ?? []) as $turn) {
            if (! is_array($turn)) {
                continue;
            }
            foreach ((array) ($turn['entradaBobinasMeta'] ?? []) as $meta) {
                if (! is_array($meta)) {
                    continue;
                }
                $label = self::bobinaMetaLabel($meta, '');
                if ($label !== '') {
                    $labels[] = $label;
                }
            }
        }

        $actual = $form['corTurnoActual'] ?? $form['cor_turno_actual'] ?? null;
        if (is_array($actual)) {
            foreach ((array) ($actual['entradaBobinasMeta'] ?? []) as $meta) {
                if (! is_array($meta)) {
                    continue;
                }
                $label = self::bobinaMetaLabel($meta, '');
                if ($label !== '') {
                    $labels[] = $label;
                }
            }
        }

        $substrate = trim((string) ($form['corDesperdicioSustrato'] ?? ''));
        if ($substrate !== '') {
            $group = ScrapSubstrateCatalog::normalizeGroupId($substrate);
            foreach (ScrapSubstrateCatalog::groups() as $cfg) {
                if ($cfg['id'] === $group) {
                    $labels[] = (string) $cfg['label'];
                    break;
                }
            }
        }

        if ($productLabel !== null && trim($productLabel) !== '') {
            $labels[] = trim($productLabel);
        }

        return array_values(array_unique(array_filter($labels, fn (string $l): bool => $l !== '')));
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
                if (self::readKg($kg) > 0) {
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
