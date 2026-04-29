<?php

namespace App\Http\Controllers\Api;

use Barryvdh\DomPDF\Facade\Pdf;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePurchaseReceiptRequest;
use App\Models\PurchaseReceipt;
use App\Services\PurchaseReceiptService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\View;

class PurchaseReceiptController extends Controller
{
    public function __construct(
        private readonly PurchaseReceiptService $receipts,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = PurchaseReceipt::query()
            ->with(['supplier', 'purchaseOrder.supplier', 'user', 'lines.material:id,sku,name'])
            ->withCount('lines')
            ->orderByDesc('received_at');

        if ($request->query('purchase_order_id')) {
            $query->where('purchase_order_id', $request->query('purchase_order_id'));
        }

        if ($request->has('without_purchase_order')) {
            $query->where('without_purchase_order', filter_var($request->query('without_purchase_order'), FILTER_VALIDATE_BOOLEAN));
        }

        $supplierName = trim((string) $request->query('supplier_name', ''));
        if ($supplierName !== '') {
            $query->where(function ($q) use ($supplierName): void {
                $q->whereHas('supplier', function ($sq) use ($supplierName): void {
                    $sq->where('name', 'like', '%'.$supplierName.'%')
                        ->orWhere('rif', 'like', '%'.$supplierName.'%');
                })->orWhere('supplier_name', 'like', '%'.$supplierName.'%');
            });
        }

        $invoiceNumber = trim((string) $request->query('invoice_number', ''));
        if ($invoiceNumber !== '') {
            $query->where('invoice_number', 'like', '%'.$invoiceNumber.'%');
        }

        $materialTerm = trim((string) $request->query('material_term', ''));
        if ($materialTerm !== '') {
            $query->whereHas('lines.material', function ($q) use ($materialTerm): void {
                $q->where('sku', 'like', '%'.$materialTerm.'%');
            });
        }

        $from = trim((string) $request->query('from', ''));
        if ($from !== '') {
            $query->whereDate('received_at', '>=', $from);
        }

        $to = trim((string) $request->query('to', ''));
        if ($to !== '') {
            $query->whereDate('received_at', '<=', $to);
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function store(StorePurchaseReceiptRequest $request): JsonResponse
    {
        $receipt = $this->receipts->store($request->validated(), $request->user());

        return response()->json($receipt, 201);
    }

    public function checkDuplicates(Request $request): JsonResponse
    {
        $supplierId = (int) $request->query('supplier_id', 0);
        $invoiceNumber = trim((string) $request->query('invoice_number', ''));
        $purchaseOrderReference = trim((string) $request->query('purchase_order_reference', ''));

        if ($supplierId < 1 || ($invoiceNumber === '' && $purchaseOrderReference === '')) {
            return response()->json([
                'has_duplicates' => false,
                'matches' => [],
                'total_matches' => 0,
            ]);
        }

        $matches = PurchaseReceipt::query()
            ->with(['supplier:id,name'])
            ->where('supplier_id', $supplierId)
            ->where(function ($q) use ($invoiceNumber, $purchaseOrderReference): void {
                if ($invoiceNumber !== '') {
                    $q->orWhere('invoice_number', $invoiceNumber);
                }
                if ($purchaseOrderReference !== '') {
                    $q->orWhere('purchase_order_reference', $purchaseOrderReference);
                }
            })
            ->orderByDesc('received_at')
            ->limit(10)
            ->get([
                'id',
                'supplier_id',
                'supplier_name',
                'invoice_number',
                'purchase_order_reference',
                'received_at',
            ]);

        return response()->json([
            'has_duplicates' => $matches->isNotEmpty(),
            'total_matches' => $matches->count(),
            'matches' => $matches,
        ]);
    }

    public function show(PurchaseReceipt $purchase_receipt): JsonResponse
    {
        $purchase_receipt->load(['supplier', 'lines.material', 'lines.purchaseOrderLine', 'purchaseOrder.supplier', 'user']);

        return response()->json($purchase_receipt);
    }

    public function previewReport(Request $request, PurchaseReceipt $purchase_receipt): Response
    {
        $purchase_receipt->loadMissing(['supplier', 'lines.material', 'user']);
        $html = $this->buildReportHtml(
            $purchase_receipt,
            (string) ($request->user()?->name ?? 'Usuario no identificado'),
        );

        return new Response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="vista-previa-recepcion-'.$purchase_receipt->id.'.html"',
        ]);
    }

    public function downloadReport(Request $request, PurchaseReceipt $purchase_receipt): Response
    {
        $purchase_receipt->loadMissing(['supplier', 'lines.material', 'user']);
        $html = $this->buildReportHtml(
            $purchase_receipt,
            (string) ($request->user()?->name ?? 'Usuario no identificado'),
        );

        return new Response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="reporte-recepcion-'.$purchase_receipt->id.'.html"',
        ]);
    }

    public function downloadReportPdf(Request $request, PurchaseReceipt $purchase_receipt): Response
    {
        $purchase_receipt->loadMissing(['supplier', 'lines.material', 'user']);
        $html = $this->buildReportHtml(
            $purchase_receipt,
            (string) ($request->user()?->name ?? 'Usuario no identificado'),
        );
        $pdf = Pdf::loadHTML($html)->setPaper('a4', 'portrait');

        return $pdf->download('reporte-recepcion-'.$purchase_receipt->id.'.pdf');
    }

    private function buildReportHtml(PurchaseReceipt $receipt, string $generatedBy): string
    {
        return View::make('certificates.receipt_formal', [
            'receipt' => $receipt,
            'generatedBy' => $generatedBy,
            'generatedAt' => now(),
        ])->render();
    }

}
