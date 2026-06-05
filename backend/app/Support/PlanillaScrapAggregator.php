<?php

namespace App\Support;

/**
 * Agrega kg de desperdicio desde planilla plana y/o historial de turnos
 * (impTurnosImpresion, lamTurnosLaminacion, cor_turnos / corTurnoActual).
 *
 * Tras cerrar o guardar capturas en producción, los campos planos impScrap* / lamScrap* / corScrap* quedan en cero;
 * el acumulado vive en turnos y capturas. El reporte debe leer ambas fuentes.
 */
final class PlanillaScrapAggregator
{
    /**
     * @param  array<string, mixed>|null  $form
     * @param  callable(array<string, mixed>|null, string): float  $parseKg
     * @return array{
     *   imp_transparente: float,
     *   imp_impreso: float,
     *   lam_transparente: float,
     *   lam_impreso: float,
     *   lam_laminado: float
     * }
     */
    public static function resolvePrintingLaminacionScrap(?array $form, callable $parseKg): array
    {
        $fromTurns = self::aggregateFromTurnHistory($form);

        if ($fromTurns['has_turn_data']) {
            $impT = $fromTurns['imp_transparente'];
            $impI = $fromTurns['imp_impreso'];
            $lamT = $fromTurns['lam_transparente'];
            $lamI = $fromTurns['lam_impreso'];
            $lamL = $fromTurns['lam_laminado'];

            // Espejo plano del turno actual (por si aún no se reflejó en impTurnoActual).
            if ($impT < 0.0005 && $impI < 0.0005) {
                $impT += $parseKg($form, 'impScrapTransparenteKg');
                $impI += $parseKg($form, 'impScrapImpresoKg');
            }
            if ($lamT < 0.0005 && $lamI < 0.0005 && $lamL < 0.0005) {
                $lamT += $parseKg($form, 'lamScrapTransparenteKg');
                $lamI += $parseKg($form, 'lamScrapImpresoKg');
                $lamL += $parseKg($form, 'lamScrapLaminadoKg');
            }

            return [
                'imp_transparente' => round($impT, 3),
                'imp_impreso' => round($impI, 3),
                'lam_transparente' => round($lamT, 3),
                'lam_impreso' => round($lamI, 3),
                'lam_laminado' => round($lamL, 3),
            ];
        }

        return [
            'imp_transparente' => $parseKg($form, 'impScrapTransparenteKg'),
            'imp_impreso' => $parseKg($form, 'impScrapImpresoKg'),
            'lam_transparente' => $parseKg($form, 'lamScrapTransparenteKg'),
            'lam_impreso' => $parseKg($form, 'lamScrapImpresoKg'),
            'lam_laminado' => $parseKg($form, 'lamScrapLaminadoKg'),
        ];
    }

    /**
     * Desperdicio de corte: métricas en turnos cerrados/activos + fallback a campos planos corScrap*Kg.
     *
     * @param  array<string, mixed>|null  $form
     * @param  callable(array<string, mixed>|null, string): float  $parseKg
     * @return array{refile: float, impreso: float, mal_corte: float}
     */
    public static function resolveCorteScrap(?array $form, callable $parseKg): array
    {
        $refile = 0.0;
        $impreso = 0.0;
        $malCorte = 0.0;

        if ($form !== null) {
            foreach (array_merge(self::corteClosedTurns($form), self::corteOpenTurn($form)) as $turn) {
                $metrics = $turn['metrics'] ?? null;
                if (! is_array($metrics)) {
                    continue;
                }
                $refile += self::parseNumericField($metrics['scrap_refile_kg'] ?? null);
                $impreso += self::parseNumericField($metrics['scrap_impreso_kg'] ?? null);
                $malCorte += self::parseNumericField($metrics['scrap_mal_corte_kg'] ?? null);
            }
        }

        if ($refile + $impreso + $malCorte < 0.0005) {
            $refile = $parseKg($form, 'corScrapRefileKg');
            $impreso = $parseKg($form, 'corScrapImpresoKg');
            $malCorte = $parseKg($form, 'corScrapMalCorteKg');
        }

        return [
            'refile' => round($refile, 3),
            'impreso' => round($impreso, 3),
            'mal_corte' => round($malCorte, 3),
        ];
    }

