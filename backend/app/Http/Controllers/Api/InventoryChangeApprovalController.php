<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryChangeApproval;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InventoryChangeApprovalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = InventoryChangeApproval::query()
            ->with(['requester:id,name,email', 'decider:id,name,email'])
            ->orderByDesc('created_at');

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($entityType = $request->query('entity_type')) {
            $query->where('entity_type', $entityType);
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'entity_type' => ['required', 'string', 'max:64'],
            'entity_id' => ['required', 'integer', 'min:1'],
            'change_payload' => ['required', 'array'],
            'reason_text' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        $approval = InventoryChangeApproval::query()->create([
            ...$validated,
            'requested_by' => (int) $request->user()->getKey(),
            'status' => 'pending',
        ]);

        return response()->json($approval, 201);
    }

    public function decide(Request $request, InventoryChangeApproval $inventoryChangeApproval): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', Rule::in(['approved', 'rejected'])],
            'decision_notes' => ['nullable', 'string', 'max:500'],
        ]);

        $inventoryChangeApproval->update([
            'status' => $validated['status'],
            'decision_notes' => $validated['decision_notes'] ?? null,
            'decided_by' => (int) $request->user()->getKey(),
            'decided_at' => now(),
        ]);

        return response()->json($inventoryChangeApproval->fresh(['requester:id,name,email', 'decider:id,name,email']));
    }
}
