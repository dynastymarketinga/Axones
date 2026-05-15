<?php

use App\Http\Controllers\Api\AreaRequestController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BobinaController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\ClientOrderController;
use App\Http\Controllers\Api\CorteDispatchController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DeliveryNoteController;
use App\Http\Controllers\Api\GateMovementController;
use App\Http\Controllers\Api\InventoryChangeApprovalController;
use App\Http\Controllers\Api\InventoryMovementController;
use App\Http\Controllers\Api\InventoryMovementsController;
use App\Http\Controllers\Api\InventoryReturnController;
use App\Http\Controllers\Api\MaterialController;
use App\Http\Controllers\Api\MaterialRequestController;
use App\Http\Controllers\Api\MiscellaneousReceiptController;
use App\Http\Controllers\Api\OperationalAlertController;
use App\Http\Controllers\Api\OperationalAlertStreamController;
use App\Http\Controllers\Api\PasswordResetRequestController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\PurchaseReceiptController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\TintaMixtureController;
use App\Http\Controllers\Api\UserPasswordController;
use App\Http\Controllers\Api\VendorController;
use App\Http\Controllers\Api\WorkOrderController;
use App\Http\Controllers\Api\WorkOrderCorteController;
use App\Http\Controllers\Api\WorkOrderLaminacionController;
use App\Http\Controllers\Api\WorkOrderMontajeController;
use App\Http\Controllers\Api\WorkOrderNotaEntregaController;
use App\Http\Controllers\Api\WorkOrderOrdenTrabajoController;
use App\Http\Controllers\Api\WorkOrderPrintingController;
use App\Http\Controllers\Api\WorkOrderProductionSummaryController;
use App\Http\Controllers\Api\WorkOrderQualityController;
use App\Http\Controllers\Api\WorkOrderTintasController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/ping', fn () => ['ok' => true, 'service' => 'axones-api']);

Route::middleware('throttle:10,1')->post('/auth/login', [AuthController::class, 'login']);

if (app()->environment('local')) {
    Route::post('/auth/register', [AuthController::class, 'register']);
}

