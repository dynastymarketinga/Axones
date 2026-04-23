<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreWorkOrderQualityRequest;
use App\Models\WorkOrder;
use App\Models\WorkOrderQualityRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\View;

class WorkOrderQualityController extends Controller
{
    public function show(WorkOrder $work_order): JsonResponse
    {
        $record = WorkOrderQualityRecord::query()
            ->where('work_order_id', $work_order->getKey())
            ->with('recorder:id,name')
            ->first();

        return response()->json([
            'work_order_id' => $work_order->getKey(),
            'record' => $record,
        ]);
    }

    public function update(StoreWorkOrderQualityRequest $request, WorkOrder $work_order): JsonResponse
    {
        $data = $request->validated();
        $data['recorded_by'] = $request->user()->getKey();

        $record = WorkOrderQualityRecord::query()->updateOrCreate(
            ['work_order_id' => $work_order->getKey()],
            $data,
        );

        return response()->json($record->fresh()->load('recorder:id,name'));
    }

    /**
     * Certificado para el cliente (HTML descargable; PDF puede añadirse después) — PDF §4.
     */
    public function downloadCertificate(WorkOrder $work_order): Response
    {
        $work_order->loadMissing(['client', 'product']);
        $record = WorkOrderQualityRecord::query()
            ->where('work_order_id', $work_order->getKey())
            ->first();

        $html = $record?->certificate_body;
        if ($html === null || $html === '') {
            $html = View::make('certificates.quality', [
                'workOrder' => $work_order,
                'record' => $record,
            ])->render();
        }

        return new Response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="certificado-calidad-'.$work_order->code.'.html"',
        ]);
    }
}
