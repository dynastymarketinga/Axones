<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OperationalAlert;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OperationalAlertController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = OperationalAlert::query()
            ->with(['workOrder:id,code', 'material:id,sku,name', 'acknowledgedByUser:id,name'])
            ->orderByDesc('created_at')
            ->visibleTo($user);

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
        } elseif (! filter_var($request->query('include_all'), FILTER_VALIDATE_BOOLEAN)) {
            $query->materialOperational();
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 30), 100)));
    }

    public function acknowledge(Request $request, OperationalAlert $operational_alert): JsonResponse
    {
        $user = $request->user();
        if ($operational_alert->alert_type === 'password_reset_requested'
            && ! $this->hasFullAlertAccess((string) ($user->role ?? ''))) {
            return response()->json([
                'message' => 'No autorizado para esta alerta.',
            ], 403);
        }

        $targetArea = $this->resolveTargetAreaFromRole((string) ($user->role ?? ''));
        if (! $this->hasFullAlertAccess((string) ($user->role ?? '')) && $targetArea !== null) {
            $alertTargetArea = (string) data_get($operational_alert->metadata, 'target_area', '');
            if ($alertTargetArea !== $targetArea) {
                return response()->json([
                    'message' => 'No autorizado para reconocer esta alerta.',
                ], 403);
            }
        }

        if ($operational_alert->acknowledged_at !== null) {
            return response()->json($operational_alert);
        }

        $operational_alert->update([
            'acknowledged_at' => now(),
            'acknowledged_by' => $request->user()->getKey(),
        ]);

        return response()->json($operational_alert->fresh()->load(['workOrder:id,code', 'material:id,sku,name']));
    }

    public function acknowledgeAll(Request $request): JsonResponse
    {
        $user = $request->user();
        $updated = OperationalAlert::query()
            ->visibleTo($user)
            ->materialOperational()
            ->unread()
            ->update([
                'acknowledged_at' => now(),
                'acknowledged_by' => $user->getKey(),
            ]);

        return response()->json([
            'updated_count' => $updated,
        ]);
    }

    public function acknowledgeWorkOrderArea(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'work_order_id' => ['required', 'integer', 'min:1'],
            'target_area' => ['required', 'string', Rule::in(['impresion', 'laminacion', 'corte', 'tintas', 'montaje'])],
        ]);

        $updated = OperationalAlert::query()
            ->visibleTo($user)
            ->unread()
            ->where('work_order_id', (int) $validated['work_order_id'])
            ->where('metadata->target_area', (string) $validated['target_area'])
            ->update([
                'acknowledged_at' => now(),
                'acknowledged_by' => $user->getKey(),
            ]);

        return response()->json([
            'updated_count' => $updated,
        ]);
    }

    private function hasFullAlertAccess(string $role): bool
    {
        return in_array(strtolower(trim($role)), ['boss', 'admin', 'jefe_supremo', 'superadmin', 'jefe_operaciones'], true);
    }

    private function resolveTargetAreaFromRole(string $role): ?string
    {
        return match (strtolower(trim($role))) {
            'printing', 'impresion' => 'impresion',
            'laminacion' => 'laminacion',
            'corte' => 'corte',
            'montaje' => 'montaje',
            'tintas' => 'tintas',
            default => null,
        };
    }
}
