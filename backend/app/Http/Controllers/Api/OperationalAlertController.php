<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OperationalAlert;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OperationalAlertController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = OperationalAlert::query()
            ->with(['workOrder:id,code', 'material:id,sku,name', 'acknowledgedByUser:id,name'])
            ->orderByDesc('created_at');

        if (filter_var($request->query('unread'), FILTER_VALIDATE_BOOLEAN)) {
            $query->unread();
        }

        if ($request->query('work_order_id')) {
            $query->where('work_order_id', $request->query('work_order_id'));
        }

        if ($request->query('severity')) {
            $query->where('severity', $request->query('severity'));
        }

        if ($request->query('alert_type')) {
            $query->where('alert_type', $request->query('alert_type'));
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 30), 100)));
    }

    public function acknowledge(Request $request, OperationalAlert $operational_alert): JsonResponse
    {
        if ($operational_alert->acknowledged_at !== null) {
            return response()->json($operational_alert);
        }

        $operational_alert->update([
            'acknowledged_at' => now(),
            'acknowledged_by' => $request->user()->getKey(),
        ]);

        return response()->json($operational_alert->fresh()->load(['workOrder:id,code', 'material:id,sku,name']));
    }
}
