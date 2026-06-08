<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserAdminEvent;
use App\Support\BossAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserAdminEventController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! BossAccess::allows($request->user())) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $query = UserAdminEvent::query()
            ->with([
                'actor:id,name,username',
                'target:id,name,username',
            ])
            ->orderByDesc('created_at');

        return response()->json($query->paginate(min((int) $request->query('per_page', 50), 100)));
    }
}
