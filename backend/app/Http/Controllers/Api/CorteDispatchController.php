<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CorteDispatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CorteDispatchController extends Controller
{
    public function __construct(
        private readonly CorteDispatchService $corteDispatch,
    ) {}

    /**
     * Material terminado en corte pendiente de asignar a notas de entrega (saldo por línea de corte).
     */
    public function available(Request $request): JsonResponse
    {
        $workOrderId = $request->query('work_order_id');
        $productId = $request->query('product_id');
        $clientId = $request->query('client_id');

        $rows = $this->corteDispatch->listAvailableForDispatch(
            $workOrderId !== null && $workOrderId !== '' ? (int) $workOrderId : null,
            $productId !== null && $productId !== '' ? (int) $productId : null,
            $clientId !== null && $clientId !== '' ? (int) $clientId : null,
        );

        return response()->json([
            'rows' => $rows,
        ]);
    }
}
