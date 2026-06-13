<?php

namespace App\Services\Assistant;

use App\Exceptions\Assistant\AssistantProviderException;
use App\Models\User;
use App\Support\AssistantToolResult;

/**
 * Punto de entrada del chat: delega a modo local (gratis) o Anthropic según config.
 * Anthropic: loop tool-calling, máx. 5 iteraciones. Local: reglas estáticas, sin LLM.
 */
final class AssistantOrchestratorService
{
    public const MAX_TURNS = 5;

    public function __construct(
        private readonly AssistantLocalOrchestratorService $local,
        private readonly AssistantAnthropicClient $anthropic,
        private readonly AssistantToolRegistry $registry,
        private readonly AssistantToolRunner $runner,
        private readonly AssistantInternalApiClient $api,
        private readonly AssistantModelRouter $router,
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
        if ($this->provider() === 'local') {
            return $this->local->run($user, $bearerToken, $payload);
        }

        $this->rateLimit->check($user);

        $userMessage = trim((string) ($payload['message'] ?? ''));
        if ($userMessage === '') {
            throw new \InvalidArgumentException("Falta 'message'.");
        }
        $context = is_array($payload['context'] ?? null) ? $payload['context'] : [];
        $forceAnalysis = (bool) ($payload['force_analysis'] ?? false);

        $this->api->withBearerToken($bearerToken);

        $model = $this->router->pick($userMessage, $forceAnalysis);
        $maxTokens = max(256, (int) config('axones.assistant.max_tokens', 2048));
        $timeoutSeconds = max(5, (int) config('axones.assistant.timeout_seconds', 45));

        $system = $this->systemPrompt($user, $context);
        $tools = $this->registry->anthropicSchemas();

        $messages = [
            ['role' => 'user', 'content' => $userMessage],
        ];

        $start = microtime(true);
        $inputTokens = 0;
        $outputTokens = 0;
        $toolsUsed = [];
        $dots = [];
        $followUpChips = [];
        $finalText = '';
        $modelUsedLast = $model;

        for ($turn = 0; $turn < self::MAX_TURNS; $turn++) {
            $response = $this->anthropic->createMessage(
                model: $model,
                messages: $messages,
                tools: $tools,
                system: $system,
                maxTokens: $maxTokens,
                timeoutSeconds: $timeoutSeconds,
            );

            $modelUsedLast = (string) ($response['model'] ?? $model);
            if (isset($response['usage']['input_tokens'])) {
                $inputTokens += (int) $response['usage']['input_tokens'];
            }
            if (isset($response['usage']['output_tokens'])) {
                $outputTokens += (int) $response['usage']['output_tokens'];
            }

            $content = is_array($response['content'] ?? null) ? $response['content'] : [];
            $textParts = [];
            $toolUses = [];
            foreach ($content as $block) {
                if (! is_array($block)) {
                    continue;
                }
                $type = (string) ($block['type'] ?? '');
                if ($type === 'text' && isset($block['text']) && is_string($block['text'])) {
                    $textParts[] = $block['text'];
                } elseif ($type === 'tool_use') {
                    $toolUses[] = $block;
                }
            }
            $stopReason = (string) ($response['stop_reason'] ?? '');

            if ($toolUses === [] || $stopReason !== 'tool_use') {
                $finalText = trim(implode("\n", $textParts));
                $messages[] = ['role' => 'assistant', 'content' => $content];
                break;
            }

            $messages[] = ['role' => 'assistant', 'content' => $content];
            $userContent = [];
            foreach ($toolUses as $toolUse) {
                $name = (string) ($toolUse['name'] ?? '');
                $args = is_array($toolUse['input'] ?? null) ? $toolUse['input'] : [];
                $toolUseId = (string) ($toolUse['id'] ?? '');
                $result = $this->runner->run($name, $args);
                $toolsUsed[] = ['name' => $name, 'ok' => $result->ok];
                foreach ($result->dots as $d) {
                    $dots[] = $d;
                }
                foreach ($result->followUpChips as $c) {
                    $followUpChips[] = $c;
                }
                $userContent[] = [
                    'type' => 'tool_result',
                    'tool_use_id' => $toolUseId,
                    'content' => json_encode($result->toArray(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    'is_error' => ! $result->ok,
                ];
            }
            $messages[] = ['role' => 'user', 'content' => $userContent];
        }

        if ($finalText === '') {
            $finalText = 'No pude completar la respuesta dentro del límite de iteraciones.';
        }

        $duration = (int) round((microtime(true) - $start) * 1000);

        return [
            'assistant_message' => $finalText,
            'dots' => $this->dedupeDots($dots),
            'follow_up_chips' => $this->dedupeChips($followUpChips),
            'tools_used' => $toolsUsed,
            'model_used' => $modelUsedLast,
            'input_tokens' => $inputTokens > 0 ? $inputTokens : null,
            'output_tokens' => $outputTokens > 0 ? $outputTokens : null,
            'duration_ms' => $duration,
            'rate_limit' => $this->rateLimit->snapshot($user),
        ];
    }

    /**
     * @param array<string,mixed> $context
     */
    private function systemPrompt(User $user, array $context): string
    {
        $role = strtolower(trim((string) ($user->role ?? 'general')));
        $route = (string) ($context['route'] ?? '');
        $area = (string) ($context['area'] ?? '');
        $entityType = (string) ($context['entity_type'] ?? '');
        $entityId = (string) ($context['entity_id'] ?? '');
        $ctxLine = trim("ruta: {$route} · área: {$area} · entidad: {$entityType} {$entityId}", ' ·');

        return <<<PROMPT
            Eres el asistente Axones, un copiloto operativo de una planta de empaque flexible.
            Hablas en español neutro, conciso y directo. Tu rol es responder preguntas y hacer
            análisis sobre datos reales del sistema usando ÚNICAMENTE las tools disponibles.

            Reglas estrictas:
            - NUNCA inventes cifras, fechas, códigos de OT, nombres de cliente o cantidades.
            - Si necesitas un dato, llama a la tool correspondiente. Si no existe una tool
              para responder algo, dilo claramente.
            - Cuando una tool devuelva 'data', basa tu respuesta en esos campos exactos.
            - Si una tool devuelve 'error', explícalo brevemente y propone una alternativa.
            - Para análisis (mermas, tiempos, comparativas) usa las tools de análisis
              y resume los hallazgos en 3-6 líneas máximo.
            - Si el usuario menciona una OT por código (OT-AAAA-NNNNN), úsalo tal cual
              en 'identifier'.
            - Solo lectura: no existen tools de escritura.

            Contexto del usuario:
            - rol: {$role}
            - {$ctxLine}

            Responde en español, en texto plano, sin markdown decorativo.
            PROMPT;
    }

    /**
     * @param array<int,array<string,mixed>> $dots
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
     * @param array<int,array<string,mixed>> $chips
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

    private function provider(): string
    {
        return strtolower(trim((string) config('axones.assistant.provider', 'local')));
    }
}
