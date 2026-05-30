<?php

namespace App\Http\Controllers\Api;

use App\Enums\MaterialRequestStatus;
use App\Enums\WorkOrderBoardStage;
use App\Enums\WorkOrderSchedulingStatus;
use App\Enums\WorkOrderStatus;
use App\Http\Controllers\Controller;
use App\Models\Bobina;
use App\Models\InventoryMovement;
use App\Models\InventoryReturn;
use App\Models\Material;
use App\Models\MaterialRequest;
use App\Models\OperationalAlert;
use App\Models\TintaMixture;
use App\Models\WorkOrder;
use App\Services\InventoryReportService;
use App\Support\DashboardMonthlyCorteProduction;
use App\Support\DashboardMonthlyProductionByArea;
use App\Support\DashboardRecentOtScrapChart;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function __construct(
        private readonly InventoryReportService $inventoryReports,
    ) {}

    /**
     * KPIs mínimos para el panel MVP (§4 CONTEXTO): stock, pendientes, actividad reciente.
     */
    public function summary(): JsonResponse
    {
        $materialsTotal = Material::query()->count();

        $byArea = Material::query()
            ->select('inventory_area', DB::raw('count(*) as count'))
            ->groupBy('inventory_area')
            ->pluck('count', 'inventory_area');

        $returnsPending = InventoryReturn::query()->where('status', 'pending')->count();

        $materialRequestsPending = MaterialRequest::query()
            ->whereIn('status', [MaterialRequestStatus::Pending->value, MaterialRequestStatus::Partial->value])
            ->count();

        $materialRequestCounts = MaterialRequest::query()
            ->select('status', DB::raw('count(*) as c'))
            ->groupBy('status')
            ->pluck('c', 'status');
        $materialRequestsByStatus = [];
        foreach (MaterialRequestStatus::cases() as $case) {
            $materialRequestsByStatus[$case->value] = (int) ($materialRequestCounts[$case->value] ?? 0);
        }

        $mixturesTotal = TintaMixture::query()->count();

        $movementsToday = InventoryMovement::query()
            ->whereDate('occurred_at', now()->toDateString())
            ->count();

        $lowStock = Material::query()
            ->whereColumn('quantity_on_hand', '<', 'min_stock')
            ->orderBy('inventory_area')
            ->orderBy('sku')
            ->limit(100)
            ->get(['id', 'sku', 'name', 'inventory_area', 'quantity_on_hand', 'min_stock', 'unit']);

        $workOrdersPendingProgramming = WorkOrder::query()
            ->where('status', '!=', WorkOrderStatus::Cancelled->value)
            ->where('scheduling_status', WorkOrderSchedulingStatus::PendingProgramming->value)
            ->count();

        $workOrdersInProgramming = WorkOrder::query()
            ->where('status', '!=', WorkOrderStatus::Cancelled->value)
            ->where('scheduling_status', WorkOrderSchedulingStatus::InProgramming->value)
            ->count();

        $workOrdersPendingProduction = WorkOrder::query()
            ->whereIn('status', [
                WorkOrderStatus::Open->value,
                WorkOrderStatus::InProgress->value,
            ])
            ->where('board_stage', '!=', WorkOrderBoardStage::Completada->value)
            ->count();

        $operationalAlertsUnread = OperationalAlert::query()->unread()->count();

        $monthStart = now()->startOfMonth();
        $monthEnd = now();
        $monthLabel = $monthStart->translatedFormat('F Y');

        $corteProductionMonthKg = DashboardMonthlyCorteProduction::totalKgBetween($monthStart, $monthEnd);
        $scrapMonth = $this->inventoryReports->scrapKgTotalsForPeriod($monthStart, $monthEnd);
        $recentFinalizedOtScrap = DashboardRecentOtScrapChart::rows(10);
        $productionByAreaMonth = DashboardMonthlyProductionByArea::rows(5);
        $rejectedReturnsBobinasMonth = Bobina::query()
            ->where('status', 'rejected')
            ->whereBetween('created_at', [$monthStart, $monthEnd->copy()->endOfDay()])
            ->whereHas('inventoryReturn', function ($query): void {
                $query->where('destination_area', 'bobinas_rechazadas');
            })
            ->count();

        return response()->json([
            'generated_at' => now()->toIso8601String(),
            'month_label' => $monthLabel,
            'corte_production_month_kg' => $corteProductionMonthKg,
            'scrap_month_kg' => $scrapMonth['total_kg'],
            'scrap_month_by_area_kg' => [
                'printing' => $scrapMonth['printing_kg'],
                'laminacion' => $scrapMonth['laminacion_kg'],
                'corte' => $scrapMonth['corte_kg'],
            ],
            'recent_finalized_ot_scrap' => $recentFinalizedOtScrap,
            'production_by_area_month' => $productionByAreaMonth,
            'rejected_returns_bobinas_month' => $rejectedReturnsBobinasMonth,
            'materials_total' => $materialsTotal,
            'materials_by_area' => $byArea,
            'inventory_returns_pending' => $returnsPending,
            'material_requests_pending' => $materialRequestsPending,
            'material_requests_by_status' => $materialRequestsByStatus,
            'work_orders_pending_programming' => $workOrdersPendingProgramming,
            'work_orders_in_programming' => $workOrdersInProgramming,
            'work_orders_pending_production' => $workOrdersPendingProduction,
            'operational_alerts_unread' => $operationalAlertsUnread,
            'tinta_mixtures_total' => $mixturesTotal,
            'movements_today' => $movementsToday,
            'materials_low_stock' => $lowStock,
        ]);
    }
}
