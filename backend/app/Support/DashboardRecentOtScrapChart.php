<?php

namespace App\Support;

use App\Enums\WorkOrderBoardStage;
use App\Enums\WorkOrderStatus;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Desperdicio (kg) de las últimas OT finalizadas en producción, desglosado por área
 * solo cuando el área está marcada como finalizada en la planilla técnica.
 *
 * Criterio de OT cerrada alineado con el hub de supervisión: corte finalizado (closed)
 * o las 4 áreas núcleo / status completada (closed_complete).
 */
final class DashboardRecentOtScrapChart
{
    /**
     * @return list<array{
     *   work_order_id: int,
     *   code: string,
     *   label: string,
     *   closure: string,
     *   areas_finalized: array{montaje: bool, impresion: bool, laminacion: bool, corte: bool},
     *   impresion_kg: string,
     *   laminacion_kg: string,
     *   corte_kg: string,
     *   total_kg: string
     * }>
     */
    public static function rows(int $limit = 10): array
    {
        $driver = DB::connection()->getDriverName();
        $usesSqlJsonFilter = in_array($driver, ['mysql', 'mariadb'], true);
        $fetchLimit = $usesSqlJsonFilter ? $limit : max($limit * 50, 100);

        $query = DB::table('work_orders as wo')
            ->join('work_order_technical_documents as td', 'wo.id', '=', 'td.work_order_id')
            ->where('wo.status', '!=', WorkOrderStatus::Cancelled->value)
            ->whereNotNull('td.form');

        if ($usesSqlJsonFilter) {
            $query->where(function (Builder $inner): void {
                self::applyProductionClosedFilter($inner);
            });
        }

        $candidates = $query
            ->orderByDesc('wo.updated_at')
            ->limit($fetchLimit)
            ->get([
                'wo.id',
                'wo.code',
                'wo.status',
                'wo.board_stage',
                'td.form',
            ]);

        $rows = [];
        foreach ($candidates as $candidate) {
            if (count($rows) >= $limit) {
                break;
            }

            $form = self::decodeForm($candidate->form);
            if ($form === null) {
                continue;
            }

            if (! $usesSqlJsonFilter && ! self::isWorkOrderFinalized($form, $candidate)) {
                continue;
            }

            $rows[] = self::scrapRow(
                (int) $candidate->id,
                (string) $candidate->code,
                $form,
                $candidate,
            );
        }

        return array_reverse($rows);
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private static function isWorkOrderFinalized(array $form, object $workOrder): bool
    {
        if ($workOrder->status === WorkOrderStatus::Completed->value) {
            return true;
        }

        if ($workOrder->board_stage === WorkOrderBoardStage::Completada->value) {
            return true;
        }

        return self::isAreaFinalizada($form, 'corEstadoArea');
    }

    private static function applyProductionClosedFilter(Builder $query): void
    {
        $query->where('wo.status', WorkOrderStatus::Completed->value)
            ->orWhere('wo.board_stage', WorkOrderBoardStage::Completada->value)
            ->orWhereRaw("LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(td.form, '$.corEstadoArea')))) = 'finalizada'");
    }

    /**
     * @param  array<string, mixed>  $form
     * @return array{montaje: bool, impresion: bool, laminacion: bool, corte: bool}
     */
    private static function areasFinalized(array $form): array
    {
        return [
            'montaje' => self::isAreaFinalizada($form, 'montEstadoArea'),
            'impresion' => self::isAreaFinalizada($form, 'impEstadoArea'),
            'laminacion' => self::isAreaFinalizada($form, 'lamEstadoArea'),
            'corte' => self::isAreaFinalizada($form, 'corEstadoArea'),
        ];
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private static function closureKind(array $form, object $workOrder): string
    {
        if (
            $workOrder->status === WorkOrderStatus::Completed->value
            || $workOrder->board_stage === WorkOrderBoardStage::Completada->value
            || self::isCoreProductionComplete($form)
        ) {
            return 'closed_complete';
        }

        return 'closed';
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private static function isCoreProductionComplete(array $form): bool
    {
        foreach (['montEstadoArea', 'impEstadoArea', 'lamEstadoArea', 'corEstadoArea'] as $key) {
            if (! self::isAreaFinalizada($form, $key)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $form
     * @return array{
     *   work_order_id: int,
     *   code: string,
     *   label: string,
     *   closure: string,
     *   areas_finalized: array{montaje: bool, impresion: bool, laminacion: bool, corte: bool},
     *   impresion_kg: string,
     *   laminacion_kg: string,
     *   corte_kg: string,
     *   total_kg: string
     * }
     */
    private static function scrapRow(int $workOrderId, string $code, array $form, object $workOrder): array
    {
        $parseKg = static fn (?array $f, string $key): float => self::parseKg($f, $key);
        $areas = self::areasFinalized($form);

        $impKg = 0.0;
        if ($areas['impresion']) {
            $scrap = PlanillaScrapAggregator::resolvePrintingLaminacionScrap($form, $parseKg);
            $impKg = $scrap['imp_transparente'] + $scrap['imp_impreso'];
        }

        $lamKg = 0.0;
        if ($areas['laminacion']) {
            $scrap = PlanillaScrapAggregator::resolvePrintingLaminacionScrap($form, $parseKg);
            $lamKg = $scrap['lam_transparente'] + $scrap['lam_impreso'] + $scrap['lam_laminado'];
        }

        $corKg = 0.0;
        if ($areas['corte']) {
            $corte = PlanillaScrapAggregator::resolveCorteScrap($form, $parseKg);
            $corKg = $corte['refile'] + $corte['impreso'] + $corte['mal_corte'];
        }

        $total = $impKg + $lamKg + $corKg;

        return [
            'work_order_id' => $workOrderId,
            'code' => $code,
            'label' => self::shortCode($code),
            'closure' => self::closureKind($form, $workOrder),
            'areas_finalized' => $areas,
            'impresion_kg' => number_format($impKg, 3, '.', ''),
            'laminacion_kg' => number_format($lamKg, 3, '.', ''),
            'corte_kg' => number_format($corKg, 3, '.', ''),
            'total_kg' => number_format($total, 3, '.', ''),
        ];
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private static function isAreaFinalizada(array $form, string $key): bool
    {
        return strtolower(trim((string) ($form[$key] ?? ''))) === 'finalizada';
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function decodeForm(mixed $raw): ?array
    {
        if (is_array($raw)) {
            return $raw;
        }
        if (! is_string($raw) || trim($raw) === '') {
            return null;
        }
        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : null;
    }

    /**
     * @param  array<string, mixed>|null  $form
     */
    private static function parseKg(?array $form, string $key): float
    {
        if ($form === null || ! array_key_exists($key, $form)) {
            return 0.0;
        }
        $value = $form[$key];
        if ($value === null || $value === '') {
            return 0.0;
        }
        if (is_numeric($value)) {
            return round((float) $value, 3);
        }

        return round((float) str_replace(',', '.', (string) $value), 3);
    }

    private static function shortCode(string $code): string
    {
        if (preg_match('/(\d+)$/', $code, $matches)) {
            return '#'.$matches[1];
        }

        return $code;
    }
}
