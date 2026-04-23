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
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class InventoryReportService
{
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
