<?php

namespace App\Http\Controllers\Api;

use Barryvdh\DomPDF\Facade\Pdf;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreWorkOrderQualityRequest;
use App\Models\WorkOrder;
use App\Models\WorkOrderQualityRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

    public function previewCertificate(Request $request, WorkOrder $work_order): Response
    {
        $work_order->loadMissing(['client', 'product']);
        $record = WorkOrderQualityRecord::query()
            ->where('work_order_id', $work_order->getKey())
            ->with('recorder:id,name')
            ->first();

        $html = $this->buildCertificateHtml($work_order, $record, (string) ($request->user()?->name ?? 'Usuario no identificado'));

        return new Response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="vista-previa-certificado-calidad-'.$work_order->code.'.html"',
        ]);
    }

    public function downloadCertificate(Request $request, WorkOrder $work_order): Response
    {
        $work_order->loadMissing(['client', 'product']);
        $record = WorkOrderQualityRecord::query()
            ->where('work_order_id', $work_order->getKey())
            ->with('recorder:id,name')
            ->first();

        $html = $this->buildCertificateHtml($work_order, $record, (string) ($request->user()?->name ?? 'Usuario no identificado'));

        return new Response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="certificado-calidad-'.$work_order->code.'.html"',
        ]);
    }

    public function downloadCertificatePdf(Request $request, WorkOrder $work_order): Response
    {
        $work_order->loadMissing(['client', 'product']);
        $record = WorkOrderQualityRecord::query()
            ->where('work_order_id', $work_order->getKey())
            ->with('recorder:id,name')
            ->first();

        $html = $this->buildCertificateHtml($work_order, $record, (string) ($request->user()?->name ?? 'Usuario no identificado'));
        $pdf = Pdf::loadHTML($html)->setPaper('a4', 'portrait');

        return $pdf->download('certificado-calidad-'.$work_order->code.'.pdf');
    }

    private function buildCertificateHtml(WorkOrder $workOrder, ?WorkOrderQualityRecord $record, string $generatedBy): string
    {
        $html = $record?->certificate_body;
        if ($html !== null && trim($html) !== '') {
            return $html;
        }

        return View::make('certificates.quality', [
            'workOrder' => $workOrder,
            'record' => $record,
            'generatedBy' => $generatedBy,
            'generatedAt' => now(),
            'outcomeLabel' => $this->outcomeLabel($record?->outcome),
        ])->render();
    }

    private function outcomeLabel(?string $outcome): string
    {
        return match (strtolower(trim((string) $outcome))) {
            'pass', 'approved', 'aprobado' => 'Aprobado',
            'fail', 'rejected', 'rechazado' => 'Rechazado',
            'pending', 'pendiente' => 'Pendiente',
            default => 'Pendiente',
        };
    }
}
