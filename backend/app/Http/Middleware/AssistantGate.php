<?php

namespace App\Http\Middleware;

use App\Services\Assistant\AssistantAccess;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AssistantGate
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! AssistantAccess::isEnabled()) {
            return response()->json([
                'message' => 'El asistente Axones está deshabilitado.',
                'code' => 'assistant_disabled',
            ], 403);
        }
        if (! AssistantAccess::allows($user)) {
            return response()->json([
                'message' => 'No autorizado para usar el asistente.',
                'code' => 'assistant_forbidden',
            ], 403);
        }

        return $next($request);
    }
}