Route::middleware('throttle:5,1')->post('/auth/password-reset-request', [PasswordResetRequestController::class, 'store']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Request $request) {
        $u = $request->user();

        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'username' => $u->username,
            'role' => $u->role ?? 'general',
        ];
    });
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/password-reset-requests', [PasswordResetRequestController::class, 'index']);
    Route::patch('/password-reset-requests/{password_reset_request}/resolve', [PasswordResetRequestController::class, 'resolve']);
    Route::patch('/users/{user}/password', [UserPasswordController::class, 'update']);

    Route::get('/dashboard/summary', [DashboardController::class, 'summary']);

    Route::get('/alerts', [OperationalAlertController::class, 'index']);
    Route::get('/alerts/stream', [OperationalAlertStreamController::class, 'stream']);
    Route::patch('/alerts/{operational_alert}/acknowledge', [OperationalAlertController::class, 'acknowledge']);
    Route::post('/alerts/acknowledge-all', [OperationalAlertController::class, 'acknowledgeAll']);
    Route::post('/alerts/acknowledge-work-order-area', [OperationalAlertController::class, 'acknowledgeWorkOrderArea']);

    Route::get('/reports/inventory-daily', [ReportController::class, 'inventoryDaily']);
    Route::get('/reports/inventory-movements-general', [ReportController::class, 'inventoryMovementsGeneral']);
    Route::get('/reports/inventory-movements-general/preview', [ReportController::class, 'inventoryMovementsGeneralPreview']);
    Route::get('/reports/inventory-movements-general.pdf', [ReportController::class, 'inventoryMovementsGeneralPdf']);
    Route::get('/reports/inventory-area-daily', [ReportController::class, 'inventoryAreaDaily']);
    Route::get('/reports/inventory-area-daily/preview', [ReportController::class, 'inventoryAreaDailyPreview']);
    Route::get('/reports/inventory-area-daily.pdf', [ReportController::class, 'inventoryAreaDailyPdf']);
    Route::get('/reports/consumption-by-client-product', [ReportController::class, 'consumptionByClientProduct']);
    Route::get('/reports/rejected-bobinas', [ReportController::class, 'rejectedBobinas']);
    Route::get('/reports/work-order-material-summary', [ReportController::class, 'workOrderMaterialSummary']);
    Route::get('/reports/production-time-by-area', [ReportController::class, 'productionTimeByArea']);
    Route::get('/reports/production-time-by-area/preview', [ReportController::class, 'productionTimeByAreaPreview']);
    Route::get('/reports/production-time-by-area.pdf', [ReportController::class, 'productionTimeByAreaPdf']);
    Route::get('/reports/work-order-time-report/candidates', [ReportController::class, 'workOrderTimeReportCandidates']);
    Route::get('/reports/work-order-time-report', [ReportController::class, 'workOrderTimeReport']);
    Route::get('/reports/work-order-time-report/preview', [ReportController::class, 'workOrderTimeReportPreview']);
    Route::get('/reports/work-order-time-report.pdf', [ReportController::class, 'workOrderTimeReportPdf']);
    Route::get('/reports/scrap-by-filters/preview', [ReportController::class, 'scrapByFiltersPreview']);
    Route::get('/reports/scrap-by-filters.pdf', [ReportController::class, 'scrapByFiltersPdf']);
    Route::get('/reports/scrap-by-filters', [ReportController::class, 'scrapByFilters']);
    Route::get('/reports/tinta-consumption-by-client', [ReportController::class, 'tintaConsumptionByClient']);

    Route::get('/inventory-movements', [InventoryMovementsController::class, 'index']);

    Route::get('/miscellaneous-receipts', [MiscellaneousReceiptController::class, 'index']);
    Route::post('/miscellaneous-receipts', [MiscellaneousReceiptController::class, 'store']);
    Route::get('/miscellaneous-receipts/{miscellaneous_receipt}', [MiscellaneousReceiptController::class, 'show']);
    Route::get('/miscellaneous-receipts/{miscellaneous_receipt}/attachments/{miscellaneous_receipt_attachment}', [MiscellaneousReceiptController::class, 'downloadAttachment']);

    Route::get('/clients', [ClientController::class, 'index']);
    Route::post('/clients', [ClientController::class, 'store']);
    Route::get('/clients/{client}', [ClientController::class, 'show']);
    Route::patch('/clients/{client}', [ClientController::class, 'update']);

    Route::get('/client-orders', [ClientOrderController::class, 'index']);
    Route::post('/client-orders', [ClientOrderController::class, 'store']);
    Route::get('/client-orders/{client_order}', [ClientOrderController::class, 'show']);
    Route::patch('/client-orders/{client_order}', [ClientOrderController::class, 'update']);

    Route::get('/suppliers', [SupplierController::class, 'index']);
    Route::post('/suppliers', [SupplierController::class, 'store']);
    Route::get('/suppliers/{supplier}', [SupplierController::class, 'show']);
    Route::patch('/suppliers/{supplier}', [SupplierController::class, 'update']);

    Route::get('/products', [ProductController::class, 'index']);
    Route::post('/products', [ProductController::class, 'store']);
    Route::get('/products/{product}', [ProductController::class, 'show']);
    Route::patch('/products/{product}', [ProductController::class, 'update']);

    Route::get('/vendors', [VendorController::class, 'index']);
    Route::post('/vendors', [VendorController::class, 'store']);
    Route::get('/vendors/{vendor}', [VendorController::class, 'show']);
    Route::patch('/vendors/{vendor}', [VendorController::class, 'update']);

    Route::get('/purchase-orders', [PurchaseOrderController::class, 'index']);
    Route::post('/purchase-orders', [PurchaseOrderController::class, 'store']);
    Route::get('/purchase-orders/{purchase_order}', [PurchaseOrderController::class, 'show']);
    Route::patch('/purchase-orders/{purchase_order}', [PurchaseOrderController::class, 'update']);
    Route::get('/purchase-orders/{purchase_order}/consuming-work-orders', [PurchaseOrderController::class, 'consumingWorkOrders']);
    Route::post('/purchase-orders/{purchase_order}/manual-close', [PurchaseOrderController::class, 'manualClose']);
    Route::post('/purchase-orders/{purchase_order}/reopen', [PurchaseOrderController::class, 'reopen']);

    Route::get('/purchase-receipts', [PurchaseReceiptController::class, 'index']);
    Route::post('/purchase-receipts', [PurchaseReceiptController::class, 'store'])
        ->middleware('area.role:inventory');
    Route::get('/purchase-receipts/check-duplicates', [PurchaseReceiptController::class, 'checkDuplicates']);
    Route::get('/purchase-receipts/{purchase_receipt}', [PurchaseReceiptController::class, 'show']);
    Route::get('/purchase-receipts/{purchase_receipt}/report/preview', [PurchaseReceiptController::class, 'previewReport']);
    Route::get('/purchase-receipts/{purchase_receipt}/report', [PurchaseReceiptController::class, 'downloadReport']);
    Route::get('/purchase-receipts/{purchase_receipt}/report.pdf', [PurchaseReceiptController::class, 'downloadReportPdf']);

    Route::get('/work-orders', [WorkOrderController::class, 'index']);
    Route::get('/work-orders/programacion-board', [WorkOrderController::class, 'programacionBoard']);
    Route::post('/work-orders', [WorkOrderController::class, 'store']);
    Route::get('/work-orders/{work_order}', [WorkOrderController::class, 'show']);
    Route::get('/work-orders/{work_order}/orden-produccion.pdf', [WorkOrderController::class, 'ordenProduccionPdf']);
    Route::get('/work-orders/{work_order}/orden-produccion-planilla/preview', [WorkOrderController::class, 'previewPlanillaReport'])
        ->middleware('area.role:planilla_read');
    Route::get('/work-orders/{work_order}/orden-produccion-planilla.pdf', [WorkOrderController::class, 'downloadPlanillaReportPdf'])
        ->middleware('area.role:planilla_read');
    Route::get('/work-orders/{work_order}/orden-trabajo', [WorkOrderOrdenTrabajoController::class, 'show'])
        ->middleware('area.role:planilla_read');
    Route::put('/work-orders/{work_order}/orden-trabajo', [WorkOrderOrdenTrabajoController::class, 'update'])
        ->middleware('area.role:planilla_write');
    Route::patch('/work-orders/{work_order}/orden-trabajo/printing-control', [WorkOrderOrdenTrabajoController::class, 'mergePrintingControl'])
        ->middleware('area.role:printing');
    Route::patch('/work-orders/{work_order}/orden-trabajo/laminacion-control', [WorkOrderOrdenTrabajoController::class, 'mergeLaminacionControl'])
        ->middleware('area.role:laminacion');
    Route::patch('/work-orders/{work_order}/orden-trabajo/corte-control', [WorkOrderOrdenTrabajoController::class, 'mergeCorteControl'])
        ->middleware('area.role:corte');
    Route::patch('/work-orders/{work_order}', [WorkOrderController::class, 'update'])
        ->middleware('area.role:planilla_write');
    Route::get('/work-orders/{work_order}/production-summary', [WorkOrderProductionSummaryController::class, 'show'])
        ->middleware('area.role:planilla_read');

    Route::get('/work-orders/{work_order}/quality', [WorkOrderQualityController::class, 'show']);
    Route::put('/work-orders/{work_order}/quality', [WorkOrderQualityController::class, 'update']);
    Route::get('/work-orders/{work_order}/quality/certificate/preview', [WorkOrderQualityController::class, 'previewCertificate']);
    Route::get('/work-orders/{work_order}/quality/certificate', [WorkOrderQualityController::class, 'downloadCertificate']);
    Route::get('/work-orders/{work_order}/quality/certificate.pdf', [WorkOrderQualityController::class, 'downloadCertificatePdf']);

    Route::get('/work-orders/{work_order}/printing', [WorkOrderPrintingController::class, 'show'])
        ->middleware('area.role:printing');
    Route::post('/work-orders/{work_order}/printing/time-segments/start', [WorkOrderPrintingController::class, 'startTimeSegment'])
        ->middleware('area.role:printing');
    Route::post('/work-orders/{work_order}/printing/time-segments/{printing_time_segment}/stop', [WorkOrderPrintingController::class, 'stopTimeSegment'])
        ->middleware('area.role:printing');
    Route::post('/work-orders/{work_order}/printing/bobina-usages', [WorkOrderPrintingController::class, 'storeBobinaUsage'])
        ->middleware('area.role:printing');
    Route::patch('/work-orders/{work_order}/printing/summary', [WorkOrderPrintingController::class, 'updateSummary'])
        ->middleware('area.role:printing');
    Route::put('/work-orders/{work_order}/printing/consumables', [WorkOrderPrintingController::class, 'updateConsumables'])
        ->middleware('area.role:printing');

    Route::get('/work-orders/{work_order}/tintas', [WorkOrderTintasController::class, 'show'])
        ->middleware('area.role:tintas');
    Route::post('/work-orders/{work_order}/tintas/time-segments/start', [WorkOrderTintasController::class, 'startTimeSegment'])
        ->middleware('area.role:tintas');
    Route::post('/work-orders/{work_order}/tintas/time-segments/{tintas_time_segment}/stop', [WorkOrderTintasController::class, 'stopTimeSegment'])
        ->middleware('area.role:tintas');
    Route::patch('/work-orders/{work_order}/tintas/summary', [WorkOrderTintasController::class, 'updateSummary'])
        ->middleware('area.role:tintas');
    Route::put('/work-orders/{work_order}/tintas/consumables', [WorkOrderTintasController::class, 'updateConsumables'])
        ->middleware('area.role:tintas');

    Route::get('/work-orders/{work_order}/corte', [WorkOrderCorteController::class, 'show'])
        ->middleware('area.role:corte');
    Route::post('/work-orders/{work_order}/corte/time-segments/start', [WorkOrderCorteController::class, 'startTimeSegment'])
        ->middleware('area.role:corte');
    Route::post('/work-orders/{work_order}/corte/time-segments/{corte_time_segment}/stop', [WorkOrderCorteController::class, 'stopTimeSegment'])
        ->middleware('area.role:corte');
    Route::post('/work-orders/{work_order}/corte/bobina-usages', [WorkOrderCorteController::class, 'storeBobinaUsage'])
        ->middleware('area.role:corte');
    Route::patch('/work-orders/{work_order}/corte/summary', [WorkOrderCorteController::class, 'updateSummary'])
        ->middleware('area.role:corte');

    Route::get('/work-orders/{work_order}/laminacion', [WorkOrderLaminacionController::class, 'show'])
        ->middleware('area.role:laminacion');
    Route::post('/work-orders/{work_order}/laminacion/time-segments/start', [WorkOrderLaminacionController::class, 'startTimeSegment'])
        ->middleware('area.role:laminacion');
    Route::post('/work-orders/{work_order}/laminacion/time-segments/{laminacion_time_segment}/stop', [WorkOrderLaminacionController::class, 'stopTimeSegment'])
        ->middleware('area.role:laminacion');
    Route::post('/work-orders/{work_order}/laminacion/bobina-usages', [WorkOrderLaminacionController::class, 'storeBobinaUsage'])
        ->middleware('area.role:laminacion');
    Route::patch('/work-orders/{work_order}/laminacion/summary', [WorkOrderLaminacionController::class, 'updateSummary'])
        ->middleware('area.role:laminacion');

    Route::get('/work-orders/{work_order}/montaje', [WorkOrderMontajeController::class, 'show'])
        ->middleware('area.role:montaje');
    Route::post('/work-orders/{work_order}/montaje/time-segments/start', [WorkOrderMontajeController::class, 'startTimeSegment'])
        ->middleware('area.role:montaje');
    Route::post('/work-orders/{work_order}/montaje/time-segments/{montaje_time_segment}/stop', [WorkOrderMontajeController::class, 'stopTimeSegment'])
        ->middleware('area.role:montaje');
    Route::post('/work-orders/{work_order}/montaje/material-usages', [WorkOrderMontajeController::class, 'storeMaterialUsage'])
        ->middleware('area.role:montaje');
    Route::patch('/work-orders/{work_order}/montaje/summary', [WorkOrderMontajeController::class, 'updateSummary'])
        ->middleware('area.role:montaje');

    Route::get('/work-orders/{work_order}/nota-entrega/prefill', [WorkOrderNotaEntregaController::class, 'prefill']);

    Route::get('/delivery-notes', [DeliveryNoteController::class, 'index']);
    Route::post('/delivery-notes', [DeliveryNoteController::class, 'store']);
    Route::get('/delivery-notes/{delivery_note}', [DeliveryNoteController::class, 'show']);
    Route::patch('/delivery-notes/{delivery_note}', [DeliveryNoteController::class, 'update']);
    Route::post('/delivery-notes/{delivery_note}/dispatch', [DeliveryNoteController::class, 'markDispatched']);

    Route::get('/corte-dispatch/available', [CorteDispatchController::class, 'available']);

    Route::get('/area-requests', [AreaRequestController::class, 'index']);
    Route::get('/area-requests/counts', [AreaRequestController::class, 'counts']);
    Route::post('/area-requests', [AreaRequestController::class, 'store']);
    Route::patch('/area-requests/{area_request}', [AreaRequestController::class, 'update']);
    Route::delete('/area-requests/{area_request}', [AreaRequestController::class, 'destroy']);

    Route::get('/gate-movements', [GateMovementController::class, 'index']);
    Route::post('/gate-movements', [GateMovementController::class, 'store']);

    Route::get('/material-requests', [MaterialRequestController::class, 'index']);
    Route::post('/material-requests', [MaterialRequestController::class, 'store']);
    Route::get('/material-requests/{material_request}', [MaterialRequestController::class, 'show']);
    Route::patch('/material-requests/{material_request}', [MaterialRequestController::class, 'update']);
    Route::post('/material-requests/{material_request}/authorize', [MaterialRequestController::class, 'authorizeRequest']);
    Route::post('/material-requests/{material_request}/dispatch', [MaterialRequestController::class, 'invokeDispatch']);

    Route::get('/materials', [MaterialController::class, 'index']);
    Route::get('/materials/check-duplicates', [MaterialController::class, 'checkDuplicates']);
    Route::post('/materials', [MaterialController::class, 'store'])
        ->middleware('area.role:inventory');
    Route::get('/materials/{material}', [MaterialController::class, 'show']);
    Route::patch('/materials/{material}', [MaterialController::class, 'update'])
        ->middleware('area.role:inventory');

    Route::get('/materials/{material}/movements', [InventoryMovementController::class, 'index']);
    Route::post('/materials/{material}/movements', [InventoryMovementController::class, 'store']);

    Route::get('/inventory-returns', [InventoryReturnController::class, 'index']);
    Route::get('/inventory-returns/{inventory_return}', [InventoryReturnController::class, 'show']);
    Route::post('/inventory-returns', [InventoryReturnController::class, 'store']);
    Route::post('/inventory-returns/{inventory_return}/accept', [InventoryReturnController::class, 'accept']);

    Route::get('/inventory-change-approvals', [InventoryChangeApprovalController::class, 'index']);
    Route::post('/inventory-change-approvals', [InventoryChangeApprovalController::class, 'store']);
    Route::patch('/inventory-change-approvals/{inventory_change_approval}/decision', [InventoryChangeApprovalController::class, 'decide']);

    Route::get('/bobinas', [BobinaController::class, 'index']);
    Route::post('/bobinas', [BobinaController::class, 'store']);
    Route::get('/bobinas/{bobina}', [BobinaController::class, 'show']);
    Route::patch('/bobinas/{bobina}', [BobinaController::class, 'update']);

    Route::get('/tinta-mixtures', [TintaMixtureController::class, 'index']);
    Route::post('/tinta-mixtures', [TintaMixtureController::class, 'store'])
        ->middleware('area.role:tintas');
    Route::get('/tinta-mixtures/{tinta_mixture}', [TintaMixtureController::class, 'show']);
});