    /**
     * @param  array<string, mixed>  $form
     * @return list<array<string, mixed>>
     */
    private static function corteClosedTurns(array $form): array
    {
        $out = [];
        foreach ((array) ($form['cor_turnos'] ?? []) as $turn) {
            if (is_array($turn) && ! empty($turn['closed_at'])) {
                $out[] = $turn;
            }
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>  $form
     * @return list<array<string, mixed>>
     */
    private static function corteOpenTurn(array $form): array
    {
        $actual = $form['corTurnoActual'] ?? null;
        if (is_array($actual) && empty($actual['closed_at'])) {
            return [$actual];
        }

        return [];
    }

    /**
     * @param  array<string, mixed>|null  $form
     * @return array{
     *   has_turn_data: bool,
     *   imp_transparente: float,
     *   imp_impreso: float,
     *   lam_transparente: float,
     *   lam_impreso: float,
     *   lam_laminado: float
     * }
     */
    private static function aggregateFromTurnHistory(?array $form): array
    {
        $impT = 0.0;
        $impI = 0.0;
        $lamT = 0.0;
        $lamI = 0.0;
        $lamL = 0.0;
        $hasTurnData = false;

        if ($form === null) {
            return [
                'has_turn_data' => false,
                'imp_transparente' => 0.0,
                'imp_impreso' => 0.0,
                'lam_transparente' => 0.0,
                'lam_impreso' => 0.0,
                'lam_laminado' => 0.0,
            ];
        }

        foreach ((array) ($form['impTurnosImpresion'] ?? []) as $turn) {
            if (! is_array($turn)) {
                continue;
            }
            $hasTurnData = true;
            [$t, $i] = self::sumPrintingScrapFromTurn($turn);
            $impT += $t;
            $impI += $i;
        }

        $actualImp = $form['impTurnoActual'] ?? null;
        if (is_array($actualImp)) {
            $hasTurnData = true;
            [$t, $i] = self::sumPrintingScrapFromTurn($actualImp);
            $impT += $t;
            $impI += $i;
        }

        foreach ((array) ($form['lamTurnosLaminacion'] ?? []) as $turn) {
            if (! is_array($turn)) {
                continue;
            }
            $hasTurnData = true;
            [$t, $i, $l] = self::sumLaminacionScrapFromTurn($turn);
            $lamT += $t;
            $lamI += $i;
            $lamL += $l;
        }

        $actualLam = $form['lamTurnoActual'] ?? null;
        if (is_array($actualLam)) {
            $hasTurnData = true;
            [$t, $i, $l] = self::sumLaminacionScrapFromTurn($actualLam);
            $lamT += $t;
            $lamI += $i;
            $lamL += $l;
        }

        return [
            'has_turn_data' => $hasTurnData,
            'imp_transparente' => $impT,
            'imp_impreso' => $impI,
            'lam_transparente' => $lamT,
            'lam_impreso' => $lamI,
            'lam_laminado' => $lamL,
        ];
    }

    /**
     * @param  array<string, mixed>  $turn
     * @return array{0: float, 1: float}
     */
    private static function sumPrintingScrapFromTurn(array $turn): array
    {
        $impT = 0.0;
        $impI = 0.0;

        foreach ((array) ($turn['capturas'] ?? []) as $cap) {
            if (! is_array($cap)) {
                continue;
            }
            $impT += self::parseNumericField($cap['scrapTransparenteKg'] ?? null);
            $impI += self::parseNumericField($cap['scrapImpresoKg'] ?? null);
        }

        $impT += self::parseNumericField($turn['scrapTransparenteKg'] ?? null);
        $impI += self::parseNumericField($turn['scrapImpresoKg'] ?? null);

        return [$impT, $impI];
    }

    /**
     * @param  array<string, mixed>  $turn
     * @return array{0: float, 1: float, 2: float}
     */
    private static function sumLaminacionScrapFromTurn(array $turn): array
    {
        $lamT = 0.0;
        $lamI = 0.0;
        $lamL = 0.0;

        foreach ((array) ($turn['capturas'] ?? []) as $cap) {
            if (! is_array($cap)) {
                continue;
            }
            $lamT += self::parseNumericField($cap['scrapTransparenteKg'] ?? null);
            $lamI += self::parseNumericField($cap['scrapImpresoKg'] ?? null);
            $lamL += self::parseNumericField($cap['scrapLaminadoKg'] ?? null);
        }

        $lamT += self::parseNumericField($turn['scrapTransparenteKg'] ?? null);
        $lamI += self::parseNumericField($turn['scrapImpresoKg'] ?? null);
        $lamL += self::parseNumericField($turn['scrapLaminadoKg'] ?? null);

        return [$lamT, $lamI, $lamL];
    }

    private static function parseNumericField(mixed $value): float
    {
        if ($value === null || $value === '') {
            return 0.0;
        }
        if (is_numeric($value)) {
            return round((float) $value, 3);
        }

        return round((float) str_replace(',', '.', (string) $value), 3);
    }
}
