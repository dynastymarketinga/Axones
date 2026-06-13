<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\Assistant\AssistantApiException;
use App\Exceptions\Assistant\AssistantProviderException;
use App\Exceptions\Assistant\AssistantRateLimitException;
use App\Http\Controllers\Controller;
use App\Http\Requests\AssistantChatRequest;
use App\Models\AssistantMessage;
use App\Services\Assistant\AssistantAccess;
use App\Services\Assistant\AssistantOrchestratorService;
use App\Services\Assistant\AssistantRateLimitService;
use App\Services\Assistant\AssistantToolRegistry;
use App\Services\Assistant\AssistantToolRunner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AssistantController extends Controller
{
    public function __construct(
        private readonly AssistantOrchestratorService $orchestrator,
        private readonly AssistantRateLimitService $rateLimit,
        private readonly AssistantToolRegistry $registry,
        private readonly AssistantToolRunner $runner,
    ) {}

    public function status(Request $request): JsonResponse
    {
        $user = $request->user();
        $enabled = AssistantAccess::isEnabled();
        $allowed = $enabled && AssistantAccess::allows($user);
        $payload = [
            'enabled' => $enabled,
            'allowed' => $allowed,
            'allowed_roles' => AssistantAccess::allowedRoles(),
        ];
        if ($allowed && $user !== null) {
            $payload['rate_limit'] = $this->rateLimit->snapshot($user);
            $payload['tools_count'] = count($this->registry->all());
        }

        return response()->json($payload);
    }

    public function suggestions(Request $request): JsonResponse
    {
        $args = [
            'route' => $request->query('route'),
            'entity_type' => $request->query('entity_type'),
            'entity_id' => $request->query('entity_id'),
            'area' => $request->query('area'),
        ];
        $args = array_filter($args, static fn ($v): bool => $v !== null && $v !== '');
        $result = $this->runner->run('axones_suggest_chips', $args);

        return response()->json($result->toArray());
    }

    public function chat(AssistantChatRequest $request): JsonResponse
    {
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }
        $bearer = $request->bearerToken();
        $payload = $request->validated();

        $userMessage = (string) ($payload['message'] ?? '');
        $contextRaw = $payload['context'] ?? null;
        $context = is_array($contextRaw) ? $contextRaw : [];

        $messageRecord = AssistantMessage::create([
            'user_id' => $user->getKey(),
            'user_role' => strtolower(trim((string) ($user->role ?? 'general'))),
            'route_context' => $context !== [] ? $context : null,
            'user_message' => $userMessage,
            'status' => 'ok',
        ]);

        try {
            $result = $this->orchestrator->run($user, $bearer, [
                'message' => $userMessage,
                'context' => $context,
                'tool' => $payload['tool'] ?? null,
                'tool_params' => $payload['tool_params'] ?? null,
                'force_analysis' => (bool) ($payload['force_analysis'] ?? false),
            ]);
        } catch (AssistantRateLimitException $e) {
            $messageRecord->update([
                'status' => 'rate_limited',
                'error_message' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => $e->getMessage(),
                'code' => 'rate_limited',
                'rate_limit' => [
                    'used' => $e->used,
                    'limit' => $e->limit,
                    'remaining' => 0,
                ],
            ], 429);
        } catch (AssistantProviderException $e) {
            Log::warning('assistant.provider_error', ['msg' => $e->getMessage(), 'status' => $e->status]);
            $messageRecord->update([
                'status' => 'error',
                'error_message' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'El proveedor del modelo respondió con error: '.$e->getMessage(),
                'code' => 'provider_error',
            ], 502);
        } catch (AssistantApiException $e) {
            Log::warning('assistant.api_error', ['msg' => $e->getMessage(), 'status' => $e->status]);
            $messageRecord->update([
                'status' => 'error',
                'error_message' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Fallo llamando la API interna: '.$e->getMessage(),
                'code' => 'api_error',
            ], 502);
        } catch (\Throwable $e) {
            Log::error('assistant.unexpected', ['msg' => $e->getMessage()]);
            $messageRecord->update([
                'status' => 'error',
                'error_message' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Error inesperado en el asistente.',
                'code' => 'unexpected',
            ], 500);
        }

        $messageRecord->update([
            'assistant_message' => $result['assistant_message'],
            'dots' => $result['dots'] !== [] ? $result['dots'] : null,
            'chips' => $result['follow_up_chips'] !== [] ? $result['follow_up_chips'] : null,
            'tools_used' => $result['tools_used'] !== [] ? $result['tools_used'] : null,
            'model_used' => $result['model_used'],
            'input_tokens' => $result['input_tokens'],
            'output_tokens' => $result['output_tokens'],
            'duration_ms' => $result['duration_ms'],
        ]);

        return response()->json([
            'assistant_message' => $result['assistant_message'],
            'dots' => $result['dots'],
            'follow_up_chips' => $result['follow_up_chips'],
            'tools_used' => $result['tools_used'],
            'model_used' => $result['model_used'],
            'duration_ms' => $result['duration_ms'],
            'rate_limit' => $result['rate_limit'],
        ]);
    }
}
