<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OperationalAlert;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OperationalAlertController extends Controller
{
    private const FULL_ACCESS_ROLES = ['boss', 'admin', 'jefe_supremo', 'superadmin'];

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = OperationalAlert::query()
            ->with(['workOrder:id,code', 'material:id,sku,name', 'acknowledgedByUser:id,name'])
            ->orderByDesc('created_at');

        $targetArea = $this->resolveTargetAreaFromRole((string) ($user->role ?? ''));
        if (! $this->hasFullAlertAccess($user?->id, (string) ($user->role ?? '')) && $targetArea !== null) {
            $query->where('metadata->target_area', $targetArea);
        }

        if (! $this->hasFullAlertAccess($user?->id, (string) ($user->role ?? ''))) {
            $query->where('alert_type', '!=', 'password_reset_requested');
        }

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
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 30), 100)));
    }

    public function acknowledge(Request $request, OperationalAlert $operational_alert): JsonResponse
    {
        $user = $request->user();
        if ($operational_alert->alert_type === 'password_reset_requested'
            && ! $this->hasFullAlertAccess($user?->id, (string) ($user->role ?? ''))) {
            return response()->json([
                'message' => 'No autorizado para esta alerta.',
            ], 403);
        }

        $targetArea = $this->resolveTargetAreaFromRole((string) ($user->role ?? ''));
        if (! $this->hasFullAlertAccess($user?->id, (string) ($user->role ?? '')) && $targetArea !== null) {
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

    private function hasFullAlertAccess(?int $userId, string $role): bool
    {
        return in_array(strtolower(trim($role)), self::FULL_ACCESS_ROLES, true);
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
