<?php

namespace App\Http\Controllers\Api;

use App\Enums\AreaRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFacilityAreaRequest;
use App\Http\Requests\UpdateFacilityAreaRequest;
use App\Models\AreaRequest;
use App\Services\AreaRequestService;
use App\Services\OperationalAlertService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class AreaRequestController extends Controller
{
    public function __construct(
        private readonly AreaRequestService $areaRequestService,
        private readonly OperationalAlertService $operationalAlerts,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = AreaRequest::query()
            ->with(['workOrder:id,code', 'requester:id,name'])
            ->orderByDesc('created_at');

        if ($request->query('area')) {
            $query->where('area', $request->query('area'));
        }
        if ($request->query('status')) {
            $query->where('status', $request->query('status'));
        }

        $insumosOnly = $request->boolean('insumos_only')
            || strtolower(trim((string) $request->query('source', ''))) === 'insumos';

        if ($insumosOnly) {
            $this->areaRequestService->applyMaterialInsumosOnlyFilter($query);
            $origin = strtolower(trim((string) $request->query('insumos_origin', '')));
            if (in_array($origin, ['manual', 'ot_planilla'], true)) {
                $this->areaRequestService->applyInsumosOriginFilter($query, $origin);
            }
        } else {
            $this->areaRequestService->applyWorkOrderCoordinationListFilter($query);
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function counts(Request $request): JsonResponse
    {
        $status = strtolower(trim((string) $request->query('status', AreaRequestStatus::Pending->value)));
        if (! in_array($status, AreaRequestStatus::values(), true)) {
            $status = AreaRequestStatus::Pending->value;
        }

        $areasRaw = (string) $request->query('areas', '');
        $areas = array_values(array_filter(array_map(
            static fn ($v) => strtolower(trim((string) $v)),
            $areasRaw !== '' ? explode(',', $areasRaw) : []
        )));

        if ($areas === []) {
            $areas = ['impresion', 'laminacion', 'corte', 'tintas'];
        }

        $areas = array_values(array_unique($areas));

        $rows = AreaRequest::query()
            ->selectRaw('area, COUNT(DISTINCT work_order_id) as c')
            ->whereIn('area', $areas)
            ->where('status', $status)
            ->whereNotNull('work_order_id')
            ->groupBy('area')
            ->get();

        $counts = [];
        foreach ($areas as $a) {
            $counts[$a] = 0;
        }
        foreach ($rows as $r) {
            $counts[(string) $r->area] = (int) $r->c;
        }

        return response()->json([
            'status' => $status,
            'counts' => $counts,
        ]);
    }

    public function warehousePendingCount(): JsonResponse
    {
        $this->operationalAlerts->syncWarehouseAlertsForPendingMaterialRequests();
        $breakdown = $this->areaRequestService->pendingWarehouseInsumosBreakdown();

        return response()->json([
            'count' => $breakdown['total'],
            'manual_pending' => $breakdown['manual'],
            'ot_planilla_pending' => $breakdown['ot_planilla'],
        ]);
    }

    public function store(StoreFacilityAreaRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['requested_by'] = $request->user()->getKey();
        $data['status'] = $data['status'] ?? AreaRequestStatus::Pending->value;

        $row = AreaRequest::query()->create($data);

        return response()->json($row->load(['workOrder:id,code', 'requester:id,name']), 201);
    }

    public function update(UpdateFacilityAreaRequest $request, AreaRequest $area_request): JsonResponse
    {
        if ($area_request->material_request_id !== null) {
            throw ValidationException::withMessages([
                'area_request' => ['Esta fila proviene de una solicitud de insumos: cámbiela solo desde Solicitudes de insumos (autorizar, entregar o cancelar).'],
            ]);
        }

        $data = $request->validated();

        if (array_key_exists('title', $data) && $area_request->status !== AreaRequestStatus::Pending->value) {
            throw ValidationException::withMessages([
                'title' => ['Solo se puede editar el título mientras la solicitud está pendiente.'],
            ]);
        }

        $area_request->update($data);

        return response()->json($area_request->fresh()->load(['workOrder:id,code', 'requester:id,name']));
    }

    public function destroy(AreaRequest $area_request): Response
    {
        if ($area_request->material_request_id !== null) {
            throw ValidationException::withMessages([
                'area_request' => ['No se puede eliminar: es el aviso ligado a una solicitud de insumos.'],
            ]);
        }

        if ($area_request->status === AreaRequestStatus::Done->value) {
            throw ValidationException::withMessages([
                'area_request' => ['No se pueden eliminar solicitudes ya completadas.'],
            ]);
        }

        $area_request->delete();

        return response()->noContent();
    }
}
