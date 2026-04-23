<?php

namespace App\Http\Controllers\Api;

use App\Enums\InventoryMovementType;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreInventoryMovementRequest;
use App\Models\Material;
use App\Services\InventoryLedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryMovementController extends Controller
{
    public function __construct(
        private readonly InventoryLedgerService $ledger,
    ) {}

    public function index(Request $request, Material $material): JsonResponse
    {
        $query = $material->movements()->orderByDesc('occurred_at')->orderByDesc('id');

        if ($request->query('from')) {
            $query->where('occurred_at', '>=', $request->query('from'));
        }

        if ($request->query('to')) {
            $query->where('occurred_at', '<=', $request->query('to'));
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 50), 200)));
    }

    public function store(StoreInventoryMovementRequest $request, Material $material): JsonResponse
    {
        $data = $request->validated();
        $type = InventoryMovementType::from($data['movement_type']);

        $movement = $this->ledger->apply(
            $material,
            $type,
            (string) $data['quantity'],
            $request->user(),
            $data['reference_type'] ?? null,
            isset($data['reference_id']) ? (int) $data['reference_id'] : null,
            $data['metadata'] ?? null,
            isset($data['occurred_at']) ? new \DateTimeImmutable($data['occurred_at']) : null,
        );

        $movement->load('material');

        return response()->json($movement, 201);
    }
}
