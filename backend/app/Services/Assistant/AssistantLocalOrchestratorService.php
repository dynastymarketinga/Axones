<?php

namespace App\Services\Assistant;

use App\Models\User;
use App\Support\AssistantToolResult;

/**
 * Orquestador sin LLM: ejecuta tools por chip directo o por reglas de intención.
 * $0, sin API keys externas. Anthropic queda disponible cambiando el provider.
 */
final class AssistantLocalOrchestratorService
{
    public const MODEL_LABEL = 'axones-local';

    public function __construct(
        private readonly AssistantLocalIntentRouter $router,
        private readonly AssistantToolRunner $runner,
        private readonly AssistantInternalApiClient $api,
        private readonly AssistantRateLimitService $rateLimit,
    ) {}

    /**
     * @param  array{
     *     message:string,
     *     context?:array<string,mixed>,
     *     tool?:?string,
     *     tool_params?:?array<string,mixed>,
     *     force_analysis?:bool
     * }  $payload
     * @return array{
     *     assistant_message:string,
     *     dots:array<int,array{type:string,id:int|string,label:string,href:string}>,
     *     follow_up_chips:array<int,array{label:string,tool:string,params?:array<string,mixed>}>,
     *     tools_used:array<int,array{name:string,ok:bool}>,
     *     model_used:string,
     *     input_tokens:?int,
     *     output_tokens:?int,
     *     duration_ms:int,
     *     rate_limit:array{limit:int,used:int,remaining:int}
     * }
     */
    public function run(User $user, ?string $bearerToken, array $payload): array
    {
        $this->rateLimit->check($user);
        $this->api->withBearerToken($bearerToken);

        $start = microtime(true);
        $context = is_array($payload['context'] ?? null) ? $payload['context'] : [];
        $match = $this->router->resolve($payload);

        if ($match === null) {
            return $this->fallbackResponse($user, $context, $start);
        }

        if (isset($match['message']) && is_string($match['message'])) {
            return $this->conversationalResponse($user, $match['message'], $context, $start);
        }

        $result = $this->runner->run($match['tool'], $match['params']);

        return $this->buildResponse($user, $result, $match['tool'], $start);
    }

    /**
     * @param  array<string,mixed>  $context
     * @return array{
     *     assistant_message:string,
     *     dots:array<int,array{type:string,id:int|string,label:string,href:string}>,
     *     follow_up_chips:array<int,array{label:string,tool:string,params?:array<string,mixed>}>,
     *     tools_used:array<int,array{name:string,ok:bool}>,
     *     model_used:string,
     *     input_tokens:?int,
     *     output_tokens:?int,
     *     duration_ms:int,
     *     rate_limit:array{limit:int,used:int,remaining:int}
     * }
     */
    private function fallbackResponse(User $user, array $context, float $start): array
    {
        $chips = $this->contextualChips($context);
        $duration = (int) round((microtime(true) - $start) * 1000);

        return [
            'assistant_message' => 'No entendí esa consulta. Prueba con las sugerencias de abajo o escribe, por ejemplo: '
                .'«resumen general», «alertas», «inventario bajo», «solicitudes» u «OT-2026-00001».',
            'dots' => [],
            'follow_up_chips' => $this->dedupeChips($chips),
            'tools_used' => [],
            'model_used' => self::MODEL_LABEL,
            'input_tokens' => null,
            'output_tokens' => null,
            'duration_ms' => $duration,
            'rate_limit' => $this->rateLimit->snapshot($user),
        ];
    }

    /**
     * @param  array<string,mixed>  $context
     * @return array{
     *     assistant_message:string,
     *     dots:array<int,array{type:string,id:int|string,label:string,href:string}>,
     *     follow_up_chips:array<int,array{label:string,tool:string,params?:array<string,mixed>}>,
     *     tools_used:array<int,array{name:string,ok:bool}>,
     *     model_used:string,
     *     input_tokens:?int,
     *     output_tokens:?int,
     *     duration_ms:int,
     *     rate_limit:array{limit:int,used:int,remaining:int}
     * }
     */
    private function conversationalResponse(User $user, string $message, array $context, float $start): array
    {
        $chips = $this->contextualChips($context);
        $duration = (int) round((microtime(true) - $start) * 1000);

        return [
            'assistant_message' => $message,
            'dots' => [],
            'follow_up_chips' => $this->dedupeChips($chips),
            'tools_used' => [],
            'model_used' => self::MODEL_LABEL,
            'input_tokens' => null,
            'output_tokens' => null,
            'duration_ms' => $duration,
            'rate_limit' => $this->rateLimit->snapshot($user),
        ];
    }

    /**
     * @param  array<string,mixed>  $context
     * @return array<int,array<string,mixed>>
     */
    private function contextualChips(array $context): array
    {
        $suggestArgs = array_filter([
            'route' => $context['route'] ?? null,
            'entity_type' => $context['entity_type'] ?? null,
            'entity_id' => $context['entity_id'] ?? null,
            'area' => $context['area'] ?? null,
        ], static fn ($v): bool => $v !== null && $v !== '');

        $suggest = $this->runner->run('axones_suggest_chips', $suggestArgs);

        return $suggest->ok ? $suggest->followUpChips : [];
    }

    /**
     * @return array{
     *     assistant_message:string,
     *     dots:array<int,array{type:string,id:int|string,label:string,href:string}>,
     *     follow_up_chips:array<int,array{label:string,tool:string,params?:array<string,mixed>}>,
     *     tools_used:array<int,array{name:string,ok:bool}>,
     *     model_used:string,
     *     input_tokens:?int,
     *     output_tokens:?int,
     *     duration_ms:int,
     *     rate_limit:array{limit:int,used:int,remaining:int}
     * }
     */
    private function buildResponse(User $user, AssistantToolResult $result, string $toolName, float $start): array
    {
        $message = $result->summary ?? '';
        if ($message === '' && $result->error !== null) {
            $message = $result->error;
        }
        if ($message === '' && $result->ok) {
            $message = 'Consulta completada.';
        }
        if ($message === '' && ! $result->ok) {
            $message = 'No se pudo completar la consulta.';
        }

        $duration = (int) round((microtime(true) - $start) * 1000);

        return [
            'assistant_message' => $message,
            'dots' => $this->dedupeDots($result->dots),
            'follow_up_chips' => $this->dedupeChips($result->followUpChips),
            'tools_used' => [['name' => $toolName, 'ok' => $result->ok]],
            'model_used' => self::MODEL_LABEL,
            'input_tokens' => null,
            'output_tokens' => null,
            'duration_ms' => $duration,
            'rate_limit' => $this->rateLimit->snapshot($user),
        ];
    }

    /**
     * @param  array<int,array<string,mixed>>  $dots
     * @return array<int,array<string,mixed>>
     */
    private function dedupeDots(array $dots): array
    {
        $seen = [];
        $out = [];
        foreach ($dots as $d) {
            $key = ($d['type'] ?? '').'#'.($d['id'] ?? '');
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $out[] = $d;
            if (count($out) >= 15) {
                break;
            }
        }

        return $out;
    }

    /**
     * @param  array<int,array<string,mixed>>  $chips
     * @return array<int,array<string,mixed>>
     */
    private function dedupeChips(array $chips): array
    {
        $seen = [];
        $out = [];
        foreach ($chips as $c) {
            $key = ($c['tool'] ?? '').'|'.json_encode($c['params'] ?? []);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $out[] = $c;
            if (count($out) >= 6) {
                break;
            }
        }

        return $out;
    }
}
