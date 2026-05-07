<?php

namespace App\Http\Controllers\Api;

use App\Enums\AreaRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFacilityAreaRequest;
use App\Http\Requests\UpdateFacilityAreaRequest;
use App\Models\AreaRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AreaRequestController extends Controller
{
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
        $area_request->update($request->validated());

        return response()->json($area_request->fresh()->load(['workOrder:id,code', 'requester:id,name']));
    }
}
