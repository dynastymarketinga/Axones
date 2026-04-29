<?php

namespace App\Services;

use App\Enums\InventoryArea;
use App\Models\Bobina;
use App\Models\Client;
use App\Models\InventoryReturn;
use App\Models\Material;
use App\Models\CorteBobinaUsage;
use App\Models\LaminacionBobinaUsage;
use App\Models\MontajeMaterialUsage;
use App\Models\PrintingBobinaUsage;
use App\Models\Product;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class InventoryReportService
{
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
    public function rowsToCsv(array $rows): string
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
        fputcsv($stream, $headers);

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
            fputcsv($stream, $line);
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
     * Segundos de montaje/producción/tiempo muerto por área y máquina (PDF reportes de tiempos).
     *
     * @return array{from: string, to: string, rows: list<array<string, mixed>>}
     */
    public function productionTimesByArea(Carbon $from, Carbon $to): array
    {
        $tables = [
            'printing' => 'printing_time_segments',
            'corte' => 'corte_time_segments',
            'laminacion' => 'laminacion_time_segments',
            'montaje' => 'montaje_time_segments',
        ];
        $rows = [];
        foreach ($tables as $area => $table) {
            $rows = array_merge($rows, $this->sumClosedSegmentsForTable($table, $area, $from, $to));
        }

        return [
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'rows' => $rows,
        ];
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
     * Mermas registradas por OT y área (filtro por creación de OT).
     *
     * @return array{from: string, to: string, rows: list<array<string, mixed>>}
     */
    public function scrapByFilters(Carbon $from, Carbon $to, ?int $clientId = null, ?int $productId = null): array
    {
        $defs = [
            ['area' => 'printing', 'table' => 'work_order_printing_summaries'],
            ['area' => 'corte', 'table' => 'work_order_corte_summaries'],
            ['area' => 'laminacion', 'table' => 'work_order_laminacion_summaries'],
            ['area' => 'montaje', 'table' => 'work_order_montaje_summaries'],
        ];
        $rows = [];
        foreach ($defs as $def) {
            $q = DB::table($def['table'].' as s')
                ->join('work_orders as wo', 's.work_order_id', '=', 'wo.id')
                ->leftJoin('clients as c', 'wo.client_id', '=', 'c.id')
                ->whereNotNull('s.scrap_percent')
                ->whereBetween('wo.created_at', [$from, $to]);
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
                'wo.client_id',
                'c.name as client_name',
                'wo.product_id',
                's.scrap_percent',
            ]) as $r) {
                $rows[] = [
                    'work_order_id' => (int) $r->work_order_id,
                    'work_order_code' => $r->work_order_code,
                    'client_id' => $r->client_id !== null ? (int) $r->client_id : null,
                    'client_name' => $r->client_name,
                    'product_id' => $r->product_id !== null ? (int) $r->product_id : null,
                    'area' => $area,
                    'scrap_percent' => number_format((float) $r->scrap_percent, 3, '.', ''),
                ];
            }
        }

        return [
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'rows' => $rows,
        ];
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
}
