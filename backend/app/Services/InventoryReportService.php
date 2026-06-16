<?php

namespace App\Services;

use App\Enums\InventoryArea;
use App\Models\Bobina;
use App\Models\Client;
use App\Models\CorteBobinaUsage;
use App\Models\InventoryReturn;
use App\Models\LaminacionBobinaUsage;
use App\Models\Material;
use App\Models\MontajeMaterialUsage;
use App\Models\PrintingBobinaUsage;
use App\Models\PrintingChemicalUsage;
use App\Models\PrintingInkControlLine;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\WorkOrder;
use App\Models\WorkOrderLaminacionSummary;
use App\Support\PlanillaScrapAggregator;
use App\Support\ProductionTimeLiveAggregator;
use App\Support\ScrapSubstrateCatalog;
use App\Support\ScrapSubstrateGroup;
use App\Support\WorkOrderProductionControlsAggregator;
use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class InventoryReportService
{
    /** Áreas con cronómetro MES en reportes de tiempo (Tintas no usa temporizador). */
    private const PRODUCTION_TIME_AREA_TABLES = [
        'printing' => 'printing_time_segments',
        'corte' => 'corte_time_segments',
        'laminacion' => 'laminacion_time_segments',
        'montaje' => 'montaje_time_segments',
    ];

    /**
     * Stock final del dia por material y area.
     *
     * @return array{
     *   report_date: string,
     *   area: string|null,
     *   area_label: string,
     *   show_micras_ancho: bool,
     *   generated_at: string,
     *   rows: list<array<string, mixed>>,
     *   totals: array<string, string>,
     *   materials_count: int
     * }
     */
    public function inventoryAreaDailySnapshot(Carbon $date, ?string $area = null): array
    {
        $start = $date->copy()->startOfDay();
        $end = $date->copy()->endOfDay();
        $hasMicrasAncho = Schema::hasColumns('materials', ['micras', 'ancho']);

        $afterDay = DB::table('inventory_movements as im')
            ->select('im.material_id')
            ->selectRaw("
                SUM(
                    CASE im.movement_type
                        WHEN 'in' THEN im.quantity
                        WHEN 'adjustment_add' THEN im.quantity
                        WHEN 'out' THEN -im.quantity
                        WHEN 'adjustment_sub' THEN -im.quantity
                        ELSE 0
                    END
                ) as net_after_day
            ")
            ->where('im.occurred_at', '>', $end)
            ->groupBy('im.material_id');

        $query = Material::query()
            ->from('materials as m')
            ->leftJoinSub($afterDay, 'after_day', fn ($join) => $join->on('after_day.material_id', '=', 'm.id'))
            ->orderBy('m.inventory_area')
            ->orderBy('m.sku')
            ->select([
                'm.id',
                'm.sku',
                'm.name',
                'm.inventory_area',
                'm.unit',
            ])
            ->selectRaw('COALESCE(m.quantity_on_hand, 0) as current_stock')
            ->selectRaw('COALESCE(after_day.net_after_day, 0) as net_after_day');

        if ($hasMicrasAncho) {
            $query->addSelect(['m.micras', 'm.ancho']);
        }

        if ($area !== null && $area !== '') {
            $query->where('m.inventory_area', $area);
        }

        $rows = $query->get();

        $totals = [
            'stock_final_dia' => '0.000',
        ];

        $normalized = $rows->map(function ($row) use (&$totals, $hasMicrasAncho) {
            $current = number_format((float) $row->current_stock, 3, '.', '');
            $netAfter = number_format((float) $row->net_after_day, 3, '.', '');
            $stockFinalDay = bcsub($current, $netAfter, 3);
            $totals['stock_final_dia'] = bcadd($totals['stock_final_dia'], $stockFinalDay, 3);

            return [
                'material_id' => (int) $row->id,
                'sku' => (string) $row->sku,
                'name' => (string) $row->name,
                'inventory_area' => (string) $row->inventory_area,
                'micras' => $hasMicrasAncho && $row->micras !== null ? number_format((float) $row->micras, 3, '.', '') : null,
                'ancho' => $hasMicrasAncho && $row->ancho !== null ? number_format((float) $row->ancho, 3, '.', '') : null,
                'unit' => (string) $row->unit,
                'stock_final_dia' => $stockFinalDay,
            ];
        })->values()->all();

        $showMicrasAncho = true;

        return [
            'report_date' => $start->toDateString(),
            'area' => $area,
            'area_label' => $this->inventoryAreaLabel($area),
            'show_micras_ancho' => $showMicrasAncho,
            'generated_at' => now()->toIso8601String(),
            'rows' => $normalized,
            'totals' => $totals,
            'materials_count' => count($normalized),
        ];
    }

    private function inventoryAreaLabel(?string $area): string
    {
        return match ($area) {
            InventoryArea::Material->value => 'Sustrato',
            InventoryArea::Tintas->value => 'Tintas',
            InventoryArea::CementerioTintas->value => 'Cementerio tintas',
            InventoryArea::Quimicos->value => 'Quimicos',
            InventoryArea::BobinasRechazadas->value => 'Bobinas rechazadas',
            InventoryArea::Miscelaneos->value => 'Miscelaneos',
            default => 'Todas las areas',
        };
    }

    /**
     * Convierte filas asociativas en CSV UTF-8.
     *
     * @param  list<array<string, mixed>>  $rows
     */
    public function rowsToCsv(
        array $rows,
        string $delimiter = ',',
        bool $excelFriendly = false,
        ?string $title = null,
    ): string
    {
        if ($rows === []) {
            return "no_data\n";
        }

        $headers = [];
        foreach ($rows as $row) {
            foreach (array_keys($row) as $key) {
                if (! in_array($key, $headers, true)) {
                    $headers[] = $key;
                }
            }
        }

        $stream = fopen('php://temp', 'r+');
        if ($excelFriendly) {
            // Fuerza separador al abrir en Excel con configuración regional es-VE/es-ES.
            fwrite($stream, "\xEF\xBB\xBF".'sep='.$delimiter."\r\n");
        }
        if ($title !== null && trim($title) !== '') {
            fputcsv($stream, [trim($title)], $delimiter);
        }
        fputcsv($stream, $headers, $delimiter);

        foreach ($rows as $row) {
            $line = [];
            foreach ($headers as $header) {
                $value = $row[$header] ?? null;
                if (is_array($value) || is_object($value)) {
                    $line[] = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

                    continue;
                }
                $line[] = $value;
            }
            fputcsv($stream, $line, $delimiter);
        }

        rewind($stream);
        $csv = stream_get_contents($stream);
        fclose($stream);

        return (string) $csv;
    }

    /**
     * Entrada/salida por fecha: detalle por día y tipo + totales por día.
     *
     * @return array{from: string, to: string, rows: list<array{day: string, movement_type: string, total_quantity: string, movement_count: int}>, by_day: list<array{day: string, totals_by_type: array<string, string>, rows: list<array<string, mixed>>>}
     */
    public function inventoryDaily(Carbon $from, Carbon $to): array
    {
        $driver = DB::connection()->getDriverName();
        $dateExpr = $driver === 'sqlite'
            ? "strftime('%Y-%m-%d', inventory_movements.occurred_at)"
            : 'DATE(inventory_movements.occurred_at)';

        $rows = DB::table('inventory_movements')
            ->whereBetween('inventory_movements.occurred_at', [$from, $to])
            ->selectRaw("$dateExpr as day")
            ->addSelect('inventory_movements.movement_type')
            ->selectRaw('SUM(inventory_movements.quantity) as total_quantity')
            ->selectRaw('COUNT(*) as movement_count')
            ->groupBy(DB::raw($dateExpr), 'inventory_movements.movement_type')
            ->orderBy('day')
            ->orderBy('inventory_movements.movement_type')
            ->get();

        $flat = $rows->map(function ($row) {
            return [
                'day' => (string) $row->day,
                'movement_type' => (string) $row->movement_type,
                'total_quantity' => number_format((float) $row->total_quantity, 3, '.', ''),
                'movement_count' => (int) $row->movement_count,
            ];
        })->values()->all();

        $types = ['in', 'out', 'adjustment_add', 'adjustment_sub'];
        $byDay = Collection::make($flat)->groupBy('day')->map(function (Collection $items, string $day) use ($types) {
            $totals = array_fill_keys($types, '0.000');
            foreach ($items as $row) {
                $t = $row['movement_type'];
                if (array_key_exists($t, $totals)) {
                    $totals[$t] = bcadd($totals[$t], $row['total_quantity'], 3);
                }
            }

            return [
                'day' => $day,
                'totals_by_type' => $totals,
                'rows' => $items->values()->all(),
            ];
        })->values()->all();

        return [
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'rows' => $flat,
            'by_day' => $byDay,
        ];
    }

    /**
     * Misma data que inventoryDaily, fila plana en CSV (UTF-8).
     */
    public function inventoryDailyCsv(Carbon $from, Carbon $to): string
    {
        $payload = $this->inventoryDaily($from, $to);
        $lines = ['day,movement_type,total_quantity,movement_count'];
        foreach ($payload['rows'] as $row) {
            $lines[] = sprintf(
                '%s,%s,%s,%d',
                $row['day'],
                $row['movement_type'],
                $row['total_quantity'],
                $row['movement_count'],
            );
        }

        return implode("\n", $lines);
    }

    /**
     * @param  array{movement_type?: string|null, inventory_area?: string|null, reference_type?: string|null, invalid_only?: bool|null}  $filters
     * @return array<string, mixed>
     */
    public function inventoryMovementsGeneralReport(Carbon $from, Carbon $to, array $filters = []): array
    {
        $baseQuery = DB::table('inventory_movements as im')
            ->leftJoin('materials as m', 'm.id', '=', 'im.material_id')
            ->leftJoin('users as u', 'u.id', '=', 'im.user_id')
            ->whereBetween('im.occurred_at', [$from, $to]);

        $this->applyInventoryMovementFilters($baseQuery, $filters);

        $entries = (string) ((clone $baseQuery)
            ->whereIn('im.movement_type', ['in', 'adjustment_add'])
            ->sum('im.quantity'));
        $exits = (string) ((clone $baseQuery)
            ->whereIn('im.movement_type', ['out', 'adjustment_sub'])
            ->sum('im.quantity'));
        $adjustmentAdd = (string) ((clone $baseQuery)
            ->where('im.movement_type', '=', 'adjustment_add')
            ->sum('im.quantity'));
        $adjustmentSub = (string) ((clone $baseQuery)
            ->where('im.movement_type', '=', 'adjustment_sub')
            ->sum('im.quantity'));
        $totalMoved = (string) ((clone $baseQuery)->sum('im.quantity'));
        $adjustmentTotal = bcadd($adjustmentAdd, $adjustmentSub, 3);
        $adjustmentPercent = bccomp($totalMoved, '0', 3) === 1
            ? number_format(((float) $adjustmentTotal / (float) $totalMoved) * 100, 2, '.', '')
            : '0.00';

        $driver = DB::connection()->getDriverName();
        $dateExpr = $driver === 'sqlite' ? "strftime('%Y-%m-%d', im.occurred_at)" : 'DATE(im.occurred_at)';
        $weekExpr = $driver === 'sqlite'
            ? "strftime('%Y-%W', im.occurred_at)"
            : "DATE_FORMAT(im.occurred_at, '%x-W%v')";

        $byDay = (clone $baseQuery)
            ->selectRaw("$dateExpr as day")
            ->selectRaw("SUM(CASE WHEN im.movement_type IN ('in', 'adjustment_add') THEN im.quantity ELSE 0 END) as entries_qty")
            ->selectRaw("SUM(CASE WHEN im.movement_type IN ('out', 'adjustment_sub') THEN im.quantity ELSE 0 END) as exits_qty")
            ->groupBy(DB::raw($dateExpr))
            ->orderBy('day')
            ->get()
            ->map(fn ($r) => [
                'period' => (string) $r->day,
                'entries_qty' => number_format((float) $r->entries_qty, 3, '.', ''),
                'exits_qty' => number_format((float) $r->exits_qty, 3, '.', ''),
            ])
            ->values()
            ->all();

        $byWeek = (clone $baseQuery)
            ->selectRaw("$weekExpr as week")
            ->selectRaw("SUM(CASE WHEN im.movement_type IN ('in', 'adjustment_add') THEN im.quantity ELSE 0 END) as entries_qty")
            ->selectRaw("SUM(CASE WHEN im.movement_type IN ('out', 'adjustment_sub') THEN im.quantity ELSE 0 END) as exits_qty")
            ->groupBy(DB::raw($weekExpr))
            ->orderBy('week')
            ->get()
            ->map(fn ($r) => [
                'period' => (string) $r->week,
                'entries_qty' => number_format((float) $r->entries_qty, 3, '.', ''),
                'exits_qty' => number_format((float) $r->exits_qty, 3, '.', ''),
            ])
            ->values()
            ->all();

        $topMaterials = (clone $baseQuery)
            ->select('m.id', 'm.sku', 'm.name', 'm.inventory_area', 'm.unit')
            ->selectRaw('SUM(im.quantity) as total_qty')
            ->selectRaw('COUNT(*) as movement_count')
            ->groupBy('m.id', 'm.sku', 'm.name', 'm.inventory_area', 'm.unit')
            ->orderByDesc('total_qty')
            ->limit(10)
            ->get()
            ->map(fn ($r) => [
                'material_id' => $r->id !== null ? (int) $r->id : null,
                'sku' => (string) ($r->sku ?? ''),
                'name' => (string) ($r->name ?? ''),
                'inventory_area' => (string) ($r->inventory_area ?? ''),
                'unit' => (string) ($r->unit ?? ''),
                'total_qty' => number_format((float) $r->total_qty, 3, '.', ''),
                'movement_count' => (int) $r->movement_count,
            ])
            ->values()
            ->all();

        $invalidRefQuery = (clone $baseQuery);
        $this->applyInvalidReferenceFilter($invalidRefQuery);

        $invalidReferenceCount = (clone $invalidRefQuery)->count();
        $invalidReferences = (clone $invalidRefQuery)
            ->select('im.id', 'im.occurred_at', 'im.reference_type', 'im.reference_id', 'im.movement_type', 'im.quantity', 'm.sku', 'm.name')
            ->orderByDesc('im.occurred_at')
            ->limit(50)
            ->get()
            ->map(fn ($r) => [
                'id' => (int) $r->id,
                'occurred_at' => (string) $r->occurred_at,
                'reference_type' => $r->reference_type !== null ? (string) $r->reference_type : null,
                'reference_id' => $r->reference_id !== null ? (int) $r->reference_id : null,
                'movement_type' => (string) $r->movement_type,
                'quantity' => number_format((float) $r->quantity, 3, '.', ''),
                'sku' => (string) ($r->sku ?? ''),
                'name' => (string) ($r->name ?? ''),
            ])
            ->values()
            ->all();

        $invalidIds = (clone $invalidRefQuery)->pluck('im.id')->all();
        $invalidLookup = array_fill_keys(array_map('intval', $invalidIds), true);

        $movements = (clone $baseQuery)
            ->select([
                'im.id',
                'im.occurred_at',
                'im.movement_type',
                'im.quantity',
                'im.reference_type',
                'im.reference_id',
                'm.sku as material_sku',
                'm.name as material_name',
                'm.inventory_area',
                'm.unit',
                'u.name as user_name',
            ])
            ->orderByDesc('im.occurred_at')
            ->orderByDesc('im.id')
            ->limit(500)
            ->get()
            ->map(function ($r) use ($invalidLookup) {
                $ref = ($r->reference_type !== null && $r->reference_id !== null)
                    ? $r->reference_type.' #'.$r->reference_id
                    : '—';

                return [
                    'id' => (int) $r->id,
                    'occurred_at' => (string) $r->occurred_at,
                    'movement_type' => (string) $r->movement_type,
                    'movement_label' => $this->inventoryMovementTypeLabel((string) $r->movement_type),
                    'quantity' => number_format((float) $r->quantity, 3, '.', ''),
                    'material_sku' => (string) ($r->material_sku ?? ''),
                    'material_name' => (string) ($r->material_name ?? ''),
                    'inventory_area' => (string) ($r->inventory_area ?? ''),
                    'unit' => (string) ($r->unit ?? ''),
                    'user_name' => (string) ($r->user_name ?? ''),
                    'reference' => $ref,
                    'is_invalid_reference' => isset($invalidLookup[(int) $r->id]),
                ];
            })
            ->values()
            ->all();

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'filters' => [
                'movement_type' => $filters['movement_type'] ?? null,
                'inventory_area' => $filters['inventory_area'] ?? null,
                'reference_type' => $filters['reference_type'] ?? null,
                'invalid_only' => (bool) ($filters['invalid_only'] ?? false),
            ],
            'summary' => [
                'entries_total' => number_format((float) $entries, 3, '.', ''),
                'exits_total' => number_format((float) $exits, 3, '.', ''),
                'adjustment_total' => number_format((float) $adjustmentTotal, 3, '.', ''),
                'adjustment_percent' => $adjustmentPercent,
                'invalid_reference_count' => (int) $invalidReferenceCount,
            ],
            'entries_vs_exits_by_day' => $byDay,
            'entries_vs_exits_by_week' => $byWeek,
            'top_materials' => $topMaterials,
            'invalid_references' => $invalidReferences,
            'movements' => $movements,
            'generated_at' => now()->toIso8601String(),
        ];
    }

    /**
     * @param  array{movement_type?: string|null, inventory_area?: string|null, reference_type?: string|null, invalid_only?: bool|null}  $filters
     */
    private function applyInventoryMovementFilters(QueryBuilder $query, array $filters): void
    {
        if (! empty($filters['movement_type'])) {
            $query->where('im.movement_type', '=', $filters['movement_type']);
        }
        if (! empty($filters['inventory_area'])) {
            $query->where('m.inventory_area', '=', $filters['inventory_area']);
        }
        if (! empty($filters['reference_type'])) {
            $query->where('im.reference_type', '=', $filters['reference_type']);
        }
        if (! empty($filters['invalid_only']) && (bool) $filters['invalid_only'] === true) {
            $this->applyInvalidReferenceFilter($query);
        }
    }

    private function applyInvalidReferenceFilter(QueryBuilder $query): void
    {
        $query->where(function ($q) {
            $q->whereNull('im.reference_type')
                ->orWhere(function ($q2) {
                    $q2->where('im.reference_type', '!=', 'inventory_adjustment')
                        ->whereNull('im.reference_id');
                })
                ->orWhereNotIn('im.reference_type', [
                    'purchase_receipt',
                    'miscellaneous_receipt',
                    'material_request',
                    'inventory_return',
                    'inventory_adjustment',
                ])
                ->orWhere(function ($q2) {
                    $q2->where('im.reference_type', '=', 'purchase_receipt')
                        ->whereNotExists(function ($x) {
                            $x->selectRaw('1')
                                ->from('purchase_receipts as pr')
                                ->whereColumn('pr.id', 'im.reference_id');
                        });
                })
                ->orWhere(function ($q2) {
                    $q2->where('im.reference_type', '=', 'miscellaneous_receipt')
                        ->whereNotExists(function ($x) {
                            $x->selectRaw('1')
                                ->from('miscellaneous_receipts as mr')
                                ->whereColumn('mr.id', 'im.reference_id');
                        });
                })
                ->orWhere(function ($q2) {
                    $q2->where('im.reference_type', '=', 'material_request')
                        ->whereNotExists(function ($x) {
                            $x->selectRaw('1')
                                ->from('material_requests as rq')
                                ->whereColumn('rq.id', 'im.reference_id');
                        });
                })
                ->orWhere(function ($q2) {
                    $q2->where('im.reference_type', '=', 'inventory_return')
                        ->whereNotExists(function ($x) {
                            $x->selectRaw('1')
                                ->from('inventory_returns as ir')
                                ->whereColumn('ir.id', 'im.reference_id');
                        });
                });
        });
    }

    private function inventoryMovementTypeLabel(string $type): string
    {
        return match ($type) {
            'in' => 'Entrada',
            'out' => 'Salida',
            'adjustment_add' => 'Ajuste +',
            'adjustment_sub' => 'Ajuste -',
            default => $type,
        };
    }

    /**
     * @return array<string, mixed>
     */
    public function workOrderMaterialSummary(int $workOrderId): array
    {
        $wo = WorkOrder::query()
            ->with([
                'client:id,name',
                'product:id,name',
                'clientOrder:id,code',
            ])
            ->findOrFail($workOrderId);

        $dispatched = DB::table('inventory_movements as im')
            ->join('material_requests as mr', function ($join) {
                $join->on('im.reference_id', '=', 'mr.id')
                    ->where('im.reference_type', '=', 'material_request');
            })
            ->join('materials as m', 'im.material_id', '=', 'm.id')
            ->where('mr.work_order_id', $workOrderId)
            ->where('im.movement_type', 'out')
            ->groupBy('im.material_id', 'm.sku', 'm.name', 'm.unit')
            ->orderBy('m.sku')
            ->selectRaw('im.material_id, m.sku, m.name, m.unit, SUM(im.quantity) as total_quantity')
            ->get()
            ->map(fn ($r) => [
                'material_id' => (int) $r->material_id,
                'sku' => $r->sku,
                'name' => $r->name,
                'unit' => $r->unit,
                'total_quantity_out' => number_format((float) $r->total_quantity, 3, '.', ''),
            ])
            ->values()
            ->all();

        $printingUsage = PrintingBobinaUsage::query()
            ->where('work_order_id', $workOrderId)
            ->with('material:id,sku,name,unit')
            ->orderByDesc('id')
            ->get()
            ->map(fn (PrintingBobinaUsage $u) => [
                'id' => $u->getKey(),
                'material_id' => $u->material_id,
                'sku' => $u->material?->sku,
                'quantity_used_kg' => number_format((float) $u->quantity_used_kg, 3, '.', ''),
                'quantity_finished_kg' => number_format((float) $u->quantity_finished_kg, 3, '.', ''),
                'bobina_id' => $u->bobina_id,
                'notes' => $u->notes,
            ])
            ->values()
            ->all();

        $corteUsage = CorteBobinaUsage::query()
            ->where('work_order_id', $workOrderId)
            ->with('material:id,sku,name,unit')
            ->orderByDesc('id')
            ->get()
            ->map(fn (CorteBobinaUsage $u) => [
                'id' => $u->getKey(),
                'material_id' => $u->material_id,
                'sku' => $u->material?->sku,
                'quantity_used_kg' => number_format((float) $u->quantity_used_kg, 3, '.', ''),
                'quantity_finished_kg' => number_format((float) $u->quantity_finished_kg, 3, '.', ''),
                'bobina_id' => $u->bobina_id,
                'notes' => $u->notes,
            ])
            ->values()
            ->all();

        $laminacionUsage = LaminacionBobinaUsage::query()
            ->where('work_order_id', $workOrderId)
            ->with('material:id,sku,name,unit')
            ->orderByDesc('id')
            ->get()
            ->map(fn (LaminacionBobinaUsage $u) => [
                'id' => $u->getKey(),
                'material_id' => $u->material_id,
                'sku' => $u->material?->sku,
                'quantity_used_kg' => number_format((float) $u->quantity_used_kg, 3, '.', ''),
                'quantity_finished_kg' => number_format((float) $u->quantity_finished_kg, 3, '.', ''),
                'bobina_id' => $u->bobina_id,
                'notes' => $u->notes,
            ])
            ->values()
            ->all();

        $montajeUsage = MontajeMaterialUsage::query()
            ->where('work_order_id', $workOrderId)
            ->with('material:id,sku,name,unit')
            ->orderByDesc('id')
            ->get()
            ->map(fn (MontajeMaterialUsage $u) => [
                'id' => $u->getKey(),
                'material_id' => $u->material_id,
                'sku' => $u->material?->sku,
                'quantity' => number_format((float) $u->quantity, 3, '.', ''),
                'unit' => $u->unit,
                'notes' => $u->notes,
            ])
            ->values()
            ->all();

        $returns = InventoryReturn::query()
            ->where('work_order_id', $workOrderId)
            ->with('material:id,sku,name')
            ->orderByDesc('id')
            ->get()
            ->map(fn (InventoryReturn $r) => [
                'id' => $r->getKey(),
                'material_id' => $r->material_id,
                'sku' => $r->material?->sku,
                'quantity' => number_format((float) $r->quantity, 3, '.', ''),
                'status' => $r->status,
                'destination_area' => $r->destination_area,
            ])
            ->values()
            ->all();

        return [
            'work_order' => [
                'id' => $wo->getKey(),
                'code' => $wo->code,
                'client_id' => $wo->client_id,
                'client_name' => $wo->client?->name,
                'product_id' => $wo->product_id,
                'product_name' => $wo->product?->name,
                'client_order_id' => $wo->client_order_id,
                'client_order_code' => $wo->clientOrder?->code,
            ],
            'dispatch_by_material' => $dispatched,
            'printing_bobina_usages' => $printingUsage,
            'corte_bobina_usages' => $corteUsage,
            'laminacion_bobina_usages' => $laminacionUsage,
            'montaje_material_usages' => $montajeUsage,
            'inventory_returns' => $returns,
        ];
    }

    /**
     * Resumen de controles de producción por OT: consumibles y tiempos agregados de impresión, laminación y corte.
     *
     * @return array{
     *   work_order: array<string, mixed>,
     *   consumables: array<string, mixed>,
     *   times: array<string, mixed>,
     *   generated_at: string
     * }
     */
    public function workOrderControlsSummary(int $workOrderId): array
    {
        $wo = WorkOrder::query()
            ->with([
                'client:id,name',
                'product:id,name',
                'clientOrder:id,code',
            ])
            ->findOrFail($workOrderId);

        $controlAreas = [
            'printing' => [
                'label' => 'Impresión',
                'time_table' => 'printing_time_segments',
            ],
            'laminacion' => [
                'label' => 'Laminación',
                'time_table' => 'laminacion_time_segments',
            ],
            'corte' => [
                'label' => 'Corte',
                'time_table' => 'corte_time_segments',
            ],
        ];

        $printingBobinas = PrintingBobinaUsage::query()
            ->where('work_order_id', $workOrderId)
            ->with('material:id,sku,name,unit')
            ->orderByDesc('id')
            ->get()
            ->map(fn (PrintingBobinaUsage $u) => [
                'id' => $u->getKey(),
                'material_id' => $u->material_id,
                'sku' => $u->material?->sku,
                'name' => $u->material?->name,
                'unit' => $u->material?->unit ?? 'kg',
                'quantity_used_kg' => number_format((float) $u->quantity_used_kg, 3, '.', ''),
                'quantity_finished_kg' => number_format((float) $u->quantity_finished_kg, 3, '.', ''),
                'bobina_id' => $u->bobina_id,
                'notes' => $u->notes,
            ])
            ->values()
            ->all();

        $printingInks = PrintingInkControlLine::query()
            ->where('work_order_id', $workOrderId)
            ->with('material:id,sku,name,unit')
            ->orderBy('position')
            ->orderBy('id')
            ->get()
            ->map(fn (PrintingInkControlLine $line) => [
                'id' => $line->getKey(),
                'material_id' => $line->material_id,
                'sku' => $line->material?->sku,
                'name' => $line->material?->name,
                'quantity_original_kg' => number_format((float) $line->quantity_original_kg, 3, '.', ''),
                'quantity_solventada_kg' => number_format((float) $line->quantity_solventada_kg, 3, '.', ''),
                'quantity_return_kg' => number_format((float) $line->quantity_return_kg, 3, '.', ''),
                'quantity_consumed_kg' => $line->quantity_consumed_kg,
                'notes' => $line->notes,
            ])
            ->values()
            ->all();

        $printingChemicals = PrintingChemicalUsage::query()
            ->where('work_order_id', $workOrderId)
            ->orderBy('chemical_type')
            ->get()
            ->map(fn (PrintingChemicalUsage $c) => [
                'id' => $c->getKey(),
                'chemical_type' => $c->chemical_type,
                'quantity_loaded_kg' => number_format((float) $c->quantity_loaded_kg, 3, '.', ''),
                'quantity_return_kg' => number_format((float) $c->quantity_return_kg, 3, '.', ''),
                'quantity_consumed_kg' => $c->quantity_consumed_kg,
                'notes' => $c->notes,
            ])
            ->values()
            ->all();

        $laminacionBobinas = LaminacionBobinaUsage::query()
            ->where('work_order_id', $workOrderId)
            ->with('material:id,sku,name,unit')
            ->orderByDesc('id')
            ->get()
            ->map(fn (LaminacionBobinaUsage $u) => [
                'id' => $u->getKey(),
                'material_id' => $u->material_id,
                'sku' => $u->material?->sku,
                'name' => $u->material?->name,
                'unit' => $u->material?->unit ?? 'kg',
                'quantity_used_kg' => number_format((float) $u->quantity_used_kg, 3, '.', ''),
                'quantity_finished_kg' => number_format((float) $u->quantity_finished_kg, 3, '.', ''),
                'bobina_id' => $u->bobina_id,
                'notes' => $u->notes,
            ])
            ->values()
            ->all();

        $laminacionSummary = WorkOrderLaminacionSummary::query()
            ->where('work_order_id', $workOrderId)
            ->first();

        $corteBobinas = CorteBobinaUsage::query()
            ->where('work_order_id', $workOrderId)
            ->with('material:id,sku,name,unit')
            ->orderByDesc('id')
            ->get()
            ->map(fn (CorteBobinaUsage $u) => [
                'id' => $u->getKey(),
                'material_id' => $u->material_id,
                'sku' => $u->material?->sku,
                'name' => $u->material?->name,
                'unit' => $u->material?->unit ?? 'kg',
                'quantity_used_kg' => number_format((float) $u->quantity_used_kg, 3, '.', ''),
                'quantity_finished_kg' => number_format((float) $u->quantity_finished_kg, 3, '.', ''),
                'bobina_id' => $u->bobina_id,
                'notes' => $u->notes,
            ])
            ->values()
            ->all();

        $consumablesByArea = [
            'printing' => [
                'area' => 'printing',
                'area_label' => $controlAreas['printing']['label'],
                'bobina_usages' => $printingBobinas,
                'ink_control_lines' => $printingInks,
                'chemical_usages' => $printingChemicals,
            ],
            'laminacion' => [
                'area' => 'laminacion',
                'area_label' => $controlAreas['laminacion']['label'],
                'bobina_usages' => $laminacionBobinas,
                'solvent_quantity_kg' => $laminacionSummary !== null
                    ? number_format((float) ($laminacionSummary->solvent_quantity_kg ?? 0), 3, '.', '')
                    : '0.000',
                'solvent_notes' => $laminacionSummary?->solvent_notes,
            ],
            'corte' => [
                'area' => 'corte',
                'area_label' => $controlAreas['corte']['label'],
                'bobina_usages' => $corteBobinas,
            ],
        ];

        $timesByArea = [];
        $timeTotals = [
            'production_seconds' => 0,
            'downtime_seconds' => 0,
            'mount_seconds' => 0,
        ];

        foreach ($controlAreas as $areaKey => $meta) {
            $byType = $this->sumClosedTimeSegmentsForWorkOrder($meta['time_table'], $workOrderId);
            $areaRow = [
                'area' => $areaKey,
                'area_label' => $meta['label'],
                'production_seconds' => $byType['production'],
                'downtime_seconds' => $byType['downtime'],
                'mount_seconds' => $byType['mount'],
                'total_seconds' => $byType['production'] + $byType['downtime'] + $byType['mount'],
            ];
            $timesByArea[] = $areaRow;
            $timeTotals['production_seconds'] += $byType['production'];
            $timeTotals['downtime_seconds'] += $byType['downtime'];
            $timeTotals['mount_seconds'] += $byType['mount'];
        }

        $timeTotals['total_seconds'] = $timeTotals['production_seconds']
            + $timeTotals['downtime_seconds']
            + $timeTotals['mount_seconds'];

        $totalAll = $timeTotals['total_seconds'];
        $timeTotals['effective_percent'] = $totalAll > 0
            ? number_format(round(($timeTotals['production_seconds'] / $totalAll) * 100, 2), 2, '.', '')
            : '0.00';

        return [
            'work_order' => [
                'id' => $wo->getKey(),
                'code' => $wo->code,
                'status' => $wo->status,
                'client_id' => $wo->client_id,
                'client_name' => $wo->client?->name,
                'product_id' => $wo->product_id,
                'product_name' => $wo->product?->name,
                'client_order_id' => $wo->client_order_id,
                'client_order_code' => $wo->clientOrder?->code,
            ],
            'production_summary' => WorkOrderProductionControlsAggregator::summarize($workOrderId),
            'consumables' => [
                'by_area' => $consumablesByArea,
            ],
            'times' => [
                'by_area' => $timesByArea,
                'totals' => $timeTotals,
            ],
            'generated_at' => now()->toIso8601String(),
        ];
    }

    /**
     * @return array{production: int, downtime: int, mount: int, demount: int}
     */
    private function sumClosedTimeSegmentsForWorkOrder(string $table, int $workOrderId): array
    {
        $driver = DB::connection()->getDriverName();
        $secondsExpr = $driver === 'sqlite'
            ? "(CAST(strftime('%s', {$table}.ended_at) AS INTEGER) - CAST(strftime('%s', {$table}.started_at) AS INTEGER))"
            : "TIMESTAMPDIFF(SECOND, {$table}.started_at, {$table}.ended_at)";

        $byType = [
            'production' => 0,
            'downtime' => 0,
            'mount' => 0,
            'demount' => 0,
        ];

        $rows = DB::table($table)
            ->where('work_order_id', $workOrderId)
            ->whereNotNull('ended_at')
            ->select('segment_type')
            ->selectRaw("SUM({$secondsExpr}) as total_seconds")
            ->groupBy('segment_type')
            ->get();

        foreach ($rows as $row) {
            $type = (string) $row->segment_type;
            if (! array_key_exists($type, $byType)) {
                continue;
            }
            $byType[$type] = (int) $row->total_seconds;
        }

        return $byType;
    }

    /**
     * Segundos de montaje/producción/tiempo muerto por área y máquina (PDF reportes de tiempos).
     *
     * @return array{from: string, to: string, rows: list<array<string, mixed>>, live?: bool, live_as_of?: string}
     */
    public function productionTimesByArea(Carbon $from, Carbon $to, bool $live = false): array
    {
        $rows = [];
        foreach (self::PRODUCTION_TIME_AREA_TABLES as $area => $table) {
            $rows = array_merge($rows, $this->sumClosedSegmentsForTable($table, $area, $from, $to));
        }

        if ($live) {
            $rows = app(ProductionTimeLiveAggregator::class)->augmentAreaRows($rows, $from, $to);
        }

        $payload = [
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'rows' => $rows,
        ];

        if ($live) {
            $payload['live'] = true;
            $payload['live_as_of'] = now()->toIso8601String();
        }

        return $payload;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function sumClosedSegmentsForTable(string $table, string $area, Carbon $from, Carbon $to): array
    {
        $driver = DB::connection()->getDriverName();
        $secondsExpr = $driver === 'sqlite'
            ? "(CAST(strftime('%s', {$table}.ended_at) AS INTEGER) - CAST(strftime('%s', {$table}.started_at) AS INTEGER))"
            : "TIMESTAMPDIFF(SECOND, {$table}.started_at, {$table}.ended_at)";

        $groups = DB::table($table)
            ->whereNotNull('ended_at')
            ->whereBetween('started_at', [$from, $to])
            ->select('segment_type')
            ->selectRaw('COALESCE(machine_code, \'\') as machine_code')
            ->selectRaw("SUM({$secondsExpr}) as total_seconds")
            ->selectRaw('COUNT(*) as segment_count')
            ->groupBy(['segment_type', DB::raw("COALESCE(machine_code, '')")])
            ->get();

        $out = [];
        foreach ($groups as $g) {
            $out[] = [
                'area' => $area,
                'segment_type' => $g->segment_type,
                'machine_code' => (string) $g->machine_code,
                'total_seconds' => (int) $g->total_seconds,
                'segment_count' => (int) $g->segment_count,
            ];
        }

        return $out;
    }

    /**
     * OT con al menos un segmento cerrado y duración &gt; 0 en el rango, por área productiva.
     * Incluye totales de tiempo efectivo, muerto, montaje y desmontaje (todas las áreas) y nombre de producto.
     *
     * @return array{
     *   from: string,
     *   to: string,
     *   work_orders: list<array{
     *     work_order_id: int,
     *     work_order_code: string,
     *     client_name: string|null,
     *     product_name: string|null,
     *     areas: list<string>,
     *     production_seconds: int,
     *     downtime_seconds: int,
     *     mount_seconds: int,
     *     demount_seconds: int,
     *     total_seconds: int,
     *     effective_percent: string
     *   }>
     * }
     */
    public function workOrderTimeReportCandidates(Carbon $from, Carbon $to, bool $live = false): array
    {
        $tables = self::PRODUCTION_TIME_AREA_TABLES;
        $areaOrder = array_keys($tables);
        $driver = DB::connection()->getDriverName();

        /** @var array<int, array{areas: array<string, true>, production_seconds: int, downtime_seconds: int, mount_seconds: int, demount_seconds: int}> */
        $byWo = [];

        foreach ($tables as $area => $table) {
            $secondsExprAgg = $driver === 'sqlite'
                ? "(CAST(strftime('%s', {$table}.ended_at) AS INTEGER) - CAST(strftime('%s', {$table}.started_at) AS INTEGER))"
                : "TIMESTAMPDIFF(SECOND, {$table}.started_at, {$table}.ended_at)";

            $rows = DB::table($table)
                ->whereNotNull('ended_at')
                ->whereBetween('started_at', [$from, $to])
                ->select('work_order_id', 'segment_type')
                ->selectRaw("SUM({$secondsExprAgg}) as total_seconds")
                ->groupBy('work_order_id', 'segment_type')
                ->havingRaw("SUM({$secondsExprAgg}) > 0")
                ->get();

            foreach ($rows as $row) {
                $id = (int) $row->work_order_id;
                if ($id < 1) {
                    continue;
                }
                $type = (string) $row->segment_type;
                if (! in_array($type, ['production', 'downtime', 'mount', 'demount'], true)) {
                    continue;
                }
                if (! isset($byWo[$id])) {
                    $byWo[$id] = [
                        'areas' => [],
                        'production_seconds' => 0,
                        'downtime_seconds' => 0,
                        'mount_seconds' => 0,
                        'demount_seconds' => 0,
                    ];
                }
                $byWo[$id]['areas'][$area] = true;
                $sec = (int) $row->total_seconds;
                if ($type === 'production') {
                    $byWo[$id]['production_seconds'] += $sec;
                } elseif ($type === 'downtime') {
                    $byWo[$id]['downtime_seconds'] += $sec;
                } elseif ($type === 'mount') {
                    $byWo[$id]['mount_seconds'] += $sec;
                } else {
                    $byWo[$id]['demount_seconds'] += $sec;
                }
            }
        }

        if ($live) {
            $byWo = app(ProductionTimeLiveAggregator::class)->augmentByWorkOrder($byWo, $from, $to);
        }

        if ($byWo === []) {
            $payload = [
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
                'work_orders' => [],
            ];
            if ($live) {
                $payload['live'] = true;
                $payload['live_as_of'] = now()->toIso8601String();
                $payload['live_active'] = app(ProductionTimeLiveAggregator::class)
                    ->collectLiveActiveEntries($from, $to);
            }

            return $payload;
        }

        $workOrders = WorkOrder::query()
            ->whereIn('id', array_keys($byWo))
            ->with(['client:id,name', 'product:id,name'])
            ->get(['id', 'code', 'client_id', 'product_id']);

        $out = [];
        foreach ($workOrders as $wo) {
            $id = (int) $wo->getKey();
            if (! isset($byWo[$id])) {
                continue;
            }
            $bucket = $byWo[$id];
            $areas = array_keys($bucket['areas']);
            usort($areas, function (string $a, string $b) use ($areaOrder): int {
                return array_search($a, $areaOrder, true) <=> array_search($b, $areaOrder, true);
            });
            $production = $bucket['production_seconds'];
            $downtime = $bucket['downtime_seconds'];
            $mount = $bucket['mount_seconds'];
            $demount = $bucket['demount_seconds'];
            $total = $production + $downtime + $mount + $demount;
            $effectivePct = $total > 0 ? round(($production / $total) * 100, 2) : 0.0;

            $out[] = [
                'work_order_id' => $id,
                'work_order_code' => (string) $wo->code,
                'client_name' => $wo->client?->name,
                'product_name' => $wo->product?->name,
                'areas' => $areas,
                'production_seconds' => $production,
                'downtime_seconds' => $downtime,
                'mount_seconds' => $mount,
                'demount_seconds' => $demount,
                'total_seconds' => $total,
                'effective_percent' => number_format($effectivePct, 2, '.', ''),
            ];
        }

        usort($out, fn (array $x, array $y): int => strcmp((string) $x['work_order_code'], (string) $y['work_order_code']));

        if ($live) {
            $out = array_values(array_filter($out, fn (array $row): bool => (int) ($row['total_seconds'] ?? 0) > 0));
        }

        $payload = [
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'work_orders' => $out,
        ];

        if ($live) {
            $payload['live'] = true;
            $payload['live_as_of'] = now()->toIso8601String();
            $payload['live_active'] = app(ProductionTimeLiveAggregator::class)
                ->collectLiveActiveEntries($from, $to);
        }

        return $payload;
    }

    /**
     * Reporte detallado de tiempos por OT y/o rango de fechas.
     * Agrega segmentos cerrados (efectivo / muerto / montaje / desmontaje) de las cinco áreas
     * y devuelve también el detalle de cada parada con el motivo.
     *
     * @return array{
     *   from: string,
     *   to: string,
     *   work_order_id: int|null,
     *   work_order: array<string, mixed>|null,
     *   summary: list<array<string, mixed>>,
     *   totals: array<string, mixed>,
     *   downtimes: list<array<string, mixed>>,
     *   rows_csv: list<array<string, mixed>>,
     *   generated_at: string
     * }
     */
    public function workOrderTimeReport(Carbon $from, Carbon $to, ?int $workOrderId = null): array
    {
        $tables = self::PRODUCTION_TIME_AREA_TABLES;

        $driver = DB::connection()->getDriverName();

        $summary = [];
        $totals = [
            'production_seconds' => 0,
            'downtime_seconds' => 0,
            'mount_seconds' => 0,
            'demount_seconds' => 0,
            'total_seconds' => 0,
        ];
        $downtimes = [];
        $rowsCsv = [];

        foreach ($tables as $area => $table) {
            $secondsExprAgg = $driver === 'sqlite'
                ? "(CAST(strftime('%s', {$table}.ended_at) AS INTEGER) - CAST(strftime('%s', {$table}.started_at) AS INTEGER))"
                : "TIMESTAMPDIFF(SECOND, {$table}.started_at, {$table}.ended_at)";

            $secondsExprAlias = $driver === 'sqlite'
                ? "(CAST(strftime('%s', t.ended_at) AS INTEGER) - CAST(strftime('%s', t.started_at) AS INTEGER))"
                : 'TIMESTAMPDIFF(SECOND, t.started_at, t.ended_at)';

            $aggQuery = DB::table($table)
                ->whereNotNull('ended_at')
                ->whereBetween('started_at', [$from, $to])
                ->select('segment_type')
                ->selectRaw("SUM({$secondsExprAgg}) as total_seconds")
                ->selectRaw('COUNT(*) as segment_count')
                ->groupBy('segment_type');

            if ($workOrderId !== null) {
                $aggQuery->where('work_order_id', $workOrderId);
            }

            $byType = [
                'production' => 0,
                'downtime' => 0,
                'mount' => 0,
                'demount' => 0,
            ];
            $countByType = [
                'production' => 0,
                'downtime' => 0,
                'mount' => 0,
                'demount' => 0,
            ];
            foreach ($aggQuery->get() as $g) {
                $type = (string) $g->segment_type;
                if (! array_key_exists($type, $byType)) {
                    continue;
                }
                $byType[$type] = (int) $g->total_seconds;
                $countByType[$type] = (int) $g->segment_count;
            }

            $areaTotal = $byType['production'] + $byType['downtime'] + $byType['mount'] + $byType['demount'];
            $effectivePct = $areaTotal > 0
                ? round(($byType['production'] / $areaTotal) * 100, 2)
                : 0.0;

            if ($areaTotal > 0) {
                $summary[] = [
                    'area' => $area,
                    'production_seconds' => $byType['production'],
                    'downtime_seconds' => $byType['downtime'],
                    'mount_seconds' => $byType['mount'],
                    'demount_seconds' => $byType['demount'],
                    'total_seconds' => $areaTotal,
                    'production_count' => $countByType['production'],
                    'downtime_count' => $countByType['downtime'],
                    'mount_count' => $countByType['mount'],
                    'demount_count' => $countByType['demount'],
                    'effective_percent' => number_format($effectivePct, 2, '.', ''),
                ];
            }

            $totals['production_seconds'] += $byType['production'];
            $totals['downtime_seconds'] += $byType['downtime'];
            $totals['mount_seconds'] += $byType['mount'];
            $totals['demount_seconds'] += $byType['demount'];
            $totals['total_seconds'] += $areaTotal;

            $downQuery = DB::table($table.' as t')
                ->leftJoin('work_orders as wo', 't.work_order_id', '=', 'wo.id')
                ->leftJoin('users as u', 't.user_id', '=', 'u.id')
                ->whereNotNull('t.ended_at')
                ->where('t.segment_type', 'downtime')
                ->whereBetween('t.started_at', [$from, $to])
                ->orderBy('t.started_at')
                ->select([
                    't.id',
                    't.work_order_id',
                    'wo.code as work_order_code',
                    't.started_at',
                    't.ended_at',
                    't.notes',
                    't.machine_code',
                    'u.name as user_name',
                ])
                ->selectRaw("({$secondsExprAlias}) as duration_seconds");

            if ($workOrderId !== null) {
                $downQuery->where('t.work_order_id', $workOrderId);
            }

            foreach ($downQuery->get() as $row) {
                $downtimes[] = [
                    'id' => (int) $row->id,
                    'area' => $area,
                    'work_order_id' => $row->work_order_id !== null ? (int) $row->work_order_id : null,
                    'work_order_code' => $row->work_order_code,
                    'machine_code' => (string) ($row->machine_code ?? ''),
                    'started_at' => $row->started_at,
                    'ended_at' => $row->ended_at,
                    'duration_seconds' => (int) $row->duration_seconds,
                    'reason' => trim((string) ($row->notes ?? '')),
                    'user_name' => $row->user_name,
                ];
            }

            $rowsCsv[] = [
                'section' => 'summary',
                'area' => $area,
                'production_seconds' => $byType['production'],
                'downtime_seconds' => $byType['downtime'],
                'mount_seconds' => $byType['mount'],
                'demount_seconds' => $byType['demount'],
                'total_seconds' => $areaTotal,
                'effective_percent' => number_format($effectivePct, 2, '.', ''),
            ];
        }

        foreach ($downtimes as $d) {
            $rowsCsv[] = [
                'section' => 'downtime',
                'area' => $d['area'],
                'work_order_id' => $d['work_order_id'],
                'work_order_code' => $d['work_order_code'],
                'machine_code' => $d['machine_code'],
                'started_at' => $d['started_at'],
                'ended_at' => $d['ended_at'],
                'duration_seconds' => $d['duration_seconds'],
                'reason' => $d['reason'],
                'user_name' => $d['user_name'],
            ];
        }

        $woMeta = null;
        if ($workOrderId !== null) {
            /** @var WorkOrder|null $wo */
            $wo = WorkOrder::query()->with(['client:id,name', 'product:id,name'])->find($workOrderId);
            if ($wo !== null) {
                $woMeta = [
                    'id' => $wo->getKey(),
                    'code' => $wo->code,
                    'status' => $wo->status,
                    'client_id' => $wo->client_id,
                    'client_name' => $wo->client?->name,
                    'product_id' => $wo->product_id,
                    'product_name' => $wo->product?->name,
                ];
            }
        }

        $totalsAll = $totals['total_seconds'];
        $totals['effective_percent'] = $totalsAll > 0
            ? number_format(round(($totals['production_seconds'] / $totalsAll) * 100, 2), 2, '.', '')
            : '0.00';

        return [
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'work_order_id' => $workOrderId,
            'work_order' => $woMeta,
            'summary' => $summary,
            'totals' => $totals,
            'downtimes' => $downtimes,
            'rows_csv' => $rowsCsv,
            'generated_at' => now()->toIso8601String(),
        ];
    }

    /**
     * Desperdicio registrado por OT: % por área (layouts detail / by_work_order / by_area) o historial en kg desde la planilla (history_kg).
     *
     * @return array{from: string, to: string, substrate_group: string, layout: string, rows: list<array<string, mixed>>}
     */
    public function scrapByFilters(
        Carbon $from,
        Carbon $to,
        ?int $clientId = null,
        ?int $productId = null,
        string $substrateGroup = 'all',
        string $layout = 'detail',
        ?int $workOrderId = null,
    ): array {
        $substrateGroup = ScrapSubstrateCatalog::normalizeGroupId($substrateGroup);
        $substrateGroup = in_array($substrateGroup, ScrapSubstrateCatalog::allowedCanonical(), true)
            ? $substrateGroup
            : 'all';
        $layout = in_array($layout, ['detail', 'by_work_order', 'by_area', 'history_kg'], true) ? $layout : 'detail';

        if ($layout === 'history_kg') {
            $rows = $this->scrapHistoryKgRows($from, $to, $clientId, $productId, $substrateGroup, $workOrderId);

            return [
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
                'substrate_group' => $substrateGroup,
                'layout' => 'history_kg',
                'rows' => $rows,
            ];
        }

        if ($layout === 'by_work_order') {
            $historyRows = $this->scrapHistoryKgRows($from, $to, $clientId, $productId, 'all', $workOrderId);
            $rows = $this->scrapRowsPivotByWorkOrderKg($historyRows);

            return [
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
                'substrate_group' => 'all',
                'layout' => 'by_work_order',
                'rows' => $rows,
            ];
        }

        if ($layout === 'by_area') {
            $historyRows = $this->scrapHistoryKgRows($from, $to, $clientId, $productId, 'all', $workOrderId);
            $rows = $this->scrapRowsAggregateByAreaKg($historyRows);

            return [
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
                'substrate_group' => 'all',
                'layout' => 'by_area',
                'rows' => $rows,
            ];
        }

        $defs = [
            ['area' => 'printing', 'table' => 'work_order_printing_summaries'],
            ['area' => 'corte', 'table' => 'work_order_corte_summaries'],
            ['area' => 'laminacion', 'table' => 'work_order_laminacion_summaries'],
            ['area' => 'montaje', 'table' => 'work_order_montaje_summaries'],
        ];
        $detailRows = [];
        foreach ($defs as $def) {
            $q = DB::table($def['table'].' as s')
                ->join('work_orders as wo', 's.work_order_id', '=', 'wo.id')
                ->leftJoin('work_order_technical_documents as td', 'wo.id', '=', 'td.work_order_id')
                ->leftJoin('clients as c', 'wo.client_id', '=', 'c.id')
                ->leftJoin('products as p', 'wo.product_id', '=', 'p.id')
                ->whereNotNull('s.scrap_percent');
            $this->applyScrapWorkOrderPeriodFilter($q, $from, $to);
            if ($workOrderId !== null) {
                $q->where('wo.id', $workOrderId);
            }
            if ($substrateGroup !== 'all') {
                $this->applyScrapSubstrateFilter($q, $substrateGroup);
            }
            if ($clientId !== null) {
                $q->where('wo.client_id', $clientId);
            }
            if ($productId !== null) {
                $q->where('wo.product_id', $productId);
            }
            $area = $def['area'];
            foreach ($q->get([
                'wo.id as work_order_id',
                'wo.code as work_order_code',
                'wo.status as work_order_status',
                'wo.client_id',
                'c.name as client_name',
                'wo.product_id',
                'p.name as product_name',
                's.scrap_percent',
            ]) as $r) {
                $detailRows[] = [
                    'work_order_id' => (int) $r->work_order_id,
                    'work_order_code' => $r->work_order_code,
                    'work_order_status' => $r->work_order_status !== null ? (string) $r->work_order_status : null,
                    'client_id' => $r->client_id !== null ? (int) $r->client_id : null,
                    'client_name' => $r->client_name,
                    'product_id' => $r->product_id !== null ? (int) $r->product_id : null,
                    'product_name' => $r->product_name,
                    'area' => $area,
                    'scrap_percent' => number_format((float) $r->scrap_percent, 3, '.', ''),
                ];
            }
        }

        $rows = match ($layout) {
            'by_work_order' => $this->scrapRowsPivotByWorkOrder($detailRows),
            'by_area' => $this->scrapRowsAggregateByArea($detailRows),
            default => $detailRows,
        };

        return [
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'substrate_group' => $substrateGroup,
            'layout' => $layout,
            'rows' => $rows,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $historyRows
     * @return list<array<string, mixed>>
     */
    private function scrapRowsPivotByWorkOrderKg(array $historyRows): array
    {
        $list = [];
        foreach ($historyRows as $r) {
            $impImpreso = (float) ($r['imp_scrap_impreso_kg'] ?? 0);
            $impTransparente = (float) ($r['imp_scrap_transparente_kg'] ?? 0);
            $lamKg = (float) ($r['lam_scrap_transparente_kg'] ?? 0)
                + (float) ($r['lam_scrap_impreso_kg'] ?? 0)
                + (float) ($r['lam_scrap_laminado_kg'] ?? 0);
            $corKg = (float) ($r['cor_scrap_refile_kg'] ?? 0)
                + (float) ($r['cor_scrap_impreso_kg'] ?? 0)
                + (float) ($r['cor_scrap_mal_corte_kg'] ?? 0);
            $totalKg = $impImpreso + $impTransparente + $lamKg + $corKg;

            if ($totalKg < 0.0005) {
                continue;
            }

            $list[] = [
                'work_order_id' => $r['work_order_id'],
                'work_order_code' => $r['work_order_code'],
                'work_order_status' => $r['work_order_status'] ?? null,
                'client_id' => $r['client_id'],
                'client_name' => $r['client_name'],
                'product_id' => $r['product_id'],
                'product_name' => $r['product_name'] ?? null,
                'imp_scrap_impreso_kg' => number_format($impImpreso, 3, '.', ''),
                'imp_scrap_transparente_kg' => number_format($impTransparente, 3, '.', ''),
                'laminacion_scrap_kg' => number_format($lamKg, 3, '.', ''),
                'corte_scrap_kg' => number_format($corKg, 3, '.', ''),
                'total_scrap_kg' => number_format($totalKg, 3, '.', ''),
                'printing_scrap_percent' => $r['printing_scrap_percent'] ?? null,
                'laminacion_scrap_percent' => $r['laminacion_scrap_percent'] ?? null,
                'corte_scrap_percent' => $r['corte_scrap_percent'] ?? null,
                'montaje_scrap_percent' => $r['montaje_scrap_percent'] ?? null,
            ];
        }

        usort($list, fn (array $a, array $b): int => $a['work_order_id'] <=> $b['work_order_id']);

        return $list;
    }

    /**
     * @param  list<array<string, mixed>>  $historyRows
     * @return list<array<string, mixed>>
     */
    private function scrapRowsAggregateByAreaKg(array $historyRows): array
    {
        $totals = [
            'printing' => 0.0,
            'laminacion' => 0.0,
            'corte' => 0.0,
        ];
        $counts = [
            'printing' => 0,
            'laminacion' => 0,
            'corte' => 0,
        ];

        foreach ($historyRows as $r) {
            $impKg = (float) ($r['imp_scrap_transparente_kg'] ?? 0)
                + (float) ($r['imp_scrap_impreso_kg'] ?? 0);
            $lamKg = (float) ($r['lam_scrap_transparente_kg'] ?? 0)
                + (float) ($r['lam_scrap_impreso_kg'] ?? 0)
                + (float) ($r['lam_scrap_laminado_kg'] ?? 0);
            $corKg = (float) ($r['cor_scrap_refile_kg'] ?? 0)
                + (float) ($r['cor_scrap_impreso_kg'] ?? 0)
                + (float) ($r['cor_scrap_mal_corte_kg'] ?? 0);

            if ($impKg > 0.0005) {
                $totals['printing'] += $impKg;
                $counts['printing']++;
            }
            if ($lamKg > 0.0005) {
                $totals['laminacion'] += $lamKg;
                $counts['laminacion']++;
            }
            if ($corKg > 0.0005) {
                $totals['corte'] += $corKg;
                $counts['corte']++;
            }
        }

        $out = [];
        foreach ($totals as $area => $total) {
            if ($total < 0.0005) {
                continue;
            }
            $out[] = [
                'area' => $area,
                'row_count' => $counts[$area],
                'total_scrap_kg' => number_format($total, 3, '.', ''),
            ];
        }

        usort($out, fn (array $a, array $b): int => strcmp((string) $a['area'], (string) $b['area']));

        return $out;
    }

    /**
     * Desperdicio (kg) en impresión, laminación y corte para un período.
     *
     * @return array{total_kg: string, printing_kg: string, laminacion_kg: string, corte_kg: string}
     */
    public function scrapKgTotalsForPeriod(
        Carbon $from,
        Carbon $to,
        ?int $clientId = null,
        ?int $productId = null,
    ): array {
        $historyRows = $this->scrapHistoryKgRows($from, $to, $clientId, $productId, 'all', null);

        $printing = 0.0;
        $laminacion = 0.0;
        $corte = 0.0;

        foreach ($historyRows as $r) {
            $printing += (float) ($r['imp_scrap_transparente_kg'] ?? 0)
                + (float) ($r['imp_scrap_impreso_kg'] ?? 0);
            $laminacion += (float) ($r['lam_scrap_transparente_kg'] ?? 0)
                + (float) ($r['lam_scrap_impreso_kg'] ?? 0)
                + (float) ($r['lam_scrap_laminado_kg'] ?? 0);
            $corte += (float) ($r['cor_scrap_refile_kg'] ?? 0)
                + (float) ($r['cor_scrap_impreso_kg'] ?? 0)
                + (float) ($r['cor_scrap_mal_corte_kg'] ?? 0);
        }

        return [
            'total_kg' => number_format($printing + $laminacion + $corte, 3, '.', ''),
            'printing_kg' => number_format($printing, 3, '.', ''),
            'laminacion_kg' => number_format($laminacion, 3, '.', ''),
            'corte_kg' => number_format($corte, 3, '.', ''),
        ];
    }

    /**
     * Resumen de desperdicio total (kg) por mes calendario dentro del rango.
     *
     * @return array{from: string, to: string, rows: list<array<string, mixed>>}
     */
    public function scrapMonthlySummary(
        Carbon $from,
        Carbon $to,
        ?int $clientId = null,
        ?int $productId = null,
    ): array {
        $rows = [];
        $cursor = $from->copy()->startOfMonth();
        $rangeEnd = $to->copy()->startOfMonth();

        while ($cursor <= $rangeEnd) {
            $monthStart = $cursor->copy()->startOfMonth()->startOfDay();
            $monthEnd = $cursor->copy()->endOfMonth()->endOfDay();
            $rangeFrom = $monthStart->greaterThan($from) ? $monthStart : $from->copy()->startOfDay();
            $rangeTo = $monthEnd->lessThan($to) ? $monthEnd : $to->copy()->endOfDay();

            $totals = $this->scrapKgTotalsForPeriod($rangeFrom, $rangeTo, $clientId, $productId);

            $rows[] = [
                'year_month' => $cursor->format('Y-m'),
                'month_label' => $cursor->locale('es')->translatedFormat('F Y'),
                'printing_kg' => $totals['printing_kg'],
                'laminacion_kg' => $totals['laminacion_kg'],
                'corte_kg' => $totals['corte_kg'],
                'total_kg' => $totals['total_kg'],
            ];

            $cursor->addMonth();
        }

        return [
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'rows' => $rows,
        ];
    }

    /**
     * Historial de desperdicio en kg desde la planilla técnica (JSON) + % resumen por área.
     * El filtro de sustrato usa `corDesperdicioSustrato` en el formulario si está definido; si no, la estructura del producto.
     * Los kg se enmascaran por pestaña (BOPP / polietileno / transparente) según destinos de impreso y corte.
     *
     * @return list<array<string, mixed>>
     */
    private function scrapHistoryKgRows(
        Carbon $from,
        Carbon $to,
        ?int $clientId,
        ?int $productId,
        string $substrateGroup,
        ?int $workOrderId = null,
    ): array {
        $q = DB::table('work_orders as wo')
            ->leftJoin('work_order_technical_documents as td', 'wo.id', '=', 'td.work_order_id')
            ->leftJoin('clients as c', 'wo.client_id', '=', 'c.id')
            ->leftJoin('products as p', 'wo.product_id', '=', 'p.id')
            ->leftJoin('work_order_printing_summaries as sp', 'wo.id', '=', 'sp.work_order_id')
            ->leftJoin('work_order_laminacion_summaries as sl', 'wo.id', '=', 'sl.work_order_id')
            ->leftJoin('work_order_corte_summaries as sc', 'wo.id', '=', 'sc.work_order_id')
            ->leftJoin('work_order_montaje_summaries as sm', 'wo.id', '=', 'sm.work_order_id');
        $this->applyScrapWorkOrderPeriodFilter($q, $from, $to);

        if ($workOrderId !== null) {
            $q->where('wo.id', $workOrderId);
        }
        if ($clientId !== null) {
            $q->where('wo.client_id', $clientId);
        }
        if ($productId !== null) {
            $q->where('wo.product_id', $productId);
        }

        $results = $q->orderBy('wo.id')->get([
            'wo.id as work_order_id',
            'wo.code as work_order_code',
            'wo.status as work_order_status',
            'wo.client_id',
            'c.name as client_name',
            'wo.product_id',
            'p.name as product_name',
            'p.structure as product_structure',
            'td.form as form_json',
            'sp.scrap_percent as printing_scrap_percent',
            'sl.scrap_percent as laminacion_scrap_percent',
            'sc.scrap_percent as corte_scrap_percent',
            'sm.scrap_percent as montaje_scrap_percent',
        ]);

        $parseKg = static function (?array $form, string $key): float {
            if ($form === null || ! array_key_exists($key, $form)) {
                return 0.0;
            }
            $v = $form[$key];
            if ($v === null || $v === '') {
                return 0.0;
            }
            if (is_numeric($v)) {
                return round((float) $v, 3);
            }

            return round((float) str_replace(',', '.', (string) $v), 3);
        };

        $fmtPct = static function ($v): ?string {
            if ($v === null) {
                return null;
            }

            return number_format((float) $v, 3, '.', '');
        };

        $rows = [];
        foreach ($results as $r) {
            /** @var array<string, mixed>|null $form */
            $form = null;
            if ($r->form_json !== null) {
                if (is_string($r->form_json)) {
                    $decoded = json_decode($r->form_json, true);
                    $form = is_array($decoded) ? $decoded : null;
                } elseif (is_array($r->form_json)) {
                    $form = $r->form_json;
                }
            }

            if ($substrateGroup !== 'all' && ! $this->workOrderMatchesScrapSubstrateGroup($form, $r->product_structure, $substrateGroup, $parseKg)) {
                continue;
            }

            $explicit = '';
            if ($form !== null && isset($form['corDesperdicioSustrato'])) {
                $explicit = strtolower(trim((string) $form['corDesperdicioSustrato']));
            }

            $scrapResolved = PlanillaScrapAggregator::resolvePrintingLaminacionScrap($form, $parseKg);
            $impT = $scrapResolved['imp_transparente'];
            $impI = $scrapResolved['imp_impreso'];
            $lamT = $scrapResolved['lam_transparente'];
            $lamI = $scrapResolved['lam_impreso'];
            $lamL = $scrapResolved['lam_laminado'];
            $corteResolved = PlanillaScrapAggregator::resolveCorteScrap($form, $parseKg);
            $corR = $corteResolved['refile'];
            $corIkg = $corteResolved['impreso'];
            $corM = $corteResolved['mal_corte'];

            $impDest = $this->resolveImpScrapImpresoDestino($form, $r->product_structure);
            $lamImpDest = $this->resolveLamScrapImpresoDestino($form, $r->product_structure);
            $lamLamDest = $this->resolveLamScrapLaminadoDestino($form, $r->product_structure);

            $refileResolved = $this->resolvedCorteBucketDestino($form, $r->product_structure, 'corScrapRefileDestino');
            $corImpresoResolved = $this->resolvedCorteBucketDestino($form, $r->product_structure, 'corScrapImpresoDestino');
            $globalSub = $this->resolvedGlobalCorteSubstrate($form, $r->product_structure);

            if ($substrateGroup === 'transparente') {
                $impT_out = $impT;
                $impI_out = 0.0;
                $lamT_out = $lamT;
                $lamI_out = 0.0;
                $lamL_out = 0.0;
                $corR_out = 0.0;
                $corI_out = 0.0;
                $corM_out = $globalSub === 'transparente' ? $corM : 0.0;
            } elseif ($substrateGroup === 'bopp') {
                $impT_out = 0.0;
                $impI_out = $impDest === 'bopp' ? $impI : 0.0;
                $lamT_out = 0.0;
                $lamI_out = $lamImpDest === 'bopp' ? $lamI : 0.0;
                $lamL_out = $lamLamDest === 'bopp' ? $lamL : 0.0;
                $corR_out = $refileResolved === 'bopp' ? $corR : 0.0;
                $corI_out = $corImpresoResolved === 'bopp' ? $corIkg : 0.0;
                $corM_out = $globalSub === 'bopp' ? $corM : 0.0;
            } elseif ($substrateGroup === ScrapSubstrateGroup::POLIETILENO) {
                $impT_out = 0.0;
                $impI_out = ScrapSubstrateGroup::isPolietileno($impDest) ? $impI : 0.0;
                $lamT_out = 0.0;
                $lamI_out = ScrapSubstrateGroup::isPolietileno($lamImpDest) ? $lamI : 0.0;
                $lamL_out = ScrapSubstrateGroup::isPolietileno($lamLamDest) ? $lamL : 0.0;
                $corR_out = ScrapSubstrateGroup::isPolietileno($refileResolved) ? $corR : 0.0;
                $corI_out = ScrapSubstrateGroup::isPolietileno($corImpresoResolved) ? $corIkg : 0.0;
                $corM_out = ScrapSubstrateGroup::isPolietileno($globalSub) ? $corM : 0.0;
            } else {
                $impT_out = $impT;
                $impI_out = $impI;
                $lamT_out = $lamT;
                $lamI_out = $lamI;
                $lamL_out = $lamL;
                $corR_out = $corR;
                $corI_out = $corIkg;
                $corM_out = $corM;
            }

            $rows[] = [
                'work_order_id' => (int) $r->work_order_id,
                'work_order_code' => $r->work_order_code,
                'work_order_status' => $r->work_order_status !== null ? (string) $r->work_order_status : null,
                'client_id' => $r->client_id !== null ? (int) $r->client_id : null,
                'client_name' => $r->client_name,
                'product_id' => $r->product_id !== null ? (int) $r->product_id : null,
                'product_name' => $r->product_name,
                'product_structure' => $r->product_structure,
                'corte_desperdicio_sustrato' => $explicit !== '' ? $explicit : null,
                'imp_scrap_transparente_kg' => number_format($impT_out, 3, '.', ''),
                'imp_scrap_impreso_kg' => number_format($impI_out, 3, '.', ''),
                'lam_scrap_transparente_kg' => number_format($lamT_out, 3, '.', ''),
                'lam_scrap_impreso_kg' => number_format($lamI_out, 3, '.', ''),
                'lam_scrap_laminado_kg' => number_format($lamL_out, 3, '.', ''),
                'cor_scrap_refile_kg' => number_format($corR_out, 3, '.', ''),
                'cor_scrap_impreso_kg' => number_format($corI_out, 3, '.', ''),
                'cor_scrap_mal_corte_kg' => number_format($corM_out, 3, '.', ''),
                'printing_scrap_percent' => $fmtPct($r->printing_scrap_percent),
                'laminacion_scrap_percent' => $fmtPct($r->laminacion_scrap_percent),
                'corte_scrap_percent' => $fmtPct($r->corte_scrap_percent),
                'montaje_scrap_percent' => $fmtPct($r->montaje_scrap_percent),
            ];
        }

        return $rows;
    }

    /**
     * Destino del scrap impreso en impresión (selección explícita en planilla: BOPP).
     *
     * @param  array<string, mixed>|null  $form
     */
    private function resolveImpScrapImpresoDestino(?array $form, ?string $productStructure): ?string
    {
        $raw = ScrapSubstrateCatalog::normalizeGroupId((string) (($form ?? [])['impScrapImpresoDestino'] ?? ''));
        if ($raw === 'bopp') {
            return 'bopp';
        }
        if (ScrapSubstrateGroup::isPolietileno($raw) || $raw === 'poliestireno') {
            return ScrapSubstrateGroup::POLIETILENO;
        }

        return null;
    }

    /**
     * Destino del scrap impreso en laminación (BOPP / polietileno).
     *
     * @param  array<string, mixed>|null  $form
     */
    private function resolveLamScrapImpresoDestino(?array $form, ?string $productStructure): ?string
    {
        $raw = ScrapSubstrateCatalog::normalizeGroupId((string) (($form ?? [])['lamScrapImpresoDestino'] ?? ''));
        if ($raw === 'bopp') {
            return 'bopp';
        }
        if (ScrapSubstrateGroup::isPolietileno($raw) || $raw === 'poliestireno') {
            return ScrapSubstrateGroup::POLIETILENO;
        }

        return null;
    }

    /**
     * Destino del scrap laminado en laminación (BOPP / polietileno).
     *
     * @param  array<string, mixed>|null  $form
     */
    private function resolveLamScrapLaminadoDestino(?array $form, ?string $productStructure): ?string
    {
        $raw = ScrapSubstrateCatalog::normalizeGroupId((string) (($form ?? [])['lamScrapLaminadoDestino'] ?? ''));
        if ($raw === 'bopp') {
            return 'bopp';
        }
        if (ScrapSubstrateGroup::isPolietileno($raw) || $raw === 'poliestireno') {
            return ScrapSubstrateGroup::POLIETILENO;
        }

        return null;
    }

    /**
     * @param  array<string, mixed>|null  $form
     * @param  callable(array<string, mixed>|null, string): float  $parseKg
     */
    private function workOrderMatchesScrapSubstrateGroup(?array $form, ?string $productStructure, string $substrateGroup, callable $parseKg): bool
    {
        if ($substrateGroup === 'all') {
            return true;
        }

        $explicit = ScrapSubstrateGroup::normalizeSubstrateToken(($form ?? [])['corDesperdicioSustrato'] ?? null) ?? '';

        $resolvedImpDest = $this->resolveImpScrapImpresoDestino($form, $productStructure);

        $scrapResolved = PlanillaScrapAggregator::resolvePrintingLaminacionScrap($form, $parseKg);

        if ($substrateGroup === 'transparente') {
            if ($explicit === 'transparente') {
                return true;
            }
            if (ScrapSubstrateCatalog::structureInferenceMatchesGroup($productStructure, 'transparente')) {
                return true;
            }
            if ($scrapResolved['imp_transparente'] > 0 || $scrapResolved['lam_transparente'] > 0) {
                return true;
            }

            return false;
        }

        if ($substrateGroup === 'bopp') {
            if ($explicit === 'bopp') {
                return true;
            }
            if ($explicit === '' && ScrapSubstrateCatalog::structureInferenceMatchesGroup($productStructure, 'bopp')) {
                return true;
            }
            if ($resolvedImpDest === 'bopp' && $scrapResolved['imp_impreso'] > 0) {
                return true;
            }
            $lamImpDestBopp = $this->resolveLamScrapImpresoDestino($form, $productStructure);
            $lamLamDestBopp = $this->resolveLamScrapLaminadoDestino($form, $productStructure);
            if ($lamImpDestBopp === 'bopp' && $scrapResolved['lam_impreso'] > 0) {
                return true;
            }
            if ($lamLamDestBopp === 'bopp' && $scrapResolved['lam_laminado'] > 0) {
                return true;
            }
            if ($this->resolvedCorteBucketDestino($form, $productStructure, 'corScrapRefileDestino') === 'bopp') {
                return true;
            }
            if ($this->resolvedCorteBucketDestino($form, $productStructure, 'corScrapImpresoDestino') === 'bopp') {
                return true;
            }
            if ($this->resolvedGlobalCorteSubstrate($form, $productStructure) === 'bopp') {
                return true;
            }

            return false;
        }

        if ($substrateGroup === ScrapSubstrateGroup::POLIETILENO) {
            if (ScrapSubstrateGroup::isPolietileno($explicit)) {
                return true;
            }
            if ($explicit === '' && ScrapSubstrateCatalog::structureInferenceMatchesGroup($productStructure, ScrapSubstrateGroup::POLIETILENO)) {
                return true;
            }
            if (ScrapSubstrateGroup::isPolietileno($resolvedImpDest) && $scrapResolved['imp_impreso'] > 0) {
                return true;
            }
            $lamImpDest = $this->resolveLamScrapImpresoDestino($form, $productStructure);
            $lamLamDest = $this->resolveLamScrapLaminadoDestino($form, $productStructure);
            if (ScrapSubstrateGroup::isPolietileno($lamImpDest) && $scrapResolved['lam_impreso'] > 0) {
                return true;
            }
            if (ScrapSubstrateGroup::isPolietileno($lamLamDest) && $scrapResolved['lam_laminado'] > 0) {
                return true;
            }
            if (ScrapSubstrateGroup::isPolietileno($this->resolvedCorteBucketDestino($form, $productStructure, 'corScrapRefileDestino'))) {
                return true;
            }
            if (ScrapSubstrateGroup::isPolietileno($this->resolvedCorteBucketDestino($form, $productStructure, 'corScrapImpresoDestino'))) {
                return true;
            }
            if (ScrapSubstrateGroup::isPolietileno($this->resolvedGlobalCorteSubstrate($form, $productStructure))) {
                return true;
            }

            return false;
        }

        return true;
    }

    /**
     * Destino BOPP / polietileno para refile o impreso en corte (auto = explícito global o estructura).
     *
     * @param  array<string, mixed>|null  $form
     */
    private function resolvedCorteBucketDestino(?array $form, ?string $productStructure, string $bucketKey): ?string
    {
        $raw = ScrapSubstrateGroup::normalizeSubstrateToken(($form ?? [])[$bucketKey] ?? null);
        if ($raw === 'bopp' || ScrapSubstrateGroup::isPolietileno($raw)) {
            return $raw;
        }

        $explicit = ScrapSubstrateGroup::normalizeSubstrateToken(($form ?? [])['corDesperdicioSustrato'] ?? null);
        if ($explicit === 'bopp' || ScrapSubstrateGroup::isPolietileno($explicit)) {
            return $explicit;
        }

        if (ScrapSubstrateCatalog::structureInferenceIsAmbiguous($productStructure)) {
            return null;
        }
        if (ScrapSubstrateCatalog::structureInferenceMatchesGroup($productStructure, 'bopp')) {
            return 'bopp';
        }
        if (ScrapSubstrateCatalog::structureInferenceMatchesGroup($productStructure, ScrapSubstrateGroup::POLIETILENO)) {
            return ScrapSubstrateGroup::POLIETILENO;
        }

        return null;
    }

    /**
     * Sustrato global para mal corte y auto en corte.
     *
     * @param  array<string, mixed>|null  $form
     */
    private function resolvedGlobalCorteSubstrate(?array $form, ?string $productStructure): ?string
    {
        $explicit = ScrapSubstrateGroup::normalizeSubstrateToken(($form ?? [])['corDesperdicioSustrato'] ?? null);
        if ($explicit === 'poliestireno') {
            $explicit = 'bopp';
        }
        if ($explicit === 'bopp' || ScrapSubstrateGroup::isPolietileno($explicit) || $explicit === 'transparente') {
            return $explicit;
        }

        if (ScrapSubstrateCatalog::structureInferenceIsAmbiguous($productStructure)) {
            return null;
        }
        if (ScrapSubstrateCatalog::structureInferenceMatchesGroup($productStructure, 'bopp')) {
            return 'bopp';
        }
        if (ScrapSubstrateCatalog::structureInferenceMatchesGroup($productStructure, ScrapSubstrateGroup::POLIETILENO)) {
            return ScrapSubstrateGroup::POLIETILENO;
        }
        if (ScrapSubstrateCatalog::structureInferenceMatchesGroup($productStructure, 'transparente')) {
            return 'transparente';
        }

        return null;
    }

    /**
     * @param  Builder  $query
     */
    /**
     * OT con actividad de desperdicio en el período: creación, fecha documento o planilla actualizada.
     */
    private function applyScrapWorkOrderPeriodFilter(Builder $query, Carbon $from, Carbon $to): void
    {
        $fromDate = $from->toDateString();
        $toDate = $to->toDateString();

        $query->where(function (Builder $q) use ($from, $to, $fromDate, $toDate) {
            $q->whereBetween('wo.created_at', [$from, $to])
                ->orWhereBetween('wo.document_date', [$fromDate, $toDate])
                ->orWhereBetween('td.updated_at', [$from, $to]);
        });
    }

    private function applyScrapSubstrateFilter($query, string $substrateGroup): void
    {
        $col = 'LOWER(COALESCE(p.structure, \'\'))';
        $id = ScrapSubstrateCatalog::normalizeGroupId($substrateGroup);
        foreach (ScrapSubstrateCatalog::groups() as $group) {
            if ($group['id'] !== $id) {
                continue;
            }
            $patterns = array_map(fn (string $p): string => '%'.$p.'%', $group['structure_patterns']);
            if ($patterns === []) {
                return;
            }
            $query->where(function ($q) use ($col, $patterns) {
                foreach ($patterns as $pat) {
                    $q->orWhereRaw("{$col} LIKE ?", [$pat]);
                }
            });

            return;
        }
    }

    /**
     * @param  list<array<string, mixed>>  $detailRows
     * @return list<array<string, mixed>>
     */
    private function scrapRowsPivotByWorkOrder(array $detailRows): array
    {
        $areaKeys = ['printing', 'corte', 'laminacion', 'montaje'];
        $byWo = [];
        foreach ($detailRows as $row) {
            $id = $row['work_order_id'];
            if (! isset($byWo[$id])) {
                $base = [
                    'work_order_id' => $id,
                    'work_order_code' => $row['work_order_code'],
                    'work_order_status' => $row['work_order_status'] ?? null,
                    'client_id' => $row['client_id'],
                    'client_name' => $row['client_name'],
                    'product_id' => $row['product_id'],
                    'product_name' => $row['product_name'] ?? null,
                ];
                foreach ($areaKeys as $a) {
                    $base[$a.'_scrap_percent'] = null;
                }
                $byWo[$id] = $base;
            }
            $byWo[$id][$row['area'].'_scrap_percent'] = $row['scrap_percent'];
        }
        $list = array_values($byWo);
        usort($list, fn (array $a, array $b): int => $a['work_order_id'] <=> $b['work_order_id']);

        return $list;
    }

    /**
     * @param  list<array<string, mixed>>  $detailRows
     * @return list<array<string, mixed>>
     */
    private function scrapRowsAggregateByArea(array $detailRows): array
    {
        $groups = [];
        foreach ($detailRows as $row) {
            $a = (string) $row['area'];
            if (! isset($groups[$a])) {
                $groups[$a] = [];
            }
            $groups[$a][] = (float) $row['scrap_percent'];
        }
        $out = [];
        foreach ($groups as $area => $vals) {
            $n = count($vals);
            $out[] = [
                'area' => $area,
                'row_count' => $n,
                'avg_scrap_percent' => number_format(array_sum($vals) / $n, 3, '.', ''),
                'max_scrap_percent' => number_format(max($vals), 3, '.', ''),
                'min_scrap_percent' => number_format(min($vals), 3, '.', ''),
            ];
        }
        usort($out, fn (array $a, array $b): int => strcmp((string) $a['area'], (string) $b['area']));

        return $out;
    }

    /**
     * Consumo agregado tintas / cementerio / químicos por cliente (salidas vía solicitud de material).
     *
     * @return array{from: string, to: string, rows: list<array<string, mixed>>}
     */
    public function tintaConsumptionByClient(Carbon $from, Carbon $to): array
    {
        $areas = [
            InventoryArea::Tintas->value,
            InventoryArea::CementerioTintas->value,
            InventoryArea::Quimicos->value,
        ];

        $aggregates = DB::table('inventory_movements as im')
            ->join('material_requests as mr', function ($join) {
                $join->on('im.reference_id', '=', 'mr.id')
                    ->where('im.reference_type', '=', 'material_request');
            })
            ->join('work_orders as wo', 'mr.work_order_id', '=', 'wo.id')
            ->join('materials as m', 'im.material_id', '=', 'm.id')
            ->where('im.movement_type', 'out')
            ->whereIn('m.inventory_area', $areas)
            ->whereBetween('im.occurred_at', [$from, $to])
            ->select('wo.client_id')
            ->selectRaw('SUM(im.quantity) as total_quantity')
            ->selectRaw('COUNT(*) as movement_count')
            ->groupBy('wo.client_id')
            ->orderBy('wo.client_id')
            ->get();

        $clientIds = $aggregates->pluck('client_id')->filter()->unique()->all();
        $clients = $clientIds === []
            ? collect()
            : Client::query()->whereIn('id', $clientIds)->get()->keyBy('id');

        $rows = $aggregates->map(function ($row) use ($clients) {
            $cid = $row->client_id !== null ? (int) $row->client_id : null;
            /** @var Client|null $c */
            $c = $cid !== null ? $clients->get($cid) : null;

            return [
                'client_id' => $cid,
                'client_name' => $c?->name,
                'total_quantity' => number_format((float) $row->total_quantity, 3, '.', ''),
                'movement_count' => (int) $row->movement_count,
            ];
        })->values()->all();

        return [
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'rows' => $rows,
        ];
    }

    /**
     * Consumo por cliente y producto (salidas OT → solicitud → movimiento out).
     *
     * @return array{from: string, to: string, rows: list<array<string, mixed>>}
     */
    public function consumptionByClientAndProduct(Carbon $from, Carbon $to): array
    {
        $aggregates = DB::table('inventory_movements as im')
            ->join('material_requests as mr', function ($join) {
                $join->on('im.reference_id', '=', 'mr.id')
                    ->where('im.reference_type', '=', 'material_request');
            })
            ->join('work_orders as wo', 'mr.work_order_id', '=', 'wo.id')
            ->where('im.movement_type', 'out')
            ->whereBetween('im.occurred_at', [$from, $to])
            ->select('wo.client_id', 'wo.product_id')
            ->selectRaw('SUM(im.quantity) as total_quantity')
            ->selectRaw('COUNT(*) as movement_count')
            ->groupBy('wo.client_id', 'wo.product_id')
            ->orderBy('wo.client_id')
            ->orderBy('wo.product_id')
            ->get();

        $clientIds = $aggregates->pluck('client_id')->filter()->unique()->all();
        $productIds = $aggregates->pluck('product_id')->filter()->unique()->all();

        $clients = $clientIds === []
            ? collect()
            : Client::query()->whereIn('id', $clientIds)->get()->keyBy('id');
        $products = $productIds === []
            ? collect()
            : Product::query()->whereIn('id', $productIds)->get()->keyBy('id');

        $rows = $aggregates->map(function ($row) use ($clients, $products) {
            $cid = $row->client_id !== null ? (int) $row->client_id : null;
            $pid = $row->product_id !== null ? (int) $row->product_id : null;
            /** @var Client|null $c */
            $c = $cid !== null ? $clients->get($cid) : null;
            /** @var Product|null $p */
            $p = $pid !== null ? $products->get($pid) : null;

            return [
                'client_id' => $cid,
                'client_name' => $c?->name,
                'product_id' => $pid,
                'product_name' => $p?->name,
                'total_quantity' => number_format((float) $row->total_quantity, 3, '.', ''),
                'movement_count' => (int) $row->movement_count,
            ];
        })->values()->all();

        return [
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'rows' => $rows,
        ];
    }

    /**
     * Inventario de bobinas rechazadas: stock por material del área + entidades bobina con vínculo a devolución/OT (PDF §2 + reportes).
     *
     * @return array{materials: list<array<string, mixed>>, bobinas: list<array<string, mixed>>, bobinas_total: int}
     */
    public function rejectedBobinasInventory(): array
    {
        $materials = Material::query()
            ->where('inventory_area', InventoryArea::BobinasRechazadas->value)
            ->orderBy('sku')
            ->get(['id', 'sku', 'name', 'unit', 'quantity_on_hand', 'min_stock']);

        $materialRows = $materials->map(function (Material $m) {
            return [
                'id' => $m->getKey(),
                'sku' => $m->sku,
                'name' => $m->name,
                'unit' => $m->unit,
                'quantity_on_hand' => number_format((float) $m->quantity_on_hand, 3, '.', ''),
                'min_stock' => number_format((float) $m->min_stock, 3, '.', ''),
            ];
        })->values()->all();

        $bobinasQuery = Bobina::query()
            ->with([
                'material:id,sku,name,inventory_area',
                'inventoryReturn:id,work_order_id,quantity,status',
                'inventoryReturn.workOrder:id,code,client_order_reference',
            ])
            ->whereHas('material', function ($q) {
                $q->where('inventory_area', InventoryArea::BobinasRechazadas->value);
            })
            ->orderByDesc('created_at');

        $total = (clone $bobinasQuery)->count();

        $bobinas = $bobinasQuery->limit(2000)->get()->map(function (Bobina $b) {
            $ret = $b->inventoryReturn;
            $wo = $ret?->workOrder;

            return [
                'id' => $b->getKey(),
                'code' => $b->code,
                'weight_kg' => number_format((float) $b->weight_kg, 3, '.', ''),
                'status' => $b->status,
                'material_id' => $b->material_id,
                'material_sku' => $b->material?->sku,
                'material_name' => $b->material?->name,
                'inventory_return_id' => $b->inventory_return_id,
                'return_quantity' => $ret !== null ? number_format((float) $ret->quantity, 3, '.', '') : null,
                'work_order_id' => $ret?->work_order_id,
                'work_order_code' => $wo?->code,
                'client_order_reference' => $wo?->client_order_reference,
            ];
        })->values()->all();

        return [
            'materials' => $materialRows,
            'bobinas' => $bobinas,
            'bobinas_total' => $total,
        ];
    }

    /**
     * Reporte descargable de bobinas rechazadas: número, proveedor, peso y motivo.
     *
     * @return array{from: string, to: string, supplier_id: int|null, rows: list<array<string, mixed>>}
     */
    public function rejectedBobinasReport(Carbon $from, Carbon $to, ?int $supplierId = null): array
    {
        $supplierName = null;
        if ($supplierId !== null) {
            $supplierName = Supplier::query()->whereKey($supplierId)->value('name');
        }

        $q = Bobina::query()
            ->with([
                'material.supplier:id,name',
                'inventoryReturn:id,reason,accepted_at,created_at,work_order_id,status,material_id',
                'inventoryReturn.workOrder:id,code',
            ])
            ->whereHas('material', fn ($m) => $m->where('inventory_area', InventoryArea::BobinasRechazadas->value))
            ->whereHas('inventoryReturn', function ($r) use ($from, $to, $supplierId, $supplierName) {
                $r->where(function ($dates) use ($from, $to) {
                    $dates
                        ->where(function ($accepted) use ($from, $to) {
                            $accepted->where('status', 'accepted')
                                ->whereNotNull('accepted_at')
                                ->whereBetween('accepted_at', [$from, $to]);
                        })
                        ->orWhere(function ($pending) use ($from, $to) {
                            $pending->where('status', 'pending')
                                ->whereBetween('created_at', [$from, $to]);
                        });
                });
                if ($supplierId !== null) {
                    $r->where(function ($sub) use ($supplierId, $supplierName) {
                        $sub->whereHas('material', fn ($m) => $m->where('supplier_id', $supplierId));
                        if ($supplierName !== null && $supplierName !== '') {
                            $sub->orWhere('reason', 'like', '%Proveedor: '.$supplierName.'%');
                        }
                    });
                }
            });

        $rows = [];
        $seenReturnIds = [];
        foreach ($q->get()->sortBy([
            fn (Bobina $b) => $b->inventoryReturn?->accepted_at?->timestamp ?? 0,
            fn (Bobina $b) => $b->code,
        ]) as $bobina) {
            $ret = $bobina->inventoryReturn;
            if ($ret === null) {
                continue;
            }
            $seenReturnIds[] = (int) $ret->getKey();
            $rows[] = $this->buildRejectedDisplayRow($ret, $bobina);
        }

        // Fallback: devoluciones rechazadas aceptadas sin bobina física creada.
        $retQ = InventoryReturn::query()
            ->with(['material.supplier:id,name', 'workOrder:id,code'])
            ->where('destination_area', InventoryArea::BobinasRechazadas->value)
            ->where(function ($dates) use ($from, $to) {
                $dates
                    ->where(function ($accepted) use ($from, $to) {
                        $accepted->where('status', 'accepted')
                            ->whereNotNull('accepted_at')
                            ->whereBetween('accepted_at', [$from, $to]);
                    })
                    ->orWhere(function ($pending) use ($from, $to) {
                        $pending->where('status', 'pending')
                            ->whereBetween('created_at', [$from, $to]);
                    });
            });

        if ($seenReturnIds !== []) {
            $retQ->whereNotIn('id', $seenReturnIds);
        }

        if ($supplierId !== null) {
            $retQ->where(function ($sub) use ($supplierId, $supplierName) {
                $sub->whereHas('material', fn ($m) => $m->where('supplier_id', $supplierId));
                if ($supplierName !== null && $supplierName !== '') {
                    $sub->orWhere('reason', 'like', '%Proveedor: '.$supplierName.'%');
                }
            });
        }

        foreach ($retQ->get() as $ret) {
            $rows[] = $this->buildRejectedDisplayRow($ret, null);
        }

        usort($rows, static function (array $a, array $b): int {
            $da = (string) ($a['fecha_registro'] ?? '');
            $db = (string) ($b['fecha_registro'] ?? '');
            if ($da !== $db) {
                return $db <=> $da;
            }

            return strcmp((string) ($a['numero_bobina'] ?? ''), (string) ($b['numero_bobina'] ?? ''));
        });

        return [
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'supplier_id' => $supplierId,
            'rows' => $rows,
        ];
    }

    /**
     * @return array{motivo: string, proveedor: string, operador: string, material: string, observacion: string, fecha_bobina: string}
     */
    private function parseRejectedBobinaReturnReason(?string $reason): array
    {
        $text = trim((string) $reason);
        if ($text === '') {
            return [
                'motivo' => '',
                'proveedor' => '',
                'operador' => '',
                'material' => '',
                'observacion' => '',
                'fecha_bobina' => '',
            ];
        }

        $motivo = '';
        $proveedor = '';
        $operador = '';
        $material = '';
        $observacion = '';
        $fechaBobina = '';

        foreach (preg_split('/\s·\s/u', $text) ?: [] as $segment) {
            $segment = trim($segment);
            if ($segment === '') {
                continue;
            }
            if (str_starts_with($segment, 'Motivo:')) {
                $motivo = trim(substr($segment, strlen('Motivo:')));
            } elseif (str_starts_with($segment, 'Proveedor:')) {
                $proveedor = trim(substr($segment, strlen('Proveedor:')));
            } elseif (str_starts_with($segment, 'Operador:')) {
                $operador = trim(substr($segment, strlen('Operador:')));
            } elseif (str_starts_with($segment, 'Material:')) {
                $material = trim(substr($segment, strlen('Material:')));
            } elseif (str_starts_with($segment, 'Obs:')) {
                $observacion = trim(substr($segment, strlen('Obs:')));
            } elseif (str_starts_with($segment, 'Fecha bobina:')) {
                $fechaBobina = trim(substr($segment, strlen('Fecha bobina:')));
            }
        }

        if ($motivo === '' && preg_match('/Motivo:\s*([^·]+)/u', $text, $m)) {
            $motivo = trim($m[1]);
        }
        if ($proveedor === '' && preg_match('/Proveedor:\s*(.+)$/u', $text, $m)) {
            $proveedor = trim($m[1]);
        }
        if ($operador === '' && preg_match('/Operador:\s*(.+)$/u', $text, $m)) {
            $operador = trim($m[1]);
        }
        if ($material === '' && preg_match('/Material:\s*(.+)$/u', $text, $m)) {
            $material = trim($m[1]);
        }
        if ($observacion === '' && preg_match('/Obs:\s*(.+)$/u', $text, $m)) {
            $observacion = trim($m[1]);
        }
        if ($fechaBobina === '' && preg_match('/Fecha bobina:\s*([^·]+)/u', $text, $m)) {
            $fechaBobina = trim($m[1]);
        }

        if ($motivo === '') {
            $motivo = preg_replace('/^\d+\s+bobina\(s\)\s+rechazada\(s\)\s*·?\s*/u', '', $text) ?? $text;
            $motivo = trim($motivo);
        }

        return [
            'motivo' => $motivo,
            'proveedor' => $proveedor,
            'operador' => $operador,
            'material' => $material,
            'observacion' => $observacion,
            'fecha_bobina' => $fechaBobina,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildRejectedDisplayRow(
        InventoryReturn $ret,
        ?Bobina $bobina,
        ?string $fallbackCode = null,
    ): array {
        $parsed = $this->parseRejectedBobinaReturnReason($ret->reason);
        $proveedor = trim((string) ($bobina?->material?->supplier?->name ?? ''));
        if ($proveedor === '') {
            $proveedor = $parsed['proveedor'];
        }

        $materialLabel = trim((string) ($bobina?->material?->name ?? ''));
        if ($materialLabel === '') {
            $materialLabel = $parsed['material'];
        }

        $fechaBobina = $parsed['fecha_bobina'] !== '' ? $parsed['fecha_bobina'] : null;
        $fechaRegistro = $ret->accepted_at?->format('Y-m-d') ?? $ret->created_at?->format('Y-m-d');

        $code = $bobina?->code;
        if ($code === null || $code === '') {
            $code = $fallbackCode;
        }

        return [
            'numero_bobina' => $this->normalizeRejectedBobinaDisplayCode($code, (int) $ret->getKey()),
            'proveedor' => $proveedor !== '' ? $proveedor : null,
            'operador' => $parsed['operador'] !== '' ? $parsed['operador'] : null,
            'material' => $materialLabel !== '' ? $materialLabel : null,
            'peso_kg' => number_format((float) ($bobina?->weight_kg ?? $ret->quantity), 3, '.', ''),
            'motivo' => $parsed['motivo'] !== '' ? $parsed['motivo'] : null,
            'observacion' => $parsed['observacion'] !== '' ? $parsed['observacion'] : null,
            'fecha_bobina' => $fechaBobina,
            'fecha_registro' => $fechaRegistro,
            'work_order_code' => $ret->workOrder?->code,
        ];
    }

    private function normalizeRejectedBobinaDisplayCode(?string $code, int $returnId): string
    {
        if ($code === null || trim($code) === '') {
            return 'SIN-BB-'.$returnId;
        }
        $code = trim($code);
        if (preg_match('/^RET-(\d+)$/i', $code, $m)) {
            return 'SIN-BB-'.$m[1];
        }

        return $code;
    }

    /**
     * Resumen global de material producido (kg salida impresión, laminación y corte) en el período.
     *
     * @return array{
     *   from: string,
     *   to: string,
     *   client_id: int|null,
     *   totals: array<string, mixed>,
     *   work_orders: list<array<string, mixed>>,
     *   work_order_count: int
     * }
     */
    public function productionMaterialSummary(Carbon $from, Carbon $to, ?int $clientId = null): array
    {
        $q = DB::table('work_orders as wo')
            ->join('work_order_technical_documents as td', 'wo.id', '=', 'td.work_order_id')
            ->leftJoin('clients as c', 'wo.client_id', '=', 'c.id')
            ->leftJoin('products as p', 'wo.product_id', '=', 'p.id');
        $this->applyScrapWorkOrderPeriodFilter($q, $from, $to);

        if ($clientId !== null) {
            $q->where('wo.client_id', $clientId);
        }

        $totals = [
            'impreso_kg' => 0.0,
            'laminado_kg' => 0.0,
            'corte_kg' => 0.0,
            'impreso_bobinas' => 0,
            'laminado_bobinas' => 0,
        ];
        $impresoBreakdown = [];
        $laminadoBreakdown = [];
        $cortadoBreakdown = [];

        $workOrders = [];

        foreach ($q->orderBy('wo.id')->get([
            'wo.id as work_order_id',
            'wo.code as work_order_code',
            'wo.client_id',
            'c.name as client_name',
            'p.id as product_id',
            'p.name as product_name',
            'p.structure as product_structure',
            'td.form as form_json',
        ]) as $row) {
            /** @var array<string, mixed>|null $form */
            $form = null;
            if ($row->form_json !== null) {
                if (is_string($row->form_json)) {
                    $decoded = json_decode($row->form_json, true);
                    $form = is_array($decoded) ? $decoded : null;
                } elseif (is_array($row->form_json)) {
                    $form = $row->form_json;
                }
            }

            $material = WorkOrderProductionControlsAggregator::materialTotalsFromForm($form);
            $impKg = $material['impreso_kg'];
            $lamKg = $material['laminado_kg'];
            $corKg = $material['corte_kg'];

            if ($impKg + $lamKg + $corKg < 0.0005) {
                continue;
            }

            $productStructure = trim((string) ($row->product_structure ?? ''));

            $materialNames = $this->resolvePlanillaMaterialNames($form);
            $productId = $row->product_id !== null ? (int) $row->product_id : null;
            $breakdown = WorkOrderProductionControlsAggregator::materialSalidaBreakdownFromForm(
                $form,
                $materialNames,
                $productStructure !== '' ? $productStructure : null,
                $this->resolveProductSubstrateLabels($productId),
                $this->resolveProductFinishedLabel($productId),
            );

            $totals['impreso_kg'] += $impKg;
            $totals['laminado_kg'] += $lamKg;
            $totals['corte_kg'] += $corKg;
            $totals['impreso_bobinas'] += $material['impreso_bobinas'];
            $totals['laminado_bobinas'] += $material['laminado_bobinas'];
            $impresoBreakdown = WorkOrderProductionControlsAggregator::mergeBreakdownLineGroups(
                $impresoBreakdown,
                $breakdown['impreso'],
            );
            $laminadoBreakdown = WorkOrderProductionControlsAggregator::mergeBreakdownLineGroups(
                $laminadoBreakdown,
                $breakdown['laminado'],
            );
            $cortadoBreakdown = WorkOrderProductionControlsAggregator::mergeBreakdownLineGroups(
                $cortadoBreakdown,
                $breakdown['cortado'],
            );

            $workOrders[] = [
                'work_order_id' => (int) $row->work_order_id,
                'work_order_code' => $row->work_order_code,
                'client_id' => $row->client_id !== null ? (int) $row->client_id : null,
                'client_name' => $row->client_name,
                'material_impreso_kg' => number_format($impKg, 3, '.', ''),
                'material_laminado_kg' => number_format($lamKg, 3, '.', ''),
                'material_cortado_kg' => number_format($corKg, 3, '.', ''),
                'impreso_bobinas' => $material['impreso_bobinas'],
                'laminado_bobinas' => $material['laminado_bobinas'],
                'material_impreso_lines' => WorkOrderProductionControlsAggregator::formatBreakdownLinesForApi(
                    $breakdown['impreso'],
                ),
                'material_laminado_lines' => WorkOrderProductionControlsAggregator::formatBreakdownLinesForApi(
                    $breakdown['laminado'],
                ),
                'material_cortado_lines' => WorkOrderProductionControlsAggregator::formatBreakdownLinesForApi(
                    $breakdown['cortado'],
                ),
            ];
        }

        $totalGeneral = $totals['impreso_kg'] + $totals['laminado_kg'] + $totals['corte_kg'];

        return [
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'client_id' => $clientId,
            'totals' => [
                'material_impreso_kg' => number_format($totals['impreso_kg'], 3, '.', ''),
                'material_laminado_kg' => number_format($totals['laminado_kg'], 3, '.', ''),
                'material_cortado_kg' => number_format($totals['corte_kg'], 3, '.', ''),
                'total_general_kg' => number_format($totalGeneral, 3, '.', ''),
                'impreso_bobinas' => $totals['impreso_bobinas'],
                'laminado_bobinas' => $totals['laminado_bobinas'],
                'material_impreso_lines' => WorkOrderProductionControlsAggregator::formatBreakdownLinesForApi(
                    $impresoBreakdown,
                ),
                'material_laminado_lines' => WorkOrderProductionControlsAggregator::formatBreakdownLinesForApi(
                    $laminadoBreakdown,
                ),
                'material_cortado_lines' => WorkOrderProductionControlsAggregator::formatBreakdownLinesForApi(
                    $cortadoBreakdown,
                ),
            ],
            'work_orders' => $workOrders,
            'work_order_count' => count($workOrders),
        ];
    }

    /**
     * Filas CSV legibles (encabezados en español) para el resumen de material producido.
     *
     * @param  array<string, mixed>  $payload
     * @return list<array<string, mixed>>
     */
    public function productionMaterialSummaryCsvRows(
        array $payload,
        Carbon $from,
        Carbon $to,
        string $clientFilterLabel,
    ): array {
        $totals = (array) ($payload['totals'] ?? []);
        $fromLabel = $from->format('d/m/Y');
        $toLabel = $to->format('d/m/Y');

        $base = [
            'Desde' => $fromLabel,
            'Hasta' => $toLabel,
            'Cliente filtrado' => $clientFilterLabel,
            'OT' => '',
            'Cliente' => '',
            'Kg impreso' => '',
            'Kg laminado' => '',
            'Kg cortado' => '',
            'Total Kg' => '',
            'Bobinas impresión' => '',
            'Bobinas laminación' => '',
            'Proceso' => '',
            'Material o referencia' => '',
            'Kg material' => '',
            'Cantidad' => '',
            'Unidad' => '',
        ];

        $rows = [];

        $rows[] = array_merge($base, [
            'Sección' => 'Resumen planta',
            'Kg impreso' => $totals['material_impreso_kg'] ?? '0.000',
            'Kg laminado' => $totals['material_laminado_kg'] ?? '0.000',
            'Kg cortado' => $totals['material_cortado_kg'] ?? '0.000',
            'Total Kg' => $totals['total_general_kg'] ?? '0.000',
            'Bobinas impresión' => $totals['impreso_bobinas'] ?? 0,
            'Bobinas laminación' => $totals['laminado_bobinas'] ?? 0,
        ]);

        foreach ([
            'Impresión' => 'material_impreso_lines',
            'Laminación' => 'material_laminado_lines',
            'Corte' => 'material_cortado_lines',
        ] as $procesoLabel => $linesKey) {
            $unit = $procesoLabel === 'Corte' ? 'rollo' : 'bobina';
            foreach ((array) ($totals[$linesKey] ?? []) as $line) {
                if (! is_array($line)) {
                    continue;
                }
                $kg = (float) ($line['kg'] ?? 0);
                if ($kg < 0.0005) {
                    continue;
                }
                $rows[] = array_merge($base, [
                    'Sección' => 'Material planta',
                    'Proceso' => $procesoLabel,
                    'Material o referencia' => $line['label'] ?? '',
                    'Kg material' => $line['kg'] ?? '0.000',
                    'Cantidad' => $line['bobinas'] ?? 0,
                    'Unidad' => $unit,
                ]);
            }
        }

        foreach ((array) ($payload['work_orders'] ?? []) as $wo) {
            if (! is_array($wo)) {
                continue;
            }
            $impKg = (float) ($wo['material_impreso_kg'] ?? 0);
            $lamKg = (float) ($wo['material_laminado_kg'] ?? 0);
            $corKg = (float) ($wo['material_cortado_kg'] ?? 0);
            $otCode = (string) ($wo['work_order_code'] ?? '');
            $clientName = (string) ($wo['client_name'] ?? '');

            $rows[] = array_merge($base, [
                'Sección' => 'Total por OT',
                'OT' => $otCode,
                'Cliente' => $clientName,
                'Kg impreso' => $wo['material_impreso_kg'] ?? '0.000',
                'Kg laminado' => $wo['material_laminado_kg'] ?? '0.000',
                'Kg cortado' => $wo['material_cortado_kg'] ?? '0.000',
                'Total Kg' => number_format($impKg + $lamKg + $corKg, 3, '.', ''),
                'Bobinas impresión' => $wo['impreso_bobinas'] ?? 0,
                'Bobinas laminación' => $wo['laminado_bobinas'] ?? 0,
            ]);

            foreach ([
                'Impresión' => ['material_impreso_lines', 'bobina'],
                'Laminación' => ['material_laminado_lines', 'bobina'],
                'Corte' => ['material_cortado_lines', 'rollo'],
            ] as $procesoLabel => [$linesKey, $unit]) {
                foreach ((array) ($wo[$linesKey] ?? []) as $line) {
                    if (! is_array($line)) {
                        continue;
                    }
                    $kg = (float) ($line['kg'] ?? 0);
                    if ($kg < 0.0005) {
                        continue;
                    }
                    $rows[] = array_merge($base, [
                        'Sección' => 'Material por OT',
                        'OT' => $otCode,
                        'Cliente' => $clientName,
                        'Proceso' => $procesoLabel,
                        'Material o referencia' => $line['label'] ?? '',
                        'Kg material' => $line['kg'] ?? '0.000',
                        'Cantidad' => $line['bobinas'] ?? 0,
                        'Unidad' => $unit,
                    ]);
                }
            }
        }

        $rows[] = array_merge($base, [
            'Sección' => 'Total planta',
            'Kg impreso' => $totals['material_impreso_kg'] ?? '0.000',
            'Kg laminado' => $totals['material_laminado_kg'] ?? '0.000',
            'Kg cortado' => $totals['material_cortado_kg'] ?? '0.000',
            'Total Kg' => $totals['total_general_kg'] ?? '0.000',
        ]);

        return $this->normalizeProductionMaterialSummaryCsvRowOrder($rows);
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    private function normalizeProductionMaterialSummaryCsvRowOrder(array $rows): array
    {
        $headers = [
            'Sección',
            'Desde',
            'Hasta',
            'Cliente filtrado',
            'OT',
            'Cliente',
            'Kg impreso',
            'Kg laminado',
            'Kg cortado',
            'Total Kg',
            'Bobinas impresión',
            'Bobinas laminación',
            'Proceso',
            'Material o referencia',
            'Kg material',
            'Cantidad',
            'Unidad',
        ];

        return array_map(
            static fn (array $row): array => array_merge(
                array_fill_keys($headers, ''),
                array_intersect_key($row, array_flip($headers)),
            ),
            $rows,
        );
    }

    /**
     * @param  array<string, mixed>|null  $form
     * @return array<int, string>
     */
    private function resolvePlanillaMaterialNames(?array $form): array
    {
        if ($form === null) {
            return [];
        }

        $ids = [];
        foreach (['sustratosVirgenImp', 'sustratosVirgenLam'] as $key) {
            foreach ((array) ($form[$key] ?? []) as $row) {
                if (! is_array($row)) {
                    continue;
                }
                if (isset($row['material_id']) && is_numeric($row['material_id'])) {
                    $mid = (int) $row['material_id'];
                    if ($mid > 0) {
                        $ids[$mid] = $mid;
                    }
                }
            }
        }

        $legacyMid = trim((string) ($form['sustratoVirgenImp1'] ?? ''));
        if ($legacyMid !== '' && is_numeric($legacyMid)) {
            $mid = (int) $legacyMid;
            if ($mid > 0) {
                $ids[$mid] = $mid;
            }
        }

        if ($ids === []) {
            return [];
        }

        return Material::query()
            ->whereIn('id', array_values($ids))
            ->get(['id', 'sku', 'name'])
            ->mapWithKeys(fn (Material $material): array => [
                (int) $material->getKey() => $this->formatMaterialCatalogLabel(
                    (string) ($material->sku ?? ''),
                    (string) ($material->name ?? ''),
                ),
            ])
            ->all();
    }

    /**
     * Sustratos del producto (excluye material terminado de despacho).
     *
     * @return list<string>
     */
    private function resolveProductSubstrateLabels(?int $productId): array
    {
        if ($productId === null || $productId < 1) {
            return [];
        }

        return Material::query()
            ->join('material_product', 'material_product.material_id', '=', 'materials.id')
            ->where('material_product.product_id', $productId)
            ->orderBy('materials.id')
            ->get(['materials.sku', 'materials.name'])
            ->map(fn (Material $material): string => $this->formatMaterialCatalogLabel(
                (string) ($material->sku ?? ''),
                (string) ($material->name ?? ''),
            ))
            ->filter(fn (string $label): bool => $label !== '' && ! $this->isFinishedProductMaterialLabel($label))
            ->values()
            ->all();
    }

    private function resolveProductFinishedLabel(?int $productId): ?string
    {
        if ($productId === null || $productId < 1) {
            return null;
        }

        $labels = Material::query()
            ->join('material_product', 'material_product.material_id', '=', 'materials.id')
            ->where('material_product.product_id', $productId)
            ->orderBy('materials.id')
            ->get(['materials.sku', 'materials.name'])
            ->map(fn (Material $material): string => $this->formatMaterialCatalogLabel(
                (string) ($material->sku ?? ''),
                (string) ($material->name ?? ''),
            ))
            ->filter(fn (string $label): bool => $label !== '' && $this->isFinishedProductMaterialLabel($label))
            ->values()
            ->all();

        return $labels[0] ?? null;
    }

    private function isFinishedProductMaterialLabel(string $label): bool
    {
        return str_contains(mb_strtolower($label), 'terminado');
    }

    private function formatMaterialCatalogLabel(string $sku, string $name): string
    {
        $sku = trim($sku);
        $name = trim($name);
        if ($sku !== '' && $name !== '') {
            return $sku.' — '.$name;
        }

        return $name !== '' ? $name : $sku;
    }

    /**
     * Resumen de consumibles (tintas, químicos laminación, entradas de material) por período.
     *
     * @return array{
     *   from: string,
     *   to: string,
     *   client_id: int|null,
     *   totals: array<string, mixed>,
     *   work_orders: list<array<string, mixed>>,
     *   work_order_count: int
     * }
     */
    public function consumablesSummary(Carbon $from, Carbon $to, ?int $clientId = null): array
    {
        $q = DB::table('work_orders as wo')
            ->join('work_order_technical_documents as td', 'wo.id', '=', 'td.work_order_id')
            ->leftJoin('clients as c', 'wo.client_id', '=', 'c.id');
        $this->applyScrapWorkOrderPeriodFilter($q, $from, $to);

        if ($clientId !== null) {
            $q->where('wo.client_id', $clientId);
        }

        $sumKeys = [
            'tintas_original_kg',
            'tintas_solventadas_kg',
            'tintas_alcohol_kg',
            'tintas_metoxil_kg',
            'tintas_npa_kg',
            'lam_adhesivo_sobra_kg',
            'lam_catalizador_sobra_kg',
            'lam_acetato_sobra_lt',
            'lam_adhesivo_consumido_kg',
            'lam_catalizador_consumido_kg',
            'lam_acetato_consumido_lt',
            'impresion_entrada_kg',
            'laminacion_virgen_entrada_kg',
        ];

        $totals = array_fill_keys($sumKeys, 0.0);
        $workOrders = [];

        foreach ($q->orderBy('wo.id')->get([
            'wo.id as work_order_id',
            'wo.code as work_order_code',
            'wo.client_id',
            'c.name as client_name',
        ]) as $row) {
            $woId = (int) $row->work_order_id;
            $raw = WorkOrderProductionControlsAggregator::consumablesTotals($woId);

            if (array_sum($raw) < 0.0005) {
                continue;
            }

            foreach ($sumKeys as $key) {
                $totals[$key] += $raw[$key];
            }

            $workOrders[] = [
                'work_order_id' => $woId,
                'work_order_code' => $row->work_order_code,
                'client_id' => $row->client_id !== null ? (int) $row->client_id : null,
                'client_name' => $row->client_name,
                'tintas_original_kg' => number_format($raw['tintas_original_kg'], 3, '.', ''),
                'tintas_solventadas_kg' => number_format($raw['tintas_solventadas_kg'], 3, '.', ''),
                'tintas_alcohol_kg' => number_format($raw['tintas_alcohol_kg'], 3, '.', ''),
                'tintas_metoxil_kg' => number_format($raw['tintas_metoxil_kg'], 3, '.', ''),
                'tintas_npa_kg' => number_format($raw['tintas_npa_kg'], 3, '.', ''),
                'lam_adhesivo_sobra_kg' => number_format($raw['lam_adhesivo_sobra_kg'], 3, '.', ''),
                'lam_catalizador_sobra_kg' => number_format($raw['lam_catalizador_sobra_kg'], 3, '.', ''),
                'lam_acetato_sobra_lt' => number_format($raw['lam_acetato_sobra_lt'], 3, '.', ''),
                'lam_adhesivo_consumido_kg' => number_format($raw['lam_adhesivo_consumido_kg'], 3, '.', ''),
                'lam_catalizador_consumido_kg' => number_format($raw['lam_catalizador_consumido_kg'], 3, '.', ''),
                'lam_acetato_consumido_lt' => number_format($raw['lam_acetato_consumido_lt'], 3, '.', ''),
                'impresion_entrada_kg' => number_format($raw['impresion_entrada_kg'], 3, '.', ''),
                'laminacion_virgen_entrada_kg' => number_format($raw['laminacion_virgen_entrada_kg'], 3, '.', ''),
            ];
        }

        $lamConsumibleKg = $totals['lam_adhesivo_consumido_kg'] + $totals['lam_catalizador_consumido_kg'];

        return [
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'client_id' => $clientId,
            'totals' => [
                'tintas' => [
                    'total_original_kg' => number_format($totals['tintas_original_kg'], 3, '.', ''),
                    'total_solventadas_kg' => number_format($totals['tintas_solventadas_kg'], 3, '.', ''),
                    'alcohol_kg' => number_format($totals['tintas_alcohol_kg'], 3, '.', ''),
                    'metoxil_kg' => number_format($totals['tintas_metoxil_kg'], 3, '.', ''),
                    'npa_kg' => number_format($totals['tintas_npa_kg'], 3, '.', ''),
                ],
                'laminacion' => [
                    'adhesivo_sobra_kg' => number_format($totals['lam_adhesivo_sobra_kg'], 3, '.', ''),
                    'catalizador_sobra_kg' => number_format($totals['lam_catalizador_sobra_kg'], 3, '.', ''),
                    'acetato_sobra_lt' => number_format($totals['lam_acetato_sobra_lt'], 3, '.', ''),
                    'adhesivo_consumido_kg' => number_format($totals['lam_adhesivo_consumido_kg'], 3, '.', ''),
                    'catalizador_consumido_kg' => number_format($totals['lam_catalizador_consumido_kg'], 3, '.', ''),
                    'acetato_consumido_lt' => number_format($totals['lam_acetato_consumido_lt'], 3, '.', ''),
                    'total_consumible_kg' => number_format($lamConsumibleKg, 3, '.', ''),
                    'material_virgen_entrada_kg' => number_format($totals['laminacion_virgen_entrada_kg'], 3, '.', ''),
                ],
                'impresion' => [
                    'material_consumido_kg' => number_format($totals['impresion_entrada_kg'], 3, '.', ''),
                ],
            ],
            'work_orders' => $workOrders,
            'work_order_count' => count($workOrders),
        ];
    }
}
