<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePurchaseReceiptRequest;
use App\Models\PurchaseReceipt;
use App\Services\PurchaseReceiptService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PurchaseReceiptController extends Controller
{
    public function __construct(
        private readonly PurchaseReceiptService $receipts,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = PurchaseReceipt::query()
            ->with(['purchaseOrder.supplier', 'user'])
            ->withCount('lines')
            ->orderByDesc('received_at');

        if ($request->query('purchase_order_id')) {
            $query->where('purchase_order_id', $request->query('purchase_order_id'));
        }

        if ($request->has('without_purchase_order')) {
            $query->where('without_purchase_order', filter_var($request->query('without_purchase_order'), FILTER_VALIDATE_BOOLEAN));
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function store(StorePurchaseReceiptRequest $request): JsonResponse
    {
        $receipt = $this->receipts->store($request->validated(), $request->user());

        return response()->json($receipt, 201);
    }

    public function show(PurchaseReceipt $purchase_receipt): JsonResponse
    {
        $purchase_receipt->load(['lines.material', 'lines.purchaseOrderLine', 'purchaseOrder.supplier', 'user']);

        return response()->json($purchase_receipt);
    }
}
