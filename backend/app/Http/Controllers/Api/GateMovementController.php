<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreGateMovementRequest;
use App\Models\GateMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
class GateMovementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = GateMovement::query()
            ->with('user:id,name')
            ->orderByDesc('occurred_at');

        if ($request->query('direction')) {
            $query->where('direction', $request->query('direction'));
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function store(StoreGateMovementRequest $request): JsonResponse
    {
        $data = $request->validated();
        $photoPath = null;
        if ($request->hasFile('photo')) {
            $photoPath = $request->file('photo')->store('gate_photos', 'local');
        }
        unset($data['photo']);

        $movement = GateMovement::query()->create([
            'direction' => $data['direction'],
            'notes' => $data['notes'] ?? null,
            'photo_path' => $photoPath,
            'user_id' => $request->user()->getKey(),
            'occurred_at' => isset($data['occurred_at']) ? $data['occurred_at'] : now(),
        ]);

        return response()->json($movement->fresh()->load('user:id,name'), 201);
    }
}
