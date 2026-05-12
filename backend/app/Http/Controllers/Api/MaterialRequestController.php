<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\MaterialRequestDispatchRequest;
use App\Http\Requests\MaterialRequestPatchRequest;
use App\Http\Requests\MaterialRequestStoreRequest;
use App\Models\MaterialRequest;
use App\Models\WorkOrder;
use App\Services\MaterialRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MaterialRequestController extends Controller
{
    public function __construct(
        private readonly MaterialRequestService $materialRequests,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = MaterialRequest::query()
            ->with(['workOrder.client', 'requester'])
            ->withCount('lines')
            ->with([
                'lines' => static function ($q): void {
                    $q->orderBy('id')->limit(8)->with('material');
                },
            ])
            ->orderByDesc('created_at');

        if ($request->query('work_order_id')) {
            $query->where('work_order_id', $request->query('work_order_id'));
        }

        $status = $request->query('status');
        if ($status === 'received') {
            $query->whereIn('status', ['partial', 'dispatched']);
        } elseif ($status) {
            $query->where('status', $status);
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function store(MaterialRequestStoreRequest $request): JsonResponse
    {
        $data = $request->validated();

        $lines = $data['lines'];
        unset($data['lines']);

        $materialRequest = DB::transaction(function () use ($data, $lines, $request) {
            $workOrderId = $data['work_order_id'] ?? null;
            $workOrder = $workOrderId !== null
                ? WorkOrder::query()->findOrFail($workOrderId)
                : null;

            return $this->materialRequests->storePendingRequest(
                $workOrder,
                $request->user(),
                $lines,
                $data['originating_area'] ?? null,
                $data['notes'] ?? null,
                $data['document_date'] ?? null,
                $data['destination_areas'] ?? null,
                $data['machine_code'] ?? null,
            );
        });

        return response()->json($materialRequest, 201);
    }

    public function show(MaterialRequest $material_request): JsonResponse
    {
        $material_request->load([
            'lines.material',
            'workOrder.client',
            'workOrder.product',
            'requester',
            'authorizer',
            'dispatcher',
        ]);

        return response()->json($material_request);
    }

    /**
     * Autorización supervisor (formulario: "Autorizado").
     */
    public function authorizeRequest(Request $request, MaterialRequest $material_request): JsonResponse
    {
        $updated = $this->materialRequests->authorizeRequest($material_request, $request->user());

        return response()->json($updated);
    }

    public function update(MaterialRequestPatchRequest $request, MaterialRequest $material_request): JsonResponse
    {
        $this->materialRequests->cancel($material_request);

        return response()->json($material_request->fresh()->load(['lines.material', 'workOrder']));
    }

    public function invokeDispatch(MaterialRequestDispatchRequest $request, MaterialRequest $material_request): JsonResponse
    {
        $updated = $this->materialRequests->dispatch(
            $material_request,
            $request->validated()['lines'],
            $request->user(),
        );

        return response()->json($updated);
    }
}
