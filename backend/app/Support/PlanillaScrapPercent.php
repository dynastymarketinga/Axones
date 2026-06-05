<?php

namespace App\Support;

/**
 * Calcula % desperdicio/scrap desde JSON de planilla (alineado con la UI MES).
 */
final class PlanillaScrapPercent
{
    /**
     * @param  array<string, mixed>  $form
     */
    public static function forArea(array $form, string $area): ?string
    {
        $pct = match (strtolower(trim($area))) {
            'impresion' => self::impresion($form),
            'laminacion' => self::laminacion($form),
            'corte' => self::corte($form),
            'montaje' => self::montaje($form),
            default => null,
        };

        if ($pct === null) {
            return null;
        }

        return number_format($pct, 3, '.', '');
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private static function impresion(array $form): ?float
    {
        $parseKg = static fn (?array $f, string $key): float => self::parseKg($f, $key);
        $resolved = PlanillaScrapAggregator::resolvePrintingLaminacionScrap($form, $parseKg);
        $scrap = $resolved['imp_transparente'] + $resolved['imp_impreso'];

        if ($scrap <= 0.0005) {
            $scrap = self::parseKg($form, 'impScrapTransparenteKg') + self::parseKg($form, 'impScrapImpresoKg');
        }

        $entrada = self::resolvePrintingEntradaDenominator($form);
        if ($entrada <= 0.0005 || $scrap <= 0) {
            return null;
        }

        return ($scrap / $entrada) * 100;
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private static function laminacion(array $form): ?float
    {
        $parseKg = static fn (?array $f, string $key): float => self::parseKg($f, $key);
        $resolved = PlanillaScrapAggregator::resolvePrintingLaminacionScrap($form, $parseKg);
        $scrap = $resolved['lam_transparente'] + $resolved['lam_impreso'] + $resolved['lam_laminado'];

        $entrada = self::resolveLaminacionEntradaDenominator($form);
        if ($entrada <= 0.0005 || $scrap <= 0) {
            return null;
        }

        return ($scrap / $entrada) * 100;
    }

    /**
     * % scrap / ingreso (refilPct en UI de corte).
     *
     * @param  array<string, mixed>  $form
     */
    private static function corte(array $form): ?float
    {
        $parseKg = static fn (?array $f, string $key): float => self::parseKg($f, $key);
        $resolved = PlanillaScrapAggregator::resolveCorteScrap($form, $parseKg);
        $scrap = $resolved['refile'] + $resolved['impreso'] + $resolved['mal_corte'];

        $ingreso = self::parseKg($form, 'kgIngresadosCorte');
        if ($ingreso <= 0.0005) {
            $ingreso = self::sumKgArray($form['corEntradaBobinasKg'] ?? null);
        }
        if ($ingreso <= 0.0005) {
            $ingreso = self::parseKg($form, 'pedidoKg');
        }

        if ($ingreso <= 0.0005 || $scrap <= 0) {
            return null;
        }

        return ($scrap / $ingreso) * 100;
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private static function montaje(array $form): ?float
    {
        $merma = self::parseKg($form, 'montMermaKg');
        $produccion = self::parseKg($form, 'montKgProduccion');

        foreach ((array) ($form['montTurnosMontaje'] ?? []) as $turn) {
            if (! is_array($turn)) {
                continue;
            }
            $merma += self::parseKgValue($turn['mermaKg'] ?? null);
            $produccion += self::parseKgValue($turn['kgProduccion'] ?? null);
        }

        $actual = $form['montTurnoActual'] ?? null;
        if (is_array($actual)) {
            $merma += self::parseKgValue($actual['mermaKg'] ?? null);
            $produccion += self::parseKgValue($actual['kgProduccion'] ?? null);
        }

        if ($produccion <= 0.0005 || $merma <= 0) {
            return null;
        }

        return ($merma / $produccion) * 100;
    }

    /**
     * Denominador scrap/ingreso: turnos → bobinas planas → pedido OT → salida acumulada.
     *
     * @param  array<string, mixed>  $form
     */
    private static function resolvePrintingEntradaDenominator(array $form): float
    {
        $entrada = self::sumPrintingEntradaKg($form);
        if ($entrada > 0.0005) {
            return $entrada;
        }

        $pedido = self::parseKg($form, 'pedidoKg');
        if ($pedido > 0.0005) {
            return $pedido;
        }

        return self::sumPrintingSalidaKg($form);
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private static function resolveLaminacionEntradaDenominator(array $form): float
    {
        $entrada = self::sumLaminacionEntradaKg($form);
        if ($entrada > 0.0005) {
            return $entrada;
        }

        $pedido = self::parseKg($form, 'pedidoKg');
        if ($pedido > 0.0005) {
            return $pedido;
        }

        return self::sumLaminacionSalidaKg($form);
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private static function sumPrintingSalidaKg(array $form): float
    {
        $total = 0.0;

        foreach ((array) ($form['impTurnosImpresion'] ?? []) as $turn) {
            if (is_array($turn)) {
                $total += self::printingTurnSalidaKg($turn);
            }
        }

        $actual = $form['impTurnoActual'] ?? null;
        if (is_array($actual)) {
            $total += self::printingTurnSalidaKg($actual);
        }

        if ($total <= 0.0005) {
            $total = self::sumKgArray($form['impSalidaBobinasKg'] ?? null);
        }

        if ($total <= 0.0005) {
            $total = self::parseKg($form, 'impAcumuladoProducidoKg');
        }

        return round($total, 3);
    }

    /**
     * @param  array<string, mixed>  $turn
     */
    private static function printingTurnSalidaKg(array $turn): float
    {
        $sum = 0.0;
        foreach ((array) ($turn['capturas'] ?? []) as $cap) {
            if (is_array($cap)) {
                $sum += self::sumKgArray($cap['salidaBobinasKg'] ?? null);
            }
        }
        $sum += self::sumKgArray($turn['salidaBobinasKg'] ?? null);

        if ($sum <= 0.0005 && is_array($turn['resumenCierre'] ?? null)) {
            $sum = self::parseKgValue($turn['resumenCierre']['pesoSalidaKg'] ?? null);
        }

        return $sum;
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private static function sumLaminacionSalidaKg(array $form): float
    {
        $total = 0.0;

        foreach ((array) ($form['lamTurnosLaminacion'] ?? []) as $turn) {
            if (is_array($turn)) {
                $total += self::laminacionTurnSalidaKg($turn);
            }
        }

        $actual = $form['lamTurnoActual'] ?? null;
        if (is_array($actual)) {
            $total += self::laminacionTurnSalidaKg($actual);
        }

        if ($total <= 0.0005) {
            $total = self::parseKg($form, 'lamAcumuladoProducidoKg');
        }

        return round($total, 3);
    }

    /**
     * @param  array<string, mixed>  $turn
     */
    private static function laminacionTurnSalidaKg(array $turn): float
    {
        $sum = 0.0;
        foreach ((array) ($turn['capturas'] ?? []) as $cap) {
            if (is_array($cap)) {
                $sum += self::sumKgArray($cap['salidaBobinasKg'] ?? null);
            }
        }
        $sum += self::sumKgArray($turn['salidaBobinasKg'] ?? null);

        if ($sum <= 0.0005 && is_array($turn['resumenCierre'] ?? null)) {
            $sum = self::parseKgValue($turn['resumenCierre']['pesoSalidaKg'] ?? null);
        }

        return $sum;
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private static function sumPrintingEntradaKg(array $form): float
    {
        $total = 0.0;

        foreach ((array) ($form['impTurnosImpresion'] ?? []) as $turn) {
            if (is_array($turn)) {
                $total += self::printingTurnEntradaKg($turn);
            }
        }

        $actual = $form['impTurnoActual'] ?? null;
        if (is_array($actual)) {
            $total += self::printingTurnEntradaKg($actual);
        }

        if ($total <= 0.0005) {
            $total = self::sumKgArray($form['impEntradaBobinasKg'] ?? null);
        }

        return round($total, 3);
    }

    /**
     * @param  array<string, mixed>  $turn
     */
    private static function printingTurnEntradaKg(array $turn): float
    {
        $sum = 0.0;
        foreach ((array) ($turn['capturas'] ?? []) as $cap) {
            if (is_array($cap)) {
                $sum += self::sumKgArray($cap['entradaBobinasKg'] ?? null);
            }
        }
        $sum += self::sumKgArray($turn['entradaBobinasKg'] ?? null);

        return $sum;
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private static function sumLaminacionEntradaKg(array $form): float
    {
        $total = 0.0;

        foreach ((array) ($form['lamTurnosLaminacion'] ?? []) as $turn) {
            if (is_array($turn)) {
                $total += self::laminacionTurnEntradaKg($turn);
            }
        }

        $actual = $form['lamTurnoActual'] ?? null;
        if (is_array($actual)) {
            $total += self::laminacionTurnEntradaKg($actual);
        }

        if ($total <= 0.0005) {
            $total = self::parseKg($form, 'lamEntradaImpresaKg')
                + self::parseKg($form, 'lamEntradaVirgenKg');
        }

        return round($total, 3);
    }

    /**
     * @param  array<string, mixed>  $turn
     */
    private static function laminacionTurnEntradaKg(array $turn): float
    {
        $sum = 0.0;
        foreach ((array) ($turn['capturas'] ?? []) as $cap) {
            if (is_array($cap)) {
                $sum += self::sumKgArray($cap['entradaImpresaBobinasKg'] ?? null);
                $sum += self::sumKgArray($cap['entradaVirgenBobinasKg'] ?? null);
            }
        }
        $sum += self::sumKgArray($turn['entradaImpresaBobinasKg'] ?? null);
        $sum += self::sumKgArray($turn['entradaVirgenBobinasKg'] ?? null);

        return $sum;
    }

    /**
     * @param  array<string, mixed>|null  $form
     */
    private static function parseKg(?array $form, string $key): float
    {
        if ($form === null) {
            return 0.0;
        }

        return self::parseKgValue($form[$key] ?? null);
    }

    private static function parseKgValue(mixed $value): float
    {
        if ($value === null || $value === '') {
            return 0.0;
        }
        if (is_numeric($value)) {
            return round((float) $value, 3);
        }

        return round((float) str_replace(',', '.', (string) $value), 3);
    }

    private static function sumKgArray(mixed $raw): float
    {
        if (! is_array($raw)) {
            return 0.0;
        }

        $sum = 0.0;
        foreach ($raw as $value) {
            $sum += self::parseKgValue($value);
        }

        return round($sum, 3);
    }
}
