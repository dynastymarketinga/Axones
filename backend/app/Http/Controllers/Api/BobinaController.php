<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBobinaRequest;
use App\Models\Bobina;
use App\Services\BobinaRegistrationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BobinaController extends Controller
{
    public function __construct(
        private readonly BobinaRegistrationService $bobinas,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Bobina::query()->with(['material', 'inventoryReturn.workOrder'])->orderByDesc('created_at');

        if ($request->query('material_id')) {
            $query->where('material_id', $request->query('material_id'));
        }

        if ($request->query('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 50), 200)));
    }

    public function store(StoreBobinaRequest $request): JsonResponse
    {
        $bobina = $this->bobinas->register($request->validated(), $request->user());

        return response()->json($bobina, 201);
    }
}
